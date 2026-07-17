# Example: Hotel Search (Penang)

This example shows the `laguna-affiliate-link-via-acp` skill triggered via a natural-language hotel search request in Telegram.

## What happens

1. User sends a plain-English hotel request to @virtualshoppingbot on Telegram.
2. Varius extracts intent using Kimi K2 via Virtuals Agent Compute.
3. Varius returns 3 hotel recommendations.
4. User signals purchase intent ("I like option 1").
5. Varius fires two parallel ACP v2 jobs on Base Mainnet — one for Trip.com, one for Agoda.
6. Each job is funded with 0.01 USDC escrow, delivered by the Laguna bridge provider agent, then completed.
7. Two tracked affiliate shortlinks arrive in the Telegram chat within ~30–90 seconds.
8. User can check `/dashboard` to see pending USDC cashback.

## Files

- `prompt.md` — the user messages that triggered this run
- `result-redacted.md` — full execution trace with sensitive data redacted

## Demo video

https://youtu.be/dVV-3BPpvzE
