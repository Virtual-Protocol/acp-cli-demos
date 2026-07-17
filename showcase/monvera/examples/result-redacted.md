# Redacted result: an accountable plan, recorded and verified on-chain

This report shows one real run of Monvera's accountable-AI flow on Robinhood Chain (chain
4663). Every value below is already public, either on-chain or on a public HTTP endpoint. No
secrets are included.

## The run

1. A user gave Vera a goal and an amount.
2. Vera built a diversified plan of real tokenized stocks and signed a `RiskInference`
   assessment of it with her own agent key.
3. In one transaction, the `VeraRecord` contract verified her signature and recorded the
   plan, and the trades settled.

## The record (public)

- Chain: Robinhood Chain, id `4663` (explorer: https://robinhoodchain.blockscout.com)
- VeraRecord contract: `0x7ff1a5ee19330c165146488a7ad8af6cb41da1df`
- Plan id: `0xbef518779bc7cae74e60da8e111bc7c17423b70a721b7aaa2498893a138122a7`
- Record transaction: https://robinhoodchain.blockscout.com/tx/0x7ad119f916e1f6daff7d54429ea35ffe81c988730c534b176dcc2f9660cf45d6

## Verify it yourself

1. Read Vera's agent card: https://monvera.best/.well-known/agent-card.json (note
   `agentSigner`, `identityRegistry`, and `agentId`).
2. Read `agentSigner()` live on the VeraRecord contract.
3. Pull the `RecommendationCommitted` log for the plan id above on Blockscout.
4. Recover the EIP-712 signer of the `RiskInference` payload and assert it equals
   `agentSigner()`.

Full recipe: https://docs.monvera.best/dev/verify-vera/

## Redaction

No private keys, user account data, session-signer secrets, or provider API keys are
included. Every value above is already public on-chain or on a public HTTP endpoint.
