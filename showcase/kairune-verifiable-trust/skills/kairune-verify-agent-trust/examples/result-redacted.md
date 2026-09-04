# Redacted result — verify agent trust before granting spend

**Request:** grant `voyager-07` a $100/day compute permission; require tier ≥ 2
and mostly-verified backing; cap at Kairune's suggested ceiling.

This example is deliberately one that does **not** end in a clean `allow`. The
agent clears the tier gate but fails the caller's verified-backing requirement,
which is the case worth showing: the tier alone is not the whole policy.

**Live API call (free, public):**

```
GET https://kairune.online/api/agents/voyager-07
```

**Relevant fields returned (trimmed, public data):**

```json
{
  "agent": {
    "handle": "voyager-07",
    "status": "active",
    "score": 600,
    "tier": 2,
    "label": "ESTABLISHED",
    "suggested_daily_ceiling": 150,
    "breakdown": {
      "verifiedCount": 0,
      "unverifiedCount": 2328,
      "integrityFactor": 0.668,
      "earnedScore": 668,
      "corroborationCeiling": 600,
      "corroborationCapped": true,
      "boundBy": "corroboration-ceiling"
    }
  }
}
```

And the companion read, which explains *why* the score stops where it does:

```
GET https://kairune.online/api/agents/voyager-07/trust-sources
```

```json
{
  "verified_count": 0,
  "unverified_count": 2328,
  "distinct_issuers": 0,
  "score_ceiling": 600,
  "score_ceiling_next_issuer": 700,
  "issuers_to_remove_ceiling": 4
}
```

**Decision:**

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
  "reason": "Tier 2 >= min tier 2 and amount 100 <= ceiling 150, but 0 of 2328 attestations are signed and no independent issuer has attested, so the score is capped at 600 rather than earned. Escalate rather than grant."
}
```

**Notes:** No credentials were used (reads are public). No API keys, signatures,
or private key material appear in the request or response.

The numbers above were read from the live endpoint, so they show two things an
invented example would have hidden.

First, two separate rules are pushing this score down and only the stricter one
is reported. `integrityFactor: 0.668` means roughly a third was withheld because
disputes and chargebacks make up a measurable share of the record — that alone
put the agent at 668. But `distinct_issuers` is 0, so the corroboration ceiling
caps it at 600 and `boundBy` names that instead. `earnedScore` is where the
history would have landed; `score` is what it can actually prove.

Second, 2328 attestations produced no more standing than a few hundred would
have. Volume is not evidence when the subject can write its own record. This is
the case the skill exists to catch: a big number that looks like a track record
and isn't.

Re-read the endpoint before relying on any specific value — scores move as
attestations land, and this agent's will move the moment someone independent
vouches for it.
