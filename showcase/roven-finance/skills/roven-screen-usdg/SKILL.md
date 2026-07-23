---
name: roven-screen-usdg
description: Screen Robinhood Chain Morpho Vault V2 opportunities for canonical USDG via Roven's read-only API and return ranked comparisons with explorer links. Never deposit, approve, or move funds.
version: 1.0.0
---

# Roven Screen USDG

Use Roven's public opportunities API to screen Morpho Vault V2 yield
opportunities for canonical USDG on Robinhood Chain. This skill is **read-only**:
it never constructs approvals, deposits, withdrawals, or routing transactions.

## When to use this skill

- An agent or reviewer needs the current screened USDG vault set on Robinhood Chain.
- A caller wants a comparable view of net APY, TVL, available liquidity, listing
  status, and Market Quality before leaving the desk.
- A workflow must attach Blockscout explorer links for independent verification.

## When NOT to use this skill

- To deposit, withdraw, approve, or otherwise move funds.
- To treat Market Quality as a security rating, audit result, or guarantee.
- To screen assets other than canonical USDG, or chains other than Robinhood
  Chain mainnet (`4663`).
- To produce personalized financial advice or allocation percentages.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `opportunities_url` | no | Defaults to `https://roven.finance/api/opportunities`. |
| `min_tvl_usd` | no | Extra local filter after Roven's server-side screen. |
| `require_listed` | no | Defaults to `false`. When `true`, keep only Morpho-listed vaults. |

## Tools, credentials, and preconditions

- HTTPS `GET` to the public opportunities endpoint. No API key is required for
  the screening path.
- Optional wallet connect is **out of scope for this skill**; if a product UI
  shows USDG balance, it must use read-only `eth_call` only.
- Network expectation: Robinhood Chain mainnet, chain ID `4663`.
- Canonical USDG: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`.

## Approval gates

This skill performs **no spending, posting, account creation, deployment, or
production mutation**. Any on-chain action after the screen is a separate,
caller-owned step and must not be automated by this skill.

## Procedure

1. `GET` `opportunities_url`.
2. Confirm `sourceStatus` is present (`live` preferred; `stale` must be labeled).
3. Map each opportunity to `{ name, address, listed, netApy, tvlUsd, liquidityUsd, marketQualityScore, marketQualityLabel, explorerUrl }`.
4. Apply optional local filters (`min_tvl_usd`, `require_listed`).
5. Sort by `marketQualityScore` desc, then `netApy` desc.
6. Return the ranked list plus methodology/limitation strings from the payload.

## Stop conditions and handoff

- Non-200 response or invalid JSON → stop; do not invent vaults.
- `sourceStatus: "stale"` → continue only if the dated snapshot is shown to the caller.
- Empty set after filters → return empty with an explicit reason.
- Caller asks "where should I deposit X%?" → refuse allocation advice; hand back
  tradeoffs + explorer links.

## Validation checks

- Every `address` / `id` matches `^0x[a-fA-F0-9]{40}$`.
- `assetAddress` (when present) equals canonical USDG (case-insensitive).
- `netApy` is finite and `> 0` for retained rows.
- `explorerUrl` is an `https://` Robinhood Chain Blockscout link when provided.
- Output never includes API keys, seed phrases, or private account records.

## Output contract

```json
{
  "sourceStatus": "live",
  "snapshotAt": "2026-07-23T03:56:36.504Z",
  "methodologyVersion": "2026-07-16.1",
  "opportunities": [
    {
      "name": "Steakhouse USDG",
      "address": "0xBeEff033F34C046626B8D0A041844C5d1A5409dd",
      "listed": true,
      "netApy": 2.73,
      "tvlUsd": 177470770,
      "liquidityUsd": 0,
      "marketQualityScore": 90,
      "marketQualityLabel": "Strong data",
      "explorerUrl": "https://robinhoodchain.blockscout.com/address/0xBeEff033F34C046626B8D0A041844C5d1A5409dd"
    }
  ],
  "limitations": [
    "Market Quality is a data-screening score, not a security rating or prediction of loss."
  ]
}
```

## Public examples

- Prompt: [examples/prompt.md](./examples/prompt.md)
- Redacted result: [examples/result-redacted.md](./examples/result-redacted.md)

## Links

- App: https://roven.finance/app
- API: https://roven.finance/api/opportunities
- Security model: https://roven.finance/security
- Methodology: https://roven.finance/methodology
