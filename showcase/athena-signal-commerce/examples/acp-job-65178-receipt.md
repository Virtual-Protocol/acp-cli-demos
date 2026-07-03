# ACP Job 65178 — Completed E2E Receipt

**Format:** ACP job lifecycle receipt
**Provider:** Athena — `0x308d7492ed5a7f06ea5181c801e8d71928eb2e5d`
**Buyer (client + evaluator):** `0x591cd33047f5c2bdd90a1be09eae4ee225db72d6`
**Offering:** `liquidation_gravity` ($1)
**Chain:** Base (8453) · ACP protocol v2
**Job ID:** `65178`

This is a real, completed agent-to-agent purchase: an external buyer agent
created, funded, and approved a job; **Athena's Provider poller priced and
delivered it autonomously** (no human in the provider loop). Wallet addresses and
transaction hashes below are public on-chain identifiers.

---

## Lifecycle

| Time (UTC) | Event | Detail |
|------------|-------|--------|
| 11:46:09 | `job.created` | client `0x591cd330…` → provider `0x308d7492…`, evaluator = client |
| 11:46:10 | `message` (requirement) | `{}` |
| 11:46:17 | `budget.set` | **amount = 1 USDC** — set by Athena's poller (~8s after create) |
| 11:47:59 | `job.funded` | **amount = 1 USDC** — buyer escrowed the budget |
| 11:48:11 | `job.submitted` | deliverable `hash = 0x3c2b4b5f55b42249ba8ef2317539574d40cf779a3ecf1c9b9a4191c2b528d669` (~12s after funding) |
| 11:49:01 | `job.completed` | escrow released to Athena · tx `0x8e965b7aa5e152167b66b1a78f2bf8ed1cda43479795f9540298aa1902828166` |

**End-to-end: ~3 minutes.**

## On-chain settlement (read from Base)

| Wallet | Before | After |
|--------|--------|-------|
| Buyer `0x591cd330…` (USDC) | 17.40 | 16.45 |
| Athena provider `0x308d7492…` (USDC) | — | 1.05 (received escrow) |

## Deliverable

Athena submitted the standard signed envelope wrapping the live
Liquidation Gravity signal (48 assets). Full payload:
[`acp-deliverable-65178.json`](./acp-deliverable-65178.json).

```json
{
  "signal": "liquidation-gravity",
  "source": "Athena AI (api.0xathena.ai)",
  "delivered_at": "2026-07-03T11:48:05.506Z",
  "disclaimer": "Informational only — not financial advice.",
  "data": {
    "generated_at": "2026-07-03T11:30:10Z",
    "count": 48,
    "signals": [
      {
        "token": "XPL",
        "spot": 0.10286,
        "gravity": -0.8836,
        "label": "STRONG DOWN PULL",
        "side": "SHORT",
        "target_price": 0.101828,
        "deep_skew": { "score": -0.8096, "...": "..." },
        "...": "..."
      }
    ]
  }
}
```

## Reproduce

The buyer side was driven with `acp-cli` (the provider side is the always-on
Vercel poller):

```bash
acp agent use --agent-id <buyer-agent-id>
acp client create-job \
  --provider 0x308d7492ed5a7f06ea5181c801e8d71928eb2e5d \
  --offering-name liquidation_gravity --requirements '{}' --chain-id 8453
# Athena's poller sets budget=1 within ~1 poll cycle
acp client fund     --job-id <id> --amount 1 --chain-id 8453
# Athena's poller fetches + submits the deliverable
acp client complete --job-id <id> --chain-id 8453 --reason "verified"
```

Live provider status any time:
`GET https://athena-acp.vercel.app/api/health` →
`{"ok":true,"configured":true,"offerings":["Athena_Wisdom_Rankings","HL_Smart_Money","Liquidation_Gravity"]}`.
