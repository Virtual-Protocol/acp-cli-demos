# De9en — Attention Markets

De9en turns KOL attention into agent-tradable prediction markets. Each question
is a head-to-head **KOL battle** (KOL Wars): buyers take YES/NO on which creator
wins a weekly attention narrative, and the resulting odds, volume, and mindshare
ranking become a structured signal other agents can consume.

This package contributes a reusable ACP skill,
[`acp-attention-market-signal`](skills/acp-attention-market-signal/SKILL.md),
that models each market as a priced ACP offering returning one stable signed
deliverable envelope — so a provider agent can sell De9en attention/odds signals
and a buyer agent integrates once across every market.

## What's live vs. what's a reference

- **Live now:** the attention-market product at
  [de9en.fun](https://de9en.fun/dashboard) — a public dashboard, the KOL Wars
  grid, and per-market share cards.
- **Reference in this package:** the ACP rail (offerings catalog, deliverable
  envelope, provider skill, and soul). No on-chain job settlement is claimed
  here; the skill is the design contract for exposing the live market over ACP.

## Package contents

| Path | What it is |
| --- | --- |
| [`showcase.json`](showcase.json) | Showcase manifest |
| [`skills/acp-attention-market-signal/SKILL.md`](skills/acp-attention-market-signal/SKILL.md) | Reusable provider skill |
| [`offerings/offerings.json`](offerings/offerings.json) | ACP offerings catalog (one per market kind) |
| [`examples/attention-signal-envelope.json`](examples/attention-signal-envelope.json) | Redacted deliverable envelope example |
| [`soul.md`](soul.md) | Provider identity and guardrails |

## Deliverable contract

Every offering returns the same signed envelope so a buyer integrates once:

```json
{
  "signal": "kol-battle-odds",
  "market": "<market-slug>",
  "source": "de9en (de9en.fun)",
  "delivered_at": "<ISO-8601>",
  "disclaimer": "Informational only — not financial advice.",
  "data": { "question": "...", "yes": {}, "no": {}, "mindshare_rank": 0 }
}
```

## Proof

- Live dashboard: https://de9en.fun/dashboard
- Live per-market share card: https://de9en.fun/share/unipcs-vs-orangie
- Redacted deliverable: [`examples/attention-signal-envelope.json`](examples/attention-signal-envelope.json)

## Install the skill

```bash
cp -R showcase/de9en-attention-markets/skills/acp-attention-market-signal ~/.agents/skills/
cp -R showcase/de9en-attention-markets/skills/acp-attention-market-signal ~/.claude/skills/
```

## Guardrails

Read-only outputs only; the pricing engine is never shipped. Every deliverable
carries a not-financial-advice disclaimer. No credentials, signer material, or
private methodology appear in any artifact. See [`soul.md`](soul.md).
