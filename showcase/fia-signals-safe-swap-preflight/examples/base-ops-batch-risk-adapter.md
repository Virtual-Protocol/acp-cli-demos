# OpenClaw Base Ops Batch-Risk Adapter

Use this adapter before a Base execution agent signs or routes a swap. Build the
address list from `route.to_token` plus any intermediate token or contract
addresses that can affect settlement. Call token safety first, then contract
risk when bytecode or admin risk matters.

## Canonical Input

```json
{
  "chain": "base",
  "token_addresses": [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x4200000000000000000000000000000000000006"
  ],
  "workflow": "pre_swap_gate",
  "route_context": {
    "dex": "buyer-selected DEX or aggregator",
    "amount_usdc": 25,
    "slippage_bps": 100
  }
}
```

Rules:

- `token_addresses` must contain 1 to 5 EVM addresses.
- Default `chain` is `base`.
- Never include private keys, seed phrases, auth tokens, wallet-control data, or
  signing material.

## Copy-Paste Unpaid Boundary Checks

```bash
TOKEN_CSV="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,0x4200000000000000000000000000000000000006"

curl -i "https://x402.fiasignals.com/token-safety/batch?chain=base&token_addresses=${TOKEN_CSV}"
curl -i "https://x402.fiasignals.com/contract-risk/batch?chain=base&token_addresses=${TOKEN_CSV}"
```

Expected unpaid status: HTTP `402`.

For a paid call, use an x402-capable client. First request receives `402`; the
client builds the payment for `accepts[0]`; then it retries the same URL with
the full x402 payload in `X-PAYMENT` or `PAYMENT-SIGNATURE`.

## Request Adapter

```js
function toFiaBatchQuery(input) {
  const chain = input.chain || 'base'
  const addrs = [...(input.token_addresses || [])]

  if (addrs.length < 1 || addrs.length > 5) {
    throw new Error('token_addresses must contain 1..5 EVM addresses')
  }

  for (const address of addrs) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error(`invalid EVM address: ${address}`)
    }
  }

  return new URLSearchParams({
    chain,
    token_addresses: addrs.join(','),
  }).toString()
}
```

## Response Adapter

```js
function fiaResultToSwapGate(result) {
  const rows = result.results || []
  const hard = rows.filter((row) => (
    ['blocked', 'error'].includes(String(row.verdict || '').toLowerCase()) ||
    String(row.action || '').toUpperCase() === 'REJECT'
  ))
  const caution = rows.filter((row) => (
    String(row.verdict || '').toLowerCase() === 'risky' ||
    String(row.action || '').toUpperCase() === 'CAUTION'
  ))

  return {
    decision: hard.length ? 'BLOCK' : caution.length ? 'CAUTION' : 'GO',
    checked_count: result.count || rows.length,
    summary: result.summary || {},
    blockers: hard.map((row) => ({
      verdict: row.verdict,
      action: row.action,
      reasons: row.reasons || [],
    })),
    warnings: caution.map((row) => ({
      verdict: row.verdict,
      action: row.action,
      reasons: row.reasons || [],
    })),
    source: 'Fia Signals batch risk x402',
  }
}
```

## Base Ops Hook

1. Before swap execution, collect `route.to_token` and any intermediate token or
   contract addresses.
2. Call `/token-safety/batch`.
3. Call `/contract-risk/batch` when bytecode, proxy, owner, admin, or upgrade
   risk affects the route.
4. Block execution on `BLOCK` or `REJECT`.
5. Cap size or require operator confirmation on `CAUTION`.
6. Store the Fia JSON and the adapted decision beside the swap decision artifact.

This adapter is integration material only. It is not buyer proof, settlement
proof, or revenue.
