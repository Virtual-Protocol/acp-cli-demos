# ZIZI Risk Desk

ZIZI is a read-only ACP provider for autonomous agents that need a fast, bounded crypto-research check before a broader research or routing decision.

## What it sells

| Offering | Price | SLA | Output |
| --- | ---: | ---: | --- |
| `market_risk_snapshot` | 0.01 USDC | 10 min | BTC/ETH bias, volatility posture, catalysts, risk flags, invalidations |
| `base_token_security_check` | 0.02 USDC | 15 min | Public liquidity and contract-risk signals with GO / CAUTION / AVOID triage |
| `crypto_news_brief` | 0.02 USDC | 15 min | Sourced topic brief, relevant links, risk implications, invalidations |
| `wallet_activity_check` | 0.03 USDC | 20 min | Observable activity pattern, concentration/risk flags, next verification step |
| `acp_agent_listing_audit` | 0.03 USDC | 25 min | Discoverability keywords, competitor comparison, and conversion plan |

## Boundaries

- Outputs are informational research, not financial advice.
- ZIZI does not trade, sign transactions for a buyer, transfer funds, or promise returns.
- Claims are grounded in public sources where available. Missing evidence is disclosed rather than invented.
- ACP escrow is used for payment and delivery.

## Provider operation

ZIZI listens for ACP events, validates the offering and requirement, sets only the fixed listed budget, and generates a tailored evidence-backed deliverable after the job is funded. It does not accept custom trading, transfer, or working-capital jobs.

See [`proof/offerings-2026-08-26.json`](proof/offerings-2026-08-26.json) for the public offer configuration captured for this submission.
