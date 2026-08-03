# Demo prompt — reproducing the AgentOracle signed receipt

**What this demonstrates.** An ACP transaction between two agents
produces a settlement-grade evidence artifact: a JWS-signed composed
envelope that any third party can verify offline against the issuer's
published JWKS.

**What "settlement-grade" means here.** If Agent A and Agent B later
disagree about whether the deliverable was in fact delivered, either
party — or a neutral auditor with no AgentOracle account and no
network access to AgentOracle infrastructure — can take the retained
receipt and prove three things:

1. The payload canonicalizes byte-identically (JCS, RFC 8785).
2. The canonical hash matches the hash claimed on the receipt.
3. The Ed25519 signature verifies against a public key whose `kid`
   is in the issuer's published JWKS.

If those three pass, the receipt is authentic — the issuer really did
sign this exact claim under this exact ruleset at this decision point.

## Scenario

Agent A completes an ACP-brokered service: a technical summary of
RFC 8785. Agent B settles for the agreed 3.50 USDC on Base mainnet.
Agent A then requests a signed receipt from AgentOracle attesting that
this delivery occurred, with high confidence, resilient to adversarial
re-reads.

The claim being verified:

> Agent A delivered a completed 500-word technical summary of the
> RFC 8785 JCS specification to Agent B for the agreed 3.50 USDC
> settlement on Base mainnet block 47892103.

The skill under which the check was performed:

> `acp.delivery.evidence.v1`

Both are content-addressed via `sha256` into the receipt's
`subject.claim_hash` and `subject.skill_hash` — so the receipt is
tied to the exact bytes of the claim string and the exact identifier
of the ruleset. Any post-hoc edit invalidates the signature.

## How the receipt was produced

The exact request sent to `POST /v1/compose`:

```json
{
  "subject": {
    "claim_hash": "sha256-<sha256 of the claim text above>",
    "skill_hash": "sha256-<sha256 of \"acp.delivery.evidence.v1\">"
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

See `compose_request.json` in this folder for the exact bytes.

The full HTTP request:

```bash
curl -X POST https://agentoracle-gateway-main-39fa17e.zuplo.app/v1/compose \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AO_API_KEY" \
  --data @compose_request.json
```

`$AO_API_KEY` is a live production API key issued at
https://agentoracle.co/register on the $99/month self-serve tier.
Every self-serve subscriber gets their own key; keys gate access to
the composition endpoint at 100 requests/hour per key.

The response is the file at `receipt.json` in this folder.

## Reproducing on your own key

1. Sign up at https://agentoracle.co/register with a real card
   ($99/month, real charge). Copy the `zpka_...` key from the
   post-checkout page (available for 1 hour, retrievable in the
   Zuplo Dashboard afterward).
2. Change the `claim` and `skill` inputs to describe your own ACP
   transaction. Recompute the SHA-256 of each and update
   `compose_request.json`.
3. Compute your own `v_gate` result over the transaction — verdict,
   confidence, threshold, adversarial pass, recommendation.
4. Set `AO_API_KEY=<your key>` and run the `curl` above.
5. Save the response as your own `receipt.json`.
6. Anyone with your receipt can now verify it offline against
   https://agentoracle.co/.well-known/jwks.json without touching your
   API key.

The receipt's authenticity is a property of the AgentOracle signing
key — not of the caller. The API key gates issuance rate and
metering; verification is public.
