---
name: aiport-verifier-skill
description: Register as the named Evaluator on an ACP job, recompute the delivered on-chain action from finalized chain state, settle escrow on the recomputed result, and anchor the verdict to EAS. Recompute-of-action instead of a trusted evaluator signature.
---

# aiport-verifier — recompute-of-action evaluator

## Overview

ACP releases escrow on a single evaluator signature. This skill fills the Evaluator slot with a verifier that re-executes instead of trusting: it reads the delivered on-chain action, recomputes it from finalized chain state, settles escrow on the recomputed result, and anchors the verdict to EAS.

## When to use

- When your wallet is named as the Evaluator on an ACP job.
- When you want settlement bound to a recomputed on-chain fact, not a trusted signature.
- When you want a portable, independently-checkable proof (an EAS attestation) for every verdict.

## Prerequisites

- `acp-cli` installed and an agent registered as an Evaluator.
- An EAS schema for the verdict (`bytes32 job_id, bytes32 poa_hash, bytes32 deliverable_hash, string verdict, uint64 sampled_block, uint64 sampled_at, string source`).
- A funded attester key, distinct from any treasury / staking / liveness key.
- An RPC endpoint for the ACP chain (Base).

## Pipeline

1. **Listen.** Open a persistent ACP event stream. Act on a session where your wallet is the named evaluator and status is `submitted`.
2. **Read the deliverable.** The delivered blob is a job-room provider message (`postDeliverable` → `AgentMessage` with contentType `deliverable`), not `job.deliverable` (indexer lag leaves that null). Extract the on-chain action (tx hash).
3. **Recompute.** From finalized chain state: confirm receipt status, enforce a finality gate (>= 5 confirmations), and run a reorg-ghost check (the tx is still present at the sampled block).
4. **Decide.** `pass` if the delivered action recomputes clean; `reject` if it recomputes to failure; `unverifiable` if there is no on-chain-verifiable action.
5. **Settle.** `complete` on `pass` (release escrow), `reject`/refund otherwise. Never release on `unverifiable`.
6. **Anchor.** Commit the agreed terms (`poa_hash`) and delivered blob (`deliverable_hash`) to `bytes32` via canonical keccak and write the verdict to EAS. Anchor failure is logged but never undoes settlement.

## Verdict semantics

| verdict | recompute result | escrow |
|---|---|---|
| `pass` | delivered action confirmed on finalized chain | released (complete) |
| `reject` | delivered action recomputes to failure | refunded to buyer |
| `unverifiable` | no on-chain-verifiable action | refunded — honest abstention |

## Notes

- Idempotency: dedupe on `(chain_id, job_id)` and guard against duplicate `entry` events with an in-flight lock so a job is never double-settled or double-anchored.
- The evaluator custodies no funds beyond the ACP escrow flow and reads finalized chain state only.
