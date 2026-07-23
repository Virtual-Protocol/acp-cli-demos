# Botanary proof index

Public, inspectable evidence for the Botanary showcase, with the private/public
boundary stated.

## Live on mainnet (basic tier)
- Testnet transactions (deploys, grant, delegated action, revoke, freeze): [`testnet-tx.md`](testnet-tx.md)
- Source: https://github.com/Botanary (fe, be, contracts)

## Agentic + guardrail (testnet-validated)
- Guarded-spend decisions reproduced from the AgentGuard test suite: [`../skills/botanary-guarded-agent-spend/examples/guarded-spend-decisions.md`](../skills/botanary-guarded-agent-spend/examples/guarded-spend-decisions.md)
- Public contracts + 88-test suite (fuzz, invariant, compromise, fork): https://github.com/Botanary/botanary-contracts
- Optional harness clip (testnet UI): `../assets/harness.gif` (only if recorded)

## Public / private boundary
- Published: transaction hashes, addresses, the app source, the contracts, the tests.
- Never published: private keys, seed phrases, session-key secrets, API keys,
  OTPs, or the backend .env. The backend holds no keys by design.
