# Botanary - The Financial OS for AI agents

Botanary is a self-custodial ERC-7579 / ERC-4337 smart wallet that gives an AI
agent three things a payment API cannot: an on-chain **identity**, a **treasury**
it controls, and a **guardrail** that makes autonomy safe. The backend never
holds keys and never signs. Every fund-moving or authority-granting action is
build, sign client-side, then relay, so a full backend compromise can fail to
availability, never to authority.

## The three layers

1. **Identity + wallet.** The ERC-7579 Kernel account is the agent's on-chain
   identity and treasury. Self-custodial, recoverable via guardians.
2. **Guardrail + delegation.** AgentGuard is an on-chain ERC-7579 hook that
   enforces spend caps, a recipient allowlist, a per-action max, a rolling-window
   cap, an instant kill-switch, and a tamper-evident audit trail. The owner
   grants a session-key mandate bounded by budget, per-action max, recipients,
   venues, and expiry, and can freeze or revoke it in one op.
3. **Agentic.** The agent uses that bounded authority to act: send, swap, and
   hire other agents through ACP, where a Botanary Kernel account is the ACP
   client and the hire is an arg-gated, budget-capped, provider-pinned on-chain op.

## What is live vs validated (honest boundary)

- **Live on 19 mainnets today (basic tier, owner-signed):** send, swap (LI.FI),
  portfolio, account freeze / kill-switch, gas paid in native / USDC / USDT,
  and a read-only catalog of 96 tokenized stocks on Robinhood Chain.
- **Validated on testnet (Base Sepolia, Arbitrum Sepolia, Robinhood testnet):**
  delegation, AgentGuard enforcement, the MandateExecutor, the AuditAnchor, and
  the ACP-hire mandate. Proven by an 88-test suite that includes fuzz, invariant,
  compromise, and mainnet-fork tests. Not yet deployed to mainnet.

This card does not claim a live ACP listing or a funded ACP job. The `acp`
primitive refers to Botanary's on-chain ACP-hire mandate construction, which is
implemented in code and validated on testnet.

## Proof

- Docs: https://docs.botanary.xyz
- Source: https://github.com/Botanary (fe, be, contracts)
- Product screenshots (testnet, captured from the live app): [`grant-delegation.png`](assets/screenshots/grant-delegation.png) (grant a bounded delegation: spending cap, per-action max, allowlisted recipients, expiry); [`send-usdc-gas.png`](assets/screenshots/send-usdc-gas.png) (bounded send, gas paid in USDC); [`markets-agents.png`](assets/screenshots/markets-agents.png) (agents marketplace); [`token-detail.png`](assets/screenshots/token-detail.png) (token market detail).
- Public contracts and 88-test suite (fuzz, invariant, compromise, fork): https://github.com/Botanary/botanary-contracts
- Guarded-spend decisions, reproduced from the public AgentGuard test suite: [`skills/botanary-guarded-agent-spend/examples/guarded-spend-decisions.md`](skills/botanary-guarded-agent-spend/examples/guarded-spend-decisions.md)
- Real testnet transactions (contract deploys, grant, delegated action, revoke, freeze): [`proof/testnet-tx.md`](proof/testnet-tx.md)
- Reusable skill: [`skills/botanary-guarded-agent-spend`](skills/botanary-guarded-agent-spend)
- Agent constitution: [`soul.md`](soul.md)

The Botanary app is in private waitlist, so this card links the public docs,
source, and on-chain proof rather than the gated app.
