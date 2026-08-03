# SKILL: agentoracle-signed-receipt

## When to use

When an ACP transaction outcome needs to be independently verifiable
later — settlement dispute resolution, audit trail requirement,
cross-party attestation, examiner compliance record, or any case where
two agents may need to agree on what happened without either side
being trusted.

Use for any ACP interaction where the settled evidence needs to
outlive the current session: paid delivery of a task, agent-to-agent
service completion, model output attestation, on-chain-adjacent
records that regulators will ask about later.

## When NOT to use

Do not use for anything the settlement rail already proves. If the
transaction is fully on-chain and the settlement event itself is the
evidence, an additional signed receipt is redundant.

Do not use to "prove" an agent's private reasoning. This skill signs
a receipt over a public, verifiable claim about the transaction — not
over the agent's internal state.

Do not use if the outcome is disputed at the moment of signing. This
skill produces a signed record of what one issuer decided at the time.
Adversarial evidence handling is a separate flow.

## Inputs, tools, credentials, and preconditions

**Inputs required:**

- `claim`: the exact text of what is being asserted about the
  transaction. This is what the receipt content-addresses via
  `subject.claim_hash`.
- `skill`: a stable identifier for the ruleset that produced the
  claim. Content-addressed via `subject.skill_hash`.
- `v_gate`: the caller's already-computed decision result — verdict
  (`act` or `halt`), confidence, threshold, adversarial result,
  recommendation.

**Tools:**

- `POST https://agentoracle-gateway-main-39fa17e.zuplo.app/v1/compose`
  — issue the signed receipt. API key required
  (`Authorization: Bearer <key>`), $99/month self-serve at
  https://agentoracle.co/register, 100 requests/hour/key.
- `pip install agentoracle-receipt-verify` — offline reference
  verifier. Zero dependencies beyond stdlib and `cryptography`.
- The public JWKS at https://agentoracle.co/.well-known/jwks.json
  — fetched once, cacheable forever, used to verify any receipt.

**Credentials:**

- AgentOracle API key for the paid issuance rail
  (`$99/mo self-serve` or `x402 pay-per-call` at $0.09 per verification
  through `POST /evaluate`).
- No credential needed for verification — verifiers verify offline
  against the published public keys.

**Preconditions:**

- Caller has computed a `v_gate` result. This skill signs a decision;
  it does not run the underlying check. For a rail that runs the
  check *and* signs, use `POST /evaluate` on the same base URL.

## Approval gates

- **Spending gate:** issuing a receipt through `POST /v1/compose`
  requires a paid API key. Verification is free (offline).
- **Posting gate:** none — issued receipts are private to the caller
  until the caller chooses to share.
- **Deployment gate:** production keys are minted by Stripe webhook
  on `checkout.session.completed`. Rotate via Stripe Dashboard.

## Stop conditions and handoff rules

- If verification fails on any of the three checks
  (`canonical_recomputes`, `canonical_matches_claimed`,
  `all_signatures_verified`), **stop** — do not treat the transaction
  as settled evidence. Escalate to the counterparty and to the issuer
  before continuing.
- If `v_gate.verdict = "halt"` in the receipt, **stop** — do not act
  on the underlying claim, even if some other axis reads well. Halt
  is the model saying the claim did not meet the ruleset's threshold
  under adversarial checking. Retain the receipt as evidence of the
  halt decision.
- If the `kid` in the receipt's protected header is not present in
  the current JWKS, **stop** — that either indicates a rotation the
  verifier did not update through, or a receipt issued by a key that
  is no longer trusted. Reach out to the issuer for the retired-key
  JWKS mirror.

## Validation checks and output contract

**Validation performed by `verify.py` (or the PyPI verifier directly):**

1. `canonical_recomputes` — the base64url-decoded payload
   canonicalizes back to the same JCS bytes.
2. `canonical_matches_claimed` — the `sha256` of the canonical bytes
   matches any claimed canonical hash carried alongside the receipt.
3. `all_signatures_verified` — every entry in `signatures[]` verifies
   as an Ed25519 signature over `<protected>.<payload>` against the
   JWK identified by that signature's `kid` in the JWKS.

**Output contract:**

- **Envelope kind:** `verification.v0.3+composed`
- **Envelope format:** JWS General Serialization (RFC 7515 §7.2.1)
  with one or more signatures. Single-signer for
  `POST /v1/compose` output; downstream aggregators
  (AgentTrust, Presidio) can append their signatures without
  reformatting.
- **Protected header `typ`:**
  `application/vnd.verification.v0.3+composed+jws`
- **Signing algorithm:** EdDSA (Ed25519, RFC 8032)
- **Canonicalization:** RFC 8785 JCS
- **Payload fields:** `composed_decision`, `composed_decision_rule`,
  `envelope_kind`, `receipt_version`, `signature_meta`, `subject`
  (`claim_hash` + `skill_hash`), `v_gate` (issuer, mapping_id,
  mapping_hash, verdict, confidence, threshold, adversarial_result,
  recommendation).

The receipt is content-addressed — the same inputs produce byte-identical
canonical bytes and thus identical `canonical_sha256`. This is the
property that makes it a settlement-grade tiebreaker: two parties who
each retain the receipt can independently derive its identity and
verify its signature without trusting AgentOracle infrastructure.

## References

- Receipt format specification (IETF Internet-Draft):
  https://datatracker.ietf.org/doc/draft-krausz-verification-state
- Open draft under review — v0.4 (sealed evidence + multi-clock anchors),
  not part of this demo's shipped envelope. Pointer only:
  https://github.com/TKCollective/agentoracle-receipt-spec/pull/5
- PyPI reference verifier:
  https://pypi.org/project/agentoracle-receipt-verify/
- Whitepaper: https://agentoracle.co/whitepaper
- Changelog: https://agentoracle.co/changelog
