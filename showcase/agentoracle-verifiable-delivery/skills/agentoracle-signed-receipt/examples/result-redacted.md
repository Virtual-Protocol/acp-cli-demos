# Demo run — redacted result

Run captured 2026-08-03 UTC against the live AgentOracle production
gateway. All fields are the actual bytes from the run; the API key
is redacted.

## HTTP request

```
POST /v1/compose HTTP/1.1
Host: agentoracle-gateway-main-39fa17e.zuplo.app
Content-Type: application/json
Authorization: Bearer zpka_ed17********************02523b32   ← REDACTED

{
  "subject": {
    "claim_hash": "sha256-4ecb7096fdfeff23ee1ea86d8c906bf45777beb9ec6d1f039c65badfbdec037e",
    "skill_hash": "sha256-20b1be1fef665c5fe49345e5ec1bcb64ee00daf7533fc14f0e552160fbcef336"
  },
  "v_gate": {
    "verdict": "act",
    "v_confidence": 0.95,
    "v_gate_threshold": 0.7,
    "v_adversarial_result": "resilient",
    "v_recommendation": "confident_supported"
  }
}
```

## HTTP response

```
HTTP/2 200
content-type: application/json
```

Response body: the JWS General Serialization envelope committed as
`receipt.json` in this directory.

## Receipt decoded

Protected header (base64url-decoded from `signatures[0].protected`):

```json
{
  "alg": "EdDSA",
  "kid": "ao-composed-2026-07-ed25519-3d44ba27",
  "typ": "application/vnd.verification.v0.3+composed+jws"
}
```

Payload (base64url-decoded, formatted for readability):

```json
{
  "composed_decision": "act",
  "composed_decision_rule": "AND_PRESENT",
  "envelope_kind": "verification.v0.3+composed",
  "receipt_version": "0.3.0-composed",
  "signature_meta": {
    "agentoracle_jwks_url": "https://agentoracle.co/.well-known/jwks.json"
  },
  "subject": {
    "claim_hash": "sha256-4ecb7096fdfeff23ee1ea86d8c906bf45777beb9ec6d1f039c65badfbdec037e",
    "skill_hash": "sha256-20b1be1fef665c5fe49345e5ec1bcb64ee00daf7533fc14f0e552160fbcef336"
  },
  "v_gate": {
    "issuer": "agentoracle",
    "mapping_id": "agentoracle-v0.3-2026-05-30",
    "v_adversarial_result": "resilient",
    "v_confidence": 0.95,
    "v_gate_mapping_hash": "sha256-0a78263976790df6e76cd9f3f441bf5a3b5c3a82e346b5aca43e49626881d7b0",
    "v_gate_threshold": 0.7,
    "v_recommendation": "confident_supported",
    "verdict": "act"
  }
}
```

- `composed_decision: act` — the aggregated verdict.
- `subject.claim_hash` — sha256 of the exact claim text in
  `prompt.md`. Regenerable from the string; any post-hoc edit
  invalidates the signature.
- `subject.skill_hash` — sha256 of the ruleset identifier
  `acp.delivery.evidence.v1`.
- `v_gate.v_gate_mapping_hash` — sha256 of the mapping bytes on
  disk at
  https://agentoracle.co/mappings/agentoracle-v0.3-2026-05-30.json.
  Pins the recommendation table that produced the verdict.
- `v_gate.verdict: act`, `v_recommendation: confident_supported` —
  the decision resolved to act because the aggregated inputs
  satisfied rule 1 of the mapping (resilient adversarial pass +
  confidence ≥ threshold + supported).

## Verification run

Run of `python3 verify.py` in this directory:

```
receipt:  .../skills/agentoracle-signed-receipt/examples/receipt.json
jwks_url: https://agentoracle.co/.well-known/jwks.json

=== VerifyResult ===
  canonical_sha256:  sha256-b9cf4e4afbee83cfd110c7923c6adff68a70487fb2cc7053fcb203e898afd695
  valid:             True
  checks:            {'canonical_recomputes': True, 'all_signatures_verified': True}
  signers:           [{'kid': 'ao-composed-2026-07-ed25519-3d44ba27',
                       'issuer': 'https://agentoracle.co/.well-known/jwks.json',
                       'verified': True}]
```

Exit code: `0`.

## Public/private boundaries

**Public:**
- Full receipt bytes (`receipt.json`) — the whole point of a signed
  receipt is that publishing it does not weaken the signature.
- Full request body (`compose_request.json`).
- Claim text (`prompt.md`).
- All hashes and sha256 values.
- The public key identified by `kid` — resolvable from
  https://agentoracle.co/.well-known/jwks.json.

**Redacted:**
- The API key used to authenticate the `POST /v1/compose` call
  (redacted to `zpka_ed17...02523b32` — you would use your own).

**Private (never in the run, never in this doc):**
- AgentOracle's Ed25519 signing private key (lives in Zuplo secret
  storage; never exposed).
- Stripe secret keys, webhook signing secrets, session keys.
