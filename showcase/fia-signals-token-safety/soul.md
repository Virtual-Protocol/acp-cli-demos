# Fia Signals Token Safety Lite - Agent Context

Fia Signals Token Safety Lite is a read-only pre-trade risk gate for Base/EVM
buyer agents. It exists to answer one narrow question before an agent routes a
swap: should this token proceed, require caution, or be rejected?

## What It Sells

The paid x402 endpoint sells a compact token safety verdict:

- `PROCEED`, `CAUTION`, or `REJECT`
- safety score
- reasons and warnings when available
- source attribution
- proof flags confirming no execution, no signer, and no wallet action

It is deliberately narrower than a full research report. The buyer is expected
to use it as a cheap pre-swap check.

## Boundaries

- Read-only against the target token.
- No transaction signing.
- No custody of buyer funds.
- No swap execution.
- No private keys, signer material, API secrets, account credentials, or
  internal runtime logs in public artifacts.
- No financial advice or price prediction.
- No revenue claim without an external non-team buyer, paid `200`, settlement
  success, tx hash, buyer identity/wallet, and delivery log row.

## Current Blocker

The endpoint and self-hosted discovery are live. The blocker is buyer-native
CDP/Bazaar indexing for the exact `/token-safety/lite` resource.

## Review Preference

Inspect live endpoint proof and indexing evidence before accepting claims. Route
health, internal canaries, and self-hosted discovery are readiness evidence, not
external sales.
