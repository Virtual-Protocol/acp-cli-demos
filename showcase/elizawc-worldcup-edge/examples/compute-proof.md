# Redacted EconomyOS inference proof

These are real calls made by elizaWC against the EconomyOS compute endpoint.
The API key is redacted. No wallet material or private code is included.

## Endpoint

- Base URL: `https://compute.virtuals.io/v1`
- Model: `moonshotai/kimi-k2` (served as `kimi-k2-6`)
- Auth: `Authorization: Bearer acp-****` (redacted)

## Request (one market read)

```json
{
  "model": "moonshotai/kimi-k2",
  "max_tokens": 200,
  "temperature": 0.4,
  "venice_parameters": { "disable_thinking": true, "strip_thinking_response": true },
  "messages": [
    { "role": "system", "content": "You are a sharp Polymarket World Cup analyst ... use ONLY the numbers given; never invent prices, news, injuries, form, or results ..." },
    { "role": "user", "content": "{\"outcome\":\"England\",\"event\":\"Furthest Advancing UEFA Nation\",\"mid_cents\":10.5,\"last_cents\":10.5,\"spread_cents\":1,\"chg_24h_cents\":-2.5,\"liquidity_usd\":8500,\"week_range_cents\":\"8.5-19.0c\",\"signal\":\"FADE SETUP\",\"backtest\":{\"setups\":9,\"outcome\":\"reverted\",\"hit_pct\":77,\"avg_move_cents\":2.0},\"confidence\":\"HIGH\"}" }
  ]
}
```

## Response (redacted)

```json
{
  "model": "kimi-k2-6",
  "choices": [
    {
      "index": 0,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "England at 10.5c for Furthest Advancing UEFA Nation sits near the 8.5c weekly low with a 77% historical fade rate and 2.0c average reversion, though zero 24h volume and 1c spread create execution risk on an 8500 liquidity pool."
      }
    }
  ],
  "usage": { "prompt_tokens": 1101, "completion_tokens": 65, "total_tokens": 1166 },
  "cost": { "usd": 0.00105148 }
}
```

HTTP status: `201`. The read uses only the supplied numbers (price, weekly low,
backtest hit rate, average reversion, spread, liquidity) and invents nothing.

## Second live example (honest low-confidence read)

For the "7+ matches Decided by Penalty Shootout" market (mid 14.2c, +10.7c 24h,
spread 0.5c), the backtest found 8 prior MOMENTUM UP setups that all failed
(0% hit, average -7.9c). The returned read flagged it rather than overselling:

> Penalty shootout volume surged 10.7c in 24h to 14.2c mid with thin 0.5c
> spread, but backtest shows 8 prior MOMENTUM UP setups all failed to hit and
> averaged -7.9c moves, signaling a LOW confidence trap.

## Where to verify

- Agent: https://app.virtuals.io/acp/agents/019ebfed-9b45-79e6-9946-44c6d6bf4154
- Live product: https://t.me/elizaWC_bot
- Dashboard screenshot: `../assets/economyos-compute.png` (wallet, compute
  balance, Compute Spend, inference top-up)
