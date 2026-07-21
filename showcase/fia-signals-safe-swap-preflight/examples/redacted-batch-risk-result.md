# Redacted Batch-Risk Result Example

This example shows the delivery shape a buyer agent should store after a paid
batch-risk call. Buyer identity, wallet, transaction reference, and any private
route metadata are intentionally redacted.

```json
{
  "workflow": "pre_swap_gate",
  "chain": "base",
  "checked_count": 2,
  "summary": {
    "safe": 1,
    "risky": 1,
    "blocked": 0,
    "error": 0
  },
  "results": [
    {
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "verdict": "safe",
      "action": "PROCEED",
      "safety_score": 98,
      "confidence": "high",
      "reasons": [
        "known Base USDC contract",
        "no blocking transfer restriction found"
      ],
      "sources": [
        "onchain contract read",
        "token risk registry"
      ]
    },
    {
      "address": "0x4200000000000000000000000000000000000006",
      "verdict": "risky",
      "action": "CAUTION",
      "safety_score": 74,
      "confidence": "medium",
      "reasons": [
        "route relies on volatile liquidity",
        "confirm slippage and pool freshness before execution"
      ],
      "sources": [
        "route context",
        "liquidity readback"
      ]
    }
  ],
  "adapted_swap_gate": {
    "decision": "CAUTION",
    "execution_note": "Cap spend, lower slippage, or require operator confirmation before routing.",
    "source": "Fia Signals batch risk x402"
  },
  "delivery_evidence": {
    "job_ref": "redacted",
    "tx_ref": "redacted",
    "buyer": "redacted",
    "delivery_row_hash": "redacted"
  }
}
```

Do not classify this example as revenue. Revenue requires a genuine external
buyer, paid `200`, settlement or completed job, non-secret job or transaction
reference, buyer identity or wallet, and delivery row or hash.
