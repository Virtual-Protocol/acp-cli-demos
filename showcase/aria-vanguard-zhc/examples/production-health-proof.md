# Proof — production deployment (Aria Vanguard ZHC)

Public deployment surface funded and operated as part of the Spark shipping milestone.

## Live endpoints

| Surface | URL |
| --- | --- |
| Marketing site | https://ariavanguardzhc.com |
| API health | https://api.ariavanguardzhc.com/api/health |
| ACP hire | https://app.virtuals.io/acp/agents |
| Builder showcase repo | https://github.com/GoldenFarFR/aria-acp-showcase |
| Product monorepo | https://github.com/GoldenFarFR/ARIA |

## Agent identity (public)

| Field | Value |
| --- | --- |
| Name | Aria Vanguard ZHC |
| Agent ID | `019f0522-b57b-7e8e-a70a-aab2070e070e` |
| Wallet (Base) | `0xd752a325433f4d55c5e0b125be84845d7de47bb3` |
| X | [@Aria_ZHC](https://x.com/Aria_ZHC) |

## EconomyOS compute (Spark)

| Field | Value |
| --- | --- |
| Endpoint | `https://compute.virtuals.io/v1` |
| Program | Virtuals Spark discretionary credits |
| Usage | `aria-core` LLM inference + autonomous operator sessions |

Inference routing is configured in the private operator repo; only the public endpoint and program name are listed here.

## Expected health response shape

```json
{
  "status": "ok",
  "service": "aria-vanguard-api"
}
```

Verify after deploy:

```bash
curl -sS https://api.ariavanguardzhc.com/api/health
```

## What this proves for Showcase

- Spark credits support **running** infrastructure, not idle experimentation.
- The agent has a public hire surface (ACP), a product site, and inspectable API health.
- Deliverables are defined in versioned offerings JSON committed in this package.

## Redaction note

Render service ids, vault paths, API keys, and `aria-ops` deploy scripts are intentionally excluded.