# Example result: alpha_digest (redacted)

A representative `alpha_digest` deliverable for the input tokens ETH, BTC, KRN. Wallet addresses and any account-identifying detail are redacted; structure and field shape are unchanged.

```json
{
  "generated_at": "2026-06-2X T 0X:00:00Z",
  "market_narrative": "Base ecosystem attention concentrated on agent-commerce tokens this cycle; broad risk tone neutral-to-positive with rotation into on-chain AI names.",
  "token_signals": [
    {
      "token": "ETH",
      "price_read": "range-bound over the window",
      "volume_read": "average",
      "signal": "neutral"
    },
    {
      "token": "BTC",
      "price_read": "mild uptrend",
      "volume_read": "slightly elevated",
      "signal": "neutral-bullish"
    },
    {
      "token": "KRN",
      "price_read": "outperforming ecosystem average",
      "volume_read": "elevated",
      "signal": "bullish, watch for mean reversion"
    }
  ],
  "whale_activity": [
    {
      "wallet": "0x____REDACTED____",
      "action": "accumulation",
      "token": "KRN",
      "note": "steady adds over the window; no distribution detected"
    }
  ],
  "ranked_opportunities": [
    {
      "rank": 1,
      "thesis": "KRN momentum with confirmed on-chain accumulation",
      "risk_flag": "elevated volatility; size accordingly"
    },
    {
      "rank": 2,
      "thesis": "BTC steady bid, low-risk directional lean",
      "risk_flag": "low"
    }
  ]
}
```

This deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital. No signing authority or fund custody is ever requested by KERNAL.
