#!/usr/bin/env node
/*
 * PipTrade Agent, the whole read-only flow in one file.
 *
 *   node pip-quote.mjs <amount> <FROM_SYM> <FROM_CHAIN> <TO_SYM> <TO_CHAIN>
 *   node pip-quote.mjs 5 USDC base ETH base
 *
 * Resolves both assetIds from the live registry, converts a HUMAN amount to base
 * units using the real decimals, runs the public sell check, then quotes.
 * No auth, no signing, nothing moves.
 *
 * The base-units conversion is the point. Sending "5" instead of "5000000" for a
 * 6dp token quotes 0.000005 and fails as an unhelpful `busy`.
 */
const BASE = process.env.PIP_BASE || 'https://piptradedex.xyz'

async function api(path, init) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch {
    // a GET on a POST-only route returns the landing page HTML at 200, not a 405
    throw new Error(`${path} returned non-JSON (status ${r.status}); check the method`)
  }
  return { status: r.status, body }
}

/** human amount -> base units, exactly, without floating point drift */
export function toBaseUnits(human, decimals) {
  const s = String(human).trim()
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad amount: ${human}`)
  const [whole, frac = ''] = s.split('.')
  if (frac.length > decimals) throw new Error(`${human} has more precision than ${decimals} decimals`)
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0')).toString()
}

const pick = (tokens, sym, chain) => {
  const hit = tokens.find(
    (t) => String(t.symbol).toUpperCase() === sym.toUpperCase() && String(t.blockchain).toLowerCase() === chain.toLowerCase(),
  )
  if (!hit) throw new Error(`${sym} on ${chain} is not listed. Check GET /api/tokens.`)
  return hit
}

async function main() {
  const [amount, fromSym, fromChain, toSym, toChain] = process.argv.slice(2)
  if (!amount || !fromSym || !fromChain || !toSym || !toChain) {
    console.error('usage: node pip-quote.mjs <amount> <FROM_SYM> <FROM_CHAIN> <TO_SYM> <TO_CHAIN>')
    process.exit(2)
  }

  // 1. resolve identity from the registry, never hardcode an assetId
  const { body: reg } = await api('/api/tokens')
  const from = pick(reg.tokens, fromSym, fromChain)
  const to = pick(reg.tokens, toSym, toChain)
  const base = toBaseUnits(amount, from.decimals)
  console.log(`from  ${from.symbol}@${from.blockchain}  decimals ${from.decimals}`)
  console.log(`to    ${to.symbol}@${to.blockchain}`)
  console.log(`amount ${amount} -> ${base} base units`)

  // 2. public safety gate. only meaningful for a contract address.
  if (/^0x[0-9a-fA-F]{40}$/.test(from.contractAddress || '')) {
    // ALWAYS pass chain. Without it the check runs as a Robinhood Chain sell and a
    // perfectly good Base token comes back sellable:null/unverifiable (a false CAUTION).
    const { body: sc } = await api(`/api/rh/sellcheck?address=${from.contractAddress}&chain=${encodeURIComponent(from.blockchain)}`)
    const verdict = sc.sellable === true ? 'GO' : sc.sellable === false ? 'BLOCK' : 'CAUTION'
    console.log(`safety ${verdict}  sellable=${sc.sellable}${sc.reason ? ` reason=${sc.reason}` : ''}`)
    // absence of evidence is CAUTION, never GO
    if (verdict === 'BLOCK') { console.error('BLOCK is a hard stop. Not quoting.'); process.exit(1) }
  }

  // 3. dry quote. no session needed.
  const { body: q } = await api('/api/quote', {
    method: 'POST',
    body: JSON.stringify({ originAsset: from.assetId, destinationAsset: to.assetId, amount: base }),
  })
  if (!q.ok) {
    // branch on `ok` and `error`, never the HTTP status
    const hint = q.error === 'busy' ? ' (check base units first)' : ''
    console.error(`quote failed: ${q.error}${hint}`)
    if (q.min) console.error(`minimum: ${q.min.amount} ${q.min.sym} on ${q.min.chain}`)
    process.exit(1)
  }
  console.log(`\nout    ${q.amountOutFormatted} ${to.symbol}  ($${Number(q.amountOutUsd).toFixed(4)})`)
  console.log(`in     ${q.amountInFormatted} ${from.symbol}  ($${Number(q.amountInUsd).toFixed(4)})`)
  console.log(`min    ${q.minAmountOut} base units of ${to.symbol}`)
  console.log(`eta    ${q.timeEstimate}s`)
  console.log(`private ${q.private}`)
  console.log('\nThis is a quote only. The user signs at ' + BASE + '/app to execute.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(String(e.message)); process.exit(1) })
}
