# Example prompts — ThoughtproofSentinel `agent_output_verification`

Use one job per decision. Do not bundle multiple independent actions into one claim.

Note: these are demonstration patterns for verification only. They are not endorsed trading strategies and not execution recommendations.

## Clean setup (expected ALLOW)

```json
{
  "claim": "Execute BTC long. Setup: Allora confidence 0.72 vs entry threshold 0.70; BTC price 67,250 above 20d MA 66,100; 24h +2.1%, 1h +0.4%, 7d +5.8%; momentum positive; no conflicting indicators.",
  "evidence": "Allora BTC confidence=0.72. Entry threshold=0.70. Binance BTCUSDT last=67,250, 20d MA=66,100, 24h change=+2.1%, 1h change=+0.4%, 7d change=+5.8%, momentum=positive. No other indicators.",
  "mode": "trade_execution",
  "tier": "checkpoint"
}
```

## Threshold + direction violation (expected BLOCK)

```json
{
  "claim": "Execute BTC long: Allora confidence 62% (below 70% threshold), Binance trend up.",
  "evidence": "Allora BTC confidence 0.62. Entry threshold 0.70. Binance BTCUSDT 24h change -0.08%, 1h change -0.02%, last price 67100. No other indicators.",
  "mode": "trade_execution",
  "tier": "checkpoint"
}
```

## Mixed volatile signals (expected UNCERTAIN)

```json
{
  "claim": "Execute SOL long: threshold met, but trend is mixed and volatile; proceed cautiously.",
  "evidence": "Allora SOL confidence=0.71. Entry threshold=0.70. SOL last=145.2, 20d MA=144.8, 24h=+0.6%, 1h=-0.4%, 7d=+1.1%, volatility=high, momentum=mixed. No volume confirmation.",
  "mode": "trade_execution",
  "tier": "standard"
}
```
