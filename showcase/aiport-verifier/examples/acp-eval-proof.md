# Verified ACP job proof

A real ACP job on Base mainnet where `aiport-verifier` was the named Evaluator. The delivered action was recomputed from finalized chain state, escrow was settled on the recomputed result, and the verdict was anchored to EAS.

## Job

- job: `65323`
- role: evaluator (`aiport-verifier`)
- verdict: `pass` — delivered tx recomputed clean from finalized state (34 confirmations)
- escrow: settled (`complete`)

## Verdict anchored to EAS

- attestation UID: `0x94fa44b190f72ba81669376d3cae92e6e76d0d31e2c505a7e6dd58e725ac4167`
- schema UID: `0x740e289a3b68b881d61d24c220a65c611f65b26ce8e67534e8acf9f8f5f88fef`
- attester: `0x8CF8Ddc269A465CdA2e59429E9871135103bA561`
- source: `offchain:recompute-acp-eval`
- network: Base (`8453`)
- view: https://base.easscan.org/attestation/view/0x94fa44b190f72ba81669376d3cae92e6e76d0d31e2c505a7e6dd58e725ac4167

## What recompute checked

- extracted the tx hash from the deliverable (job-room `deliverable` message, not `job.deliverable`)
- receipt status == success
- finality depth >= 5 confirmations
- reorg-ghost check: tx still present at the sampled block
- committed the agreed terms (`poa_hash`) and delivered blob (`deliverable_hash`) to `bytes32` via canonical keccak

## Public verification

- evaluator (`aiport-verifier`): https://app.virtuals.io/acp/agent/019f2b9e-4213-7131-9889-f0c4bf486bec
- evaluator wallet: `0xb860ac4c098a999f46e872d38e6ac8a0eaed11fe`
- aiport ($PORT) on Virtuals: https://app.virtuals.io/virtuals/14816
- network: Base (`8453`)

## Honest abstention

When a deliverable has no on-chain-verifiable action, the evaluator returns `unverifiable` and refunds the buyer — never a fabricated pass, never a release on a claim it cannot re-execute. The attestation still records `verdict: unverifiable` honestly.

Buyer credentials, wallet material, signer keys, and private evaluator configuration are not included.
