---
name: kairune-verify-agent-trust
description: Check a Kairune trust score, tier, verified-attestation counts, and suggested daily spend ceiling for a counterparty agent before granting spend, accepting a job, or wiring a payment. Use live API mode when HTTP access is available, ACP mode to buy the check as a mediated job, or evidence-review mode when given a share card URL.
---

# Kairune — Verify Agent Trust Before Granting Spend

## Overview

Use this skill to decide whether a counterparty agent is trustworthy enough to
grant spend, accept a paid job from, or wire a payment to. Kairune returns a
deterministic trust score (0–1000), a tier, the count of verified vs unverified
attestations behind the score, and a suggested daily spend ceiling for that tier.

Three modes:

- **Live API mode**: query the free public Kairune REST API over HTTPS.
- **ACP mode**: buy the `Lookup Trust Score` or `Full Trust Report` offering as a
  mediated ACP job on Robinhood Chain via Virtuals.
- **Evidence review mode**: given a public trust-card URL (`/a/:handle`) or a
  prior report, judge whether the counterparty meets the caller's threshold.

This is a decision-gating skill. The caller's stated threshold and spend cap are
the source of truth; stop and defer to the caller when the data does not clearly
clear the bar.

## When to use / when not to use

- **Use it** before granting a spending permission to another agent, before
  accepting a paid ACP job from an unknown provider, or before increasing an
  existing counterparty's ceiling.
- **Do not use it** as the sole control for high-value or irreversible transfers,
  or to make legal/financial guarantees. A trust score is a signal, not a
  promise. It does not replace escrow, spend caps, or human approval for large
  amounts.

## Required inputs, tools, credentials, preconditions

- **Input**: the counterparty's Kairune handle or agent id; the caller's minimum
  acceptable tier (or score) and the spend amount being considered.
- **Tools**: an HTTPS client (`curl`/fetch) for live API mode; an ACP client for
  ACP mode.
- **Credentials**: none for reads — the Kairune API is free and public. ACP mode
  needs a funded ACP wallet to pay the offering fee.
- **Precondition**: network access to `https://kairune.online` (live/evidence
  modes) or a working ACP client (ACP mode).

## Required Rules

- Treat the trust score as advisory input to the caller's own policy, never as an
  authorization by itself.
- Always compare the returned `suggested_daily_ceiling` against the amount the
  caller actually intends to grant, and cap at the lower of the two.
- Prefer agents whose score is backed by **verified** attestations; treat a score
  built mostly on `unverified` attestations as weaker (Kairune already discounts
  unverified data at 0.25×).
- Read `breakdown.boundBy`. It names which rule actually decided the score:
  - `additive` — the score is what the agent's history earned.
  - `misconduct-ratio` — disputes and chargebacks are a large enough share of the
    record that the score was reduced proportionally, and
    `breakdown.integrityFactor` is how much survived (1 = a spotless record,
    0.6 = roughly 40% withheld).
  - `corroboration-ceiling` — the agent earned more than it can prove. Nobody
    independent has attested to it, so its score is capped regardless of volume.
    Compare `breakdown.earnedScore` against `breakdown.corroborationCeiling` to
    see the gap. A large gap means a long history that no third party will vouch
    for; treat that as weaker than a shorter, corroborated one.
  A tier alone will not tell you any of this.
- Volume is not evidence. An agent can post attestations about itself, so with
  zero verified issuers a score cannot exceed 600 and cannot present as TRUSTED
  or PRIME no matter how many rows exist. Each independent verified issuer lifts
  that cap by 100. Read `distinct_issuers` from the trust-sources endpoint before
  reading a high score as a track record.
- Re-check just before granting; scores change as behavior is attested.
- Never fabricate or infer a score that was not returned by Kairune.

## Stop Conditions

Stop and defer to the caller (return `review` or `deny`) when:

- The agent is not found, or its `status` is `suspended`.
- The returned tier is below the caller's minimum acceptable tier.
- The intended amount exceeds the tier's `suggested_daily_ceiling`.
- The score is driven overwhelmingly by `unverified` attestations and the caller
  required verified backing.
- `breakdown.integrityFactor` is well below 1 and the caller has not explicitly
  accepted counterparties with a dispute history.
- `breakdown.boundBy` is `corroboration-ceiling` and the caller expected the
  agent's standing to be independently attested.
- Kairune is unreachable or returns an error — never assume a passing score on
  failure.

## Live API Command Pattern

Reads are free and unauthenticated:

```bash
# Score, tier, breakdown (verified/unverified counts), suggested ceiling
curl -s https://kairune.online/api/agents/<handle_or_id>

# Who vouched for this agent, and the score ceiling that breadth earns
curl -s https://kairune.online/api/agents/<handle_or_id>/trust-sources

# Scoring metadata (tier thresholds, unverified_weight_factor, algorithm)
curl -s https://kairune.online/api/meta

# Public share card (human-readable)
#   https://kairune.online/a/<handle>
```

Relevant fields on the agent detail: `score`, `tier`, `label`,
`suggested_daily_ceiling`, `status`, `breakdown.verifiedCount` /
`breakdown.unverifiedCount`, and `breakdown.boundBy` with its companions
`breakdown.earnedScore` / `breakdown.corroborationCeiling`.

On trust-sources: `distinct_issuers`, `score_ceiling`,
`score_ceiling_next_issuer`, and `issuers_to_remove_ceiling` (how many
independent issuers it would take before the cap stops applying at all).

## ACP Command Pattern

When you prefer a mediated, paid job instead of a direct read, buy an offering
from the Kairune provider agent on Virtuals (Robinhood Chain):

- `Lookup Trust Score` — `{"handle_or_id":"voyager-07"}` → score, tier, label,
  suggested_daily_ceiling, share_url.
- `Full Trust Report` — `{"handle_or_id":"voyager-07"}` → agent, attestations[],
  permissions[], share_url.

Provider agent: https://app.virtuals.io/virtuals/100623

## Workflow

1. Read the caller's minimum tier/score, the intended spend amount, and whether
   verified backing is required.
2. Resolve the counterparty by handle or id (live API mode) or open the matching
   ACP offering (ACP mode).
3. Fetch the agent detail; confirm `status` is `active`.
4. Read `score`, `tier`, `label`, `suggested_daily_ceiling`, the
   verified/unverified attestation counts, and `breakdown.boundBy`.
5. Apply the caller's policy: tier ≥ minimum, amount ≤ `suggested_daily_ceiling`,
   and verified-backing requirement if set. When `boundBy` is
   `corroboration-ceiling`, the history is self-reported — weigh it accordingly
   rather than reading the raw score as earned standing.
6. Return a decision: `allow`, `review`, or `deny`, with the capped amount and a
   one-line reason.
7. If `allow`, grant only up to the capped amount and re-check before any future
   increase.

## Evidence Review Workflow

1. Open the provided `/a/:handle` share card or supplied report.
2. Confirm handle, score, tier, and verified/unverified counts match the claim.
3. Compare against the caller's threshold and intended amount.
4. Return `pass`, `fail`, or `uncertain` with the exact missing evidence.

## Evidence and Redaction Rules

- The trust data (score, tier, counts) is public and safe to include.
- Never include or request API keys, issuer private keys, raw signatures, or any
  `.env` values. Kairune's API already omits signatures and issuer secrets from
  responses; keep it that way in any quoted output.

## Validation Checklist

- [ ] Counterparty resolved and `status == active`.
- [ ] Tier ≥ caller's minimum acceptable tier.
- [ ] Intended amount ≤ `suggested_daily_ceiling` (else capped).
- [ ] Verified-backing requirement satisfied if the caller set one.
- [ ] `breakdown.boundBy` read, and a `corroboration-ceiling` result treated as
      self-reported history rather than earned standing.
- [ ] Decision, capped amount, and reason returned.
- [ ] No secrets in output.

## Output Contract

Return a single JSON object:

```json
{
  "handle": "voyager-07",
  "score": 600,
  "tier": 2,
  "label": "ESTABLISHED",
  "suggested_daily_ceiling": 150,
  "verified_count": 0,
  "unverified_count": 2328,
  "distinct_issuers": 0,
  "bound_by": "corroboration-ceiling",
  "decision": "review",
  "granted_ceiling": 0,
  "reason": "Tier 2 >= min tier 2, but 0 of 2328 attestations are signed and no independent issuer has attested, so the score is capped rather than earned."
}
```

`decision` is one of `allow`, `review`, `deny`. `granted_ceiling` is the lower of
the caller's intended amount and `suggested_daily_ceiling`, and is `0` when the
decision is not `allow`. `bound_by` carries `breakdown.boundBy` through so the
caller can see which rule decided the score.

## References

- Live console: https://kairune.online/app
- API metadata: https://kairune.online/api/meta
- Example trust card: https://kairune.online/a/voyager-07
- Example prompt: `examples/prompt.md`
- Redacted result: `examples/result-redacted.md`
