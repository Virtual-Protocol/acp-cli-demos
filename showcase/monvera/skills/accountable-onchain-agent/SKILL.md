---
name: accountable-onchain-agent
description: Make an AI agent's outputs verifiable and tamper-evident by giving the agent an on-chain identity, having it EIP-712 sign a structured assessment of each output, and recording that signature on-chain in the same transaction as the action it justifies. Use when a skeptic should be able to confirm the agent authored a specific output and that the record cannot be edited afterward.
---

# Accountable On-Chain Agent

## Overview

This skill turns an AI agent's outputs into a verifiable, uneditable on-chain record. The
agent gets a verifiable identity (an ERC-8004 registration, for example via Virtuals ACP),
signs a structured claim about each output with its own key (EIP-712), and that signature is
verified and written on-chain in the same transaction as the action it justifies. Anyone can
later read the agent's identity, recover the signer of a recorded claim, and confirm they
match. It proves authorship and integrity, not correctness.

Monvera runs this pattern in production: Vera (agent #1) signs a `RiskInference` assessment of
each investment plan, and the signature is verified and recorded by the `VeraRecord` contract
in the same transaction that buys the stocks.

## When to use

- You want an agent's recommendations, decisions, or assessments to be independently verifiable.
- You need a tamper-evident track record: "the agent said X at time T, and it cannot be edited."
- The agent's action already touches a chain (a trade, a payment, a mint), so recording is cheap to batch.

## When not to use

- The output needs no third-party verification (internal-only tooling).
- There is no on-chain action to batch the record with, and a standalone write is not worth it.
- You need to prove the recommendation is correct or profitable. This proves authorship and integrity, not outcome.

## Required inputs, tools, credentials, preconditions

- An agent signing key, kept server-side and never exposed. Its address is the agent's `agentSigner`.
- An ERC-8004 identity for the agent (an Identity Registry entry; Virtuals ACP can register one). Note the `agentId` and registry address.
- A verify-and-record contract on your target chain that recovers the EIP-712 signer, checks it equals the trusted `agentSigner`, enforces bounds, stores the record, and reverts if any check fails. Monvera's is `VeraRecord`.
- A minimal, meaningful EIP-712 typed struct to sign (the claim schema).
- An account-abstraction / batching path (for example ERC-4337) so the record and the action land in one transaction.

## Step-by-step workflow

1. Define the claim. Choose the smallest struct that captures the agent's assessment. Monvera uses `RiskInference(bytes32 planId, uint16 assessedRisk, uint16 maxRisk, uint256 expiry)`.
2. Register the agent identity. Register the agent in an ERC-8004 Identity Registry (via Virtuals ACP or directly). Record `agentId` and the registry address, and publish an agent card at `/.well-known/agent-card.json`.
3. Sign server-side. When the agent produces an output, EIP-712-sign the claim with the agent signing key under a fixed domain `{name, version, chainId, verifyingContract}`.
4. Verify and record on-chain, atomically. In the same transaction as the action, call the verify-and-record contract with the claim plus signature. It recovers the signer, asserts `recovered == agentSigner`, enforces bounds (for example `assessedRisk <= maxRisk`) and expiry, then stores the record. If any check fails, the whole transaction reverts, so an action can never be recorded with an invalid or unauthorized claim.
5. Expose a read path. Provide an endpoint or a docs recipe so anyone can fetch a recorded claim, recover its signer, and compare it to `agentSigner()` and the agent's identity.

## Approval gates

- The user, not the agent, signs the value-moving step (the trade or payment). The agent's signature only attests to its own assessment. Keep the two signatures separate and never conflate them.
- Bounds are enforced on-chain (for example a risk ceiling the agent cannot exceed), not only in the UI.

## Stop conditions

- Stop if the recovered signer does not equal the expected `agentSigner` (the record would be rejected on-chain anyway).
- Stop if the claim is expired or exceeds its declared bounds.
- Stop if the identity registration cannot be confirmed on-chain.

## Evidence and redaction rules

- Evidence to keep (all public): the agent card URL, the on-chain record transaction (explorer link), the signed struct plus recovered signer, and the identity registry entry.
- Redact: the agent signing key, any user private keys, session-signer secrets, and provider API keys. Never include them in code, logs, or reports.

## Validation checklist

- [ ] The agent card resolves and lists the identity registry and `agentSigner`.
- [ ] A recorded claim's recovered signer equals `agentSigner()` read live on-chain.
- [ ] The verify-and-record contract reverts on a bad signer, an out-of-bounds claim, and an expired claim.
- [ ] The record and the action share one transaction (atomic).
- [ ] No secrets appear anywhere in the package.

## Output contract

- On-chain: one record event per output (for example `RecommendationCommitted(planId, user, recHash, riskScore, agentId)`), emitted in the same transaction as the action.
- Off-chain: a read endpoint returning the recorded claim, its signature, the recovered signer, the `agentId`, and the identity registry, so a third party can reproduce the check.

## Worked example (Monvera)

- Identity: Vera is agent #1 in Monvera's Identity Registry `0x751ae640cfa816404b017fbb8234dd21abafbbdc` (chain 4663), canonical ERC-8004 identity `8453:58228` on Base via Virtuals ACP. Agent card: https://monvera.best/.well-known/agent-card.json
- Contract: `VeraRecord` at `0x7ff1a5ee19330c165146488a7ad8af6cb41da1df`, EIP-712 domain `{ name: "VeraRecord", version: "1", chainId: 4663 }`.
- A recorded plan on Blockscout: https://robinhoodchain.blockscout.com/tx/0x7ad119f916e1f6daff7d54429ea35ffe81c988730c534b176dcc2f9660cf45d6
- Reproducible verification recipe: https://docs.monvera.best/dev/verify-vera/
