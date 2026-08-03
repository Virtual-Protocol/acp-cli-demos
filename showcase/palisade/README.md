# PaliSade

Keyless, read-only onchain security scanner for **Robinhood Chain** (primary),
exposed as an **MCP server** any agent can call over HTTP before it signs an
approval, swaps, or invests. EVM majors (Ethereum, Polygon, Arbitrum) and
Solana are also supported for cross-chain checks.

- **Live API:** https://mcp.palisadescan.com
- **Website:** https://palisadescan.com
- **Source:** https://github.com/palisadescan/palisade

## What it does

Eighteen read-only inspectors interrogate a token or wallet, then a consensus
pass weighs six independent signals so one noisy source can't escalate risk on
its own.

| # | Tool | What it checks |
| --- | --- | --- |
| 1 | `palisade_scan_approvals` | ERC-20/721 allowances, flags unlimited spenders |
| 2 | `palisade_scan_token` | Rugpull indicators: hidden mint, proxy, tax, blacklist |
| 3 | `palisade_detect_honeypot` | Simulated buy/sell to catch tokens you can't exit |
| 4 | `palisade_safety_score` | 0-100 composite: code, ownership, liquidity, holders |
| 5 | `palisade_wallet_report` | Full wallet security posture |
| 6 | `palisade_monitor_wallet` | Alerts on new approvals, risky interactions |
| 7 | `palisade_token_market` | Price, liquidity, volume, pool age (DexScreener) |
| 8 | `palisade_deployer_check` | Deployer history + verification (Blockscout) |
| 9 | `palisade_batch_scan` | Score many tokens in one call, ranked by risk |
| 10 | `palisade_check_scam` | Community scam-report database |
| 11 | `palisade_sentinel_status` | Autonomous Sentinel watchlist + loop config |
| 12 | `palisade_consensus` | Six-source weighted verdict (false-positive guard) |
| 13 | `palisade_liquidity_lock` | Locked / burned / unlocked / unknown |
| 14 | `palisade_simulate_approval` | Simulate an approval before signing |
| 15 | `palisade_detect_clone` | Bytecode fingerprint vs scam DB |
| 16 | `palisade_check_tax` | Buy/sell tax mechanics |
| 17 | `palisade_check_ownership` | Ownership renounced / retained |
| 18 | `palisade_holder_concentration` | Whale grip on sellable float |

## Boundaries

- **Read-only by design.** Never signs, holds keys, or moves funds.
- **Keyless and free.** No API key, no account, no payment.
- **Unknown over safe.** Missing data resolves to `unknown`, never `safe`.

## Quick call

```bash
curl -s -X POST https://mcp.palisadescan.com/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"palisade_safety_score",
                 "arguments":{"contract":"0xTokenAddressHere","chain":"robinhood"}}}'
```

See [`examples/live-endpoint-proof.md`](examples/live-endpoint-proof.md) for
real, reproducible responses, and
[`skills/palisade-security-scan`](skills/palisade-security-scan) for the
reusable scan skill.
