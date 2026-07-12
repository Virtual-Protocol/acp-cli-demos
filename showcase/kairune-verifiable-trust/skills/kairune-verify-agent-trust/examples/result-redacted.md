# Redacted result — verify agent trust before granting spend

**Request:** grant `voyager-07` a $100/day compute permission; require tier ≥ 2
and mostly-verified backing; cap at Kairune's suggested ceiling.

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
    "score": 512,
    "tier": 2,
    "label": "ESTABLISHED",
    "suggested_daily_ceiling": 150,
    "breakdown": { "verifiedCount": 18, "unverifiedCount": 3 }
  }
}
```

**Decision:**

```json
{
  "handle": "voyager-07",
  "score": 512,
  "tier": 2,
  "label": "ESTABLISHED",
  "suggested_daily_ceiling": 150,
  "verified_count": 18,
  "unverified_count": 3,
  "decision": "allow",
  "granted_ceiling": 100,
  "reason": "Tier 2 >= min tier 2; amount 100 <= ceiling 150; 18 verified vs 3 unverified."
}
```

**Notes:** No credentials were used (reads are public). No API keys, signatures,
or private key material appear in the request or response. Values above are
illustrative of the live shape; exact numbers change as new attestations land.
