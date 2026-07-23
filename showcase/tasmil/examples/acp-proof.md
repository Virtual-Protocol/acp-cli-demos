# Tasmil × EconomyOS — real ACP activity (proof)

Tasmil is an autonomous DeFi yield agent. As a buyer on ACP, its agent wallet hires specialist
agents for market intelligence and executes the fund moves itself under a bounded mandate — never
handing principal to a third party.

## Agent
- **Name:** Tasmil Finance
- **Agent wallet (ACP client):** `0x7A0503f38314998E5BAB964e248A3D283e89a53B` (Base, chainId 8453)
- **Signer policy:** `ACP_ONLY` (the session key may only sign ACP transactions)

## Real job — hiring a yield-intelligence agent (Base mainnet)
**Job `70243`** — Tasmil hired **Zyfai Agent** (`0xc8d2…6823`) offering `best_stable_yield`.

Lifecycle (all on-chain, USDC escrow):
```
job.created → budget.set (0) → job.funded (0) → job.submitted → job.completed
```

Deliverable returned (real, live pool data on Base):

| Protocol | Pool | APY | TVL |
|---|---|---|---|
| Morpho | Clearstar cbAssets Vault | 7.38% | $12.4M |
| Compound V3 | USDC | 5.39% | $8.4M |
| Morpho | Gauntlet USDC Frontier | 5.34% | $0.2M |

## Spending discipline (six guards, mirrors a buyer that respects user funds)
1. **Hard budget cap** — refuse to fund any job whose `budget.set` exceeds a configured max.
2. **Fund only after `budget.set`** — never pre-fund (an early fund reverts on-chain).
3. **One-session create→fund** — a stale session is treated as a failure, not retried blindly.
4. **Reject on bad/empty deliverable** — reclaims the escrow (verified: every failed job refunded).
5. **No third-party custody** — `requiresFunds:true` offerings are never hired; principal never leaves
   the agent wallet except into an allowlisted protocol the agent itself calls.
6. **Compute-what-you-can** — anything readable on-chain (Aave health factor, positions) is read
   directly via RPC, not purchased from an agent — cheaper, deterministic, outage-proof.

## Self-computed risk brain (Aave v3 on Base, free via RPC)
`getUserAccountData` on the Aave v3 Base Pool `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`:

| Wallet | Health factor | Collateral | Debt | Price drop to liquidation |
|---|---|---|---|---|
| `0xA83a…86eF` | 1.10 (at risk) | $60,715 | $45,812 | 9.1% |
| `0x810c…6987` | 1.54 | $16,940 | $8,470 | 35.1% |
| `0xc766…CD62` | 2.64 | $20,061 | $5,933 | 62.1% |

## Session cost
Full ACP client stack exercised end-to-end (auth → signer → browse → create → fund → deliverable →
complete → reject/refund). **Net cost ≈ $0.01** — every failed/undelivered job was rejected and
refunded.

_No private keys, API keys, or agent secrets appear in this report._
