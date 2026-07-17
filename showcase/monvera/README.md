# Monvera - an accountable AI broker

An AI broker for real tokenized stocks and funds on Robinhood Chain. You tell Vera, its
AI agent, a goal in plain words; she builds a diversified basket of real companies (Apple,
Nvidia, the S&P 500, US Treasuries), each with a one-line reason and a plain read on the
risk, and invests it in one tap. Gasless, non-custodial, from one dollar.

Live at [monvera.best](https://monvera.best) · Docs at [docs.monvera.best](https://docs.monvera.best)

## What Virtuals / EconomyOS made possible

- **Agent Card** - Vera's ERC-8004 identity (agent `58228` on Base), registered **via Virtuals ACP**. Live at [`/.well-known/agent-card.json`](https://monvera.best/.well-known/agent-card.json).
- **Agent Wallet + ACP** - the registration runs through Vera's ACP wallet. ACP registration file: [api.acp.virtuals.io/agents/019f2d81.../erc8004](https://api.acp.virtuals.io/agents/019f2d81-921d-7951-a4f7-50f9d228c47b/erc8004).
- **Inference** - Virtuals-hosted inference builds every plan Vera proposes.

## Why it belongs in the Showcase

Most "AI investing" is a black box. Monvera makes the AI accountable: a verifiable agent
identity plus a signed, on-chain, uneditable record of every recommendation. Vera signs
each plan's risk assessment with her own key, and that signature is verified and recorded
on-chain in the **same transaction** that buys the stocks, so her track record cannot be
edited afterward. Every trust claim resolves to something a skeptic can open.

## Proof

- **Promo video (1:00):** https://x.com/monvera_best/status/2074487457505268213
- **Live agent card (identity):** https://monvera.best/.well-known/agent-card.json
- **A signed plan recorded on-chain:** https://robinhoodchain.blockscout.com/tx/0x7ad119f916e1f6daff7d54429ea35ffe81c988730c534b176dcc2f9660cf45d6
- **Redacted result report:** [`examples/result-redacted.md`](examples/result-redacted.md)
- **Reproducible verification recipe:** https://docs.monvera.best/dev/verify-vera/

## Reusable skill

[`skills/accountable-onchain-agent`](skills/accountable-onchain-agent/SKILL.md) - the pattern
behind Monvera, generalized: give an AI agent an ERC-8004 identity, EIP-712 sign a structured
assessment of each output, and record the signature on-chain in the same transaction as the
action, so anyone can recover the signer and confirm it. See also [`soul.md`](soul.md) for
Vera's public context.

## Primitives

Agent Card and Agent Wallet, both via Virtuals ACP.

## Builder

[@Magicianafk](https://x.com/Magicianafk) · [github.com/Magicianhax/monvera](https://github.com/Magicianhax/monvera) · [@monvera_best](https://x.com/monvera_best)
