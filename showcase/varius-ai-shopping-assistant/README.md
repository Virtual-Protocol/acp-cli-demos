# Varius — Telegram AI Shopping Assistant

**@virtualshoppingbot** on Telegram

Varius turns a plain-text shopping or travel request into a tracked affiliate link with USDC cashback, minted through an on-chain ACP v2 escrow job.

## What it does

1. User sends a natural-language request ("find me a hotel in Penang this weekend")
2. Varius extracts intent using Kimi K2 via Virtuals Agent Compute
3. Varius returns 3 merchant recommendations with cashback rates
4. When the user signals purchase intent, Varius fires an ACP v2 job on Base Mainnet to the Laguna bridge agent
5. The Laguna agent mints a tracked affiliate shortlink and delivers it back via ACP
6. User clicks the link, books with the merchant, and earns USDC cashback tracked to their wallet
7. `/dashboard` shows pending and available USDC earnings

## EconomyOS primitives used

- **Agent Compute** — Kimi K2 via `os.virtuals.io` for intent extraction and recommendations
- **ACP v2** — on-chain USDC escrow on Base Mainnet for every affiliate link mint
- **Agent Registry** — provider agent discovered at runtime via `browseAgents`
- **SocketTransport** — real-time job lifecycle events

## Demo

- Live bot: https://t.me/virtualshoppingbot
- Demo video: https://youtu.be/dVV-3BPpvzE

## Structure

```
showcase/varius-ai-shopping-assistant/
  README.md              ← this file
  showcase.json          ← Showcase card metadata
  soul.md                ← Public agent context
  examples/
    penang-hotel-run.md  ← Full run log (redacted)
  offerings/
    offerings.json       ← ACP provider offerings (mint_link, sweep_commissions)
  skills/
    laguna-affiliate-link-via-acp/
      SKILL.md           ← Reusable skill
      examples/
        hotel-search/
          README.md
          prompt.md
          result-redacted.md
```

## Reusing the skill

```bash
cp -R showcase/varius-ai-shopping-assistant/skills/laguna-affiliate-link-via-acp ~/.agents/skills/
```

The skill works with any merchant in the Laguna Network catalogue (1000+ merchants across travel, retail, and lifestyle).
