---
name: elizawc-worldcup-read
description: Turn one Polymarket market's live facts into a single grounded read through the EconomyOS compute endpoint.
version: 1.0.0
---

# elizaWC World Cup Read

Use this skill when you already have the live facts for **one** prediction
market (mid, last, spread, 24h change, 7-day range, a signal label, a backtest
hit rate, and a confidence tier) and you want a single, grounded, human sentence
that explains the edge or the risk.

Do not use it to fetch market data, to place or size trades, to manage a wallet,
or to make a prediction about the real-world outcome. It reads the numbers you
give it; it does not forecast results.

## Preconditions

- An EconomyOS compute account with a positive compute balance. The call is
  billed per request (about $0.001 for one read).
- `VIRTUALS_API_KEY` available in the environment. Never place the key in
  prompts, logs, proof files, or committed code.
- Base URL `https://compute.virtuals.io/v1` (OpenAI-compatible Chat Completions).
- The caller has already gathered the market facts from its own data source.

## Inputs

A single JSON object of real numbers for one market outcome:

```json
{
  "outcome": "7+ matches",
  "event": "No. of Matches Decided by Penalty Shootout",
  "mid_cents": 14.2,
  "last_cents": 14.0,
  "spread_cents": 0.5,
  "chg_24h_cents": 10.7,
  "vol_24h_usd": 2000,
  "liquidity_usd": 8500,
  "week_range_cents": "3.7-39.0c",
  "signal": "MOMENTUM UP",
  "backtest": { "setups": 8, "outcome": "held", "hit_pct": 0, "avg_move_cents": -7.9 },
  "confidence": "LOW"
}
```

Every field must come from real data. Do not fill gaps with guesses; pass
`null` for anything you do not have.

## Call

```bash
curl https://compute.virtuals.io/v1/chat/completions \
  -H "Authorization: Bearer $VIRTUALS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moonshotai/kimi-k2",
    "max_tokens": 200,
    "temperature": 0.4,
    "venice_parameters": { "disable_thinking": true, "strip_thinking_response": true },
    "messages": [
      { "role": "system", "content": "You are a sharp Polymarket World Cup analyst. You get REAL live data for ONE market outcome. Write ONE tight sentence (max 34 words) on what is happening and the edge or risk for a trader. STRICT: use ONLY the numbers given; never invent prices, news, injuries, form, or results; no financial advice; plain text, no markdown, no emojis." },
      { "role": "user", "content": "<the JSON object above>" }
    ]
  }'
```

`venice_parameters` keeps the model's chain-of-thought out of the answer so the
`content` field is a clean one-liner.

## Grounding gates

- The system prompt is the guardrail: the model may use only the supplied
  numbers. Never relax it to allow prices, news, injuries, form, or results.
- If the backtest is weak (low hit rate, adverse average move), the read must
  say so. Do not rewrite a cautious read into a bullish one.
- Do not present the sentence as financial advice or a guaranteed outcome.

## Spend gate

- This call costs money. Only run it when a read is actually going to be shown.
- Cache by market for a short window (elizaWC uses ~90 seconds) so refreshes do
  not re-bill every time.

## Stop conditions

- Stop if `VIRTUALS_API_KEY` is missing or the compute balance is exhausted
  (HTTP 402): fall back to a deterministic template built from the same numbers,
  do not block the card.
- Stop if the response `content` is empty: fall back, do not ship a blank read.
- Stop if the returned sentence names a price, result, or fact not present in
  the input: discard it and fall back.

## Output contract

Return a single plain-text sentence (<= 34 words) grounded in the input numbers,
plus the `model` and `cost` from the response for accounting. On any failure,
return the deterministic fallback instead of an error.
