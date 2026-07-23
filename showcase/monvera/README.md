# Monvera - an accountable AI broker

An AI broker for real tokenized stocks and funds on Robinhood Chain. You tell Vera, its
AI agent, a goal in plain words; she builds a diversified basket of real companies (Apple,
Nvidia, the S&P 500, US Treasuries), each with a one-line reason and a plain read on the
risk, and invests it in one tap. Gasless, non-custodial, and a single stock starts at a dollar.

Live at [monvera.best](https://monvera.best) · Docs at [docs.monvera.best](https://docs.monvera.best)

## What Virtuals / EconomyOS made possible

- **ACP seller** - Vera is live on the ACP marketplace as [Vera by Monvera](https://app.virtuals.io/acp/agent/019f619c-6f1a-7768-b2c3-1b5f7b8a340d): seven analysis services any agent can hire, $0.03 to $0.15 per job, settled in USDG escrow on Robinhood Chain. Smoke-tested with real escrow: eight paid jobs, each funded and completed on-chain in under 30 seconds, and a ninth since. [Escrow payouts on Blockscout](https://robinhoodchain.blockscout.com/address/0xb87f5a74267ca3f9512b8511b32ccd804ea3707e?tab=token_transfers) - payouts are net of the ACP platform fee, so a $0.03 job settles 0.027 USDG.
- **Identity** - Vera's ERC-8004 identity (agent `58228` in the registry at `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` on Base) was registered **via Virtuals ACP** and is served from her agent card at [`/.well-known/agent-card.json`](https://monvera.best/.well-known/agent-card.json).
- **Agent Wallet** - the seller runs on Vera's ACP agent wallet `0xb87f5a74267ca3f9512b8511b32ccd804ea3707e`; every job settles to it in USDG escrow on Robinhood Chain.
- **Token** - [$MONVERA](https://app.virtuals.io/virtuals/105667) launched through Virtuals on Robinhood Chain.
- **Inference** - Virtuals-hosted inference builds every plan Vera proposes.

## Why it belongs in the Showcase

Most "AI investing" is a black box. Monvera makes the AI accountable: a verifiable agent
identity plus an append-only on-chain record of the risk assessment Vera signed for each plan
that is actually invested. Anyone can recover the signer of a recorded assessment and confirm
it against her identity. The signature binds the plan id, the assessed risk, the ceiling and
the expiry; the recommendation hash, the wallet and the spend figures recorded alongside it
are submitted by the app, not signed by Vera's key. Every trust claim resolves to something a
skeptic can open.

## Proof

- **Hire Vera on ACP:** https://app.virtuals.io/acp/agent/019f619c-6f1a-7768-b2c3-1b5f7b8a340d
- **ACP listing docs (offerings, prices, requirement shapes):** https://docs.monvera.best/dev/vera-on-virtuals-acp/
- **Promo video (1:00):** https://x.com/monvera_best/status/2074487457505268213
- **Live agent card (identity):** https://monvera.best/.well-known/agent-card.json
- **A signed plan recorded on-chain:** https://robinhoodchain.blockscout.com/tx/0x7ad119f916e1f6daff7d54429ea35ffe81c988730c534b176dcc2f9660cf45d6
- **Redacted result report:** [`examples/result-redacted.md`](examples/result-redacted.md)
- **Reproducible verification recipe:** https://docs.monvera.best/dev/verify-vera/

## Reusable skill

[`skills/accountable-onchain-agent`](skills/accountable-onchain-agent/SKILL.md) - the pattern
behind Monvera, generalized: give an AI agent an ERC-8004 identity, EIP-712 sign a structured
assessment of each output, and record the signature on-chain against the action it justifies,
so anyone can recover the signer and confirm it. See also [`soul.md`](soul.md) for
Vera's public context.

## Primitives

Agent Wallet, ACP offerings, and the $MONVERA token launch, all via Virtuals.

## Builder

[@Magicianafk](https://x.com/Magicianafk) · [github.com/Magicianhax/monvera](https://github.com/Magicianhax/monvera) · [@monvera_best](https://x.com/monvera_best)
