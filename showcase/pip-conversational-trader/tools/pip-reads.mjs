const BASE = process.env.PIP_BASE || 'https://piptradedex.xyz'

const READS = {
  prices: '/api/prices',
  markets: '/api/markets',
  tokens: '/api/tokens',
  stats: '/api/pip/stats',
  rh: '/api/rh/tokens',
}

async function get(path) {
  const r = await fetch(BASE + path, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(path + ' returned ' + r.status)
  return r.json()
}

async function main() {
  const which = process.argv[2]
  const keys = which && READS[which] ? [which] : Object.keys(READS)
  const out = {}
  for (const k of keys) {
    try {
      out[k] = await get(READS[k])
    } catch (e) {
      out[k] = { error: String(e.message) }
    }
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
}

main().catch((e) => {
  process.stderr.write(String(e.message) + '\n')
  process.exit(1)
})
