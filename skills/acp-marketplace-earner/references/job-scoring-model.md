# Job Scoring Model

## Scoring Dimensions (0–100 total)

### Margin (0–40 points)

```
margin = job_payout_usdc / estimated_compute_cost_usdc
```

| Margin | Points | Decision |
|--------|--------|----------|
| >= 10x | 40 | Strong accept |
| 5x–9x | 30 | Accept (strict mode ok) |
| 3x–4x | 20 | Accept (normal mode only) |
| 2x–2.9x | 10 | Reject — below floor |
| < 2x | 0 | Reject — burns compute |

If margin < 3x, reject regardless of other scores. This is a hard floor, not a suggestion.

### Capability Match (0–30 points)

Score honestly based on what the agent can actually deliver:

| Match Level | Points | Description |
|-------------|--------|-------------|
| Exact match | 30 | This is exactly what your offerings describe |
| Strong match | 25 | Close to an existing offering, minor adaptation |
| Partial match | 15 | Related skill, but needs new capability |
| Stretch | 5 | Adjacent domain, high execution risk |
| No match | 0 | Cannot deliver — reject |

Do not overclaim. A rejected job costs nothing; a failed evaluation costs compute, reputation, and future hires.

### Deadline Feasibility (0–15 points)

| SLA | Points | Notes |
|-----|--------|-------|
| >= 60 min | 15 | Comfortable |
| 30–59 min | 10 | Tight but doable |
| 15–29 min | 5 | Rush — only accept if capability is exact |
| < 15 min | 0 | Reject — cannot guarantee quality |

### Requester Reputation (0–15 points)

Check marketplace browse data and job history:

| Signal | Points |
|--------|--------|
| Established agent, high rating | 15 |
| New agent, no red flags | 10 |
| Unknown, no history | 7 |
| History of disputes | 0 — reject |

## Acceptance Threshold

| Score | Mode | Decision |
|-------|------|----------|
| >= 70 | Any | Accept |
| 55–69 | Normal | Accept with caution |
| 55–69 | Strict | Reject |
| 40–54 | Any | Reject, log reason |
| < 40 | Any | Reject, log reason |

## Rejection Logging

Every rejection must be logged with:
- Job ID
- Offering name
- Score breakdown (margin, capability, deadline, reputation)
- Primary rejection reason
- Timestamp

This data is not waste — it calibrates future scoring. Patterns in rejections reveal which offerings attract low-quality requests and which time windows produce the best jobs.

## Post-Execution Calibration

After each completed job:
1. Compare actual compute cost to pre-execution estimate
2. If actual > 1.5x estimate → increase estimation buffer for that offering type
3. If actual < 0.5x estimate → decrease estimation buffer
4. Log the calibration adjustment

Over time, estimates converge toward reality and scoring becomes more accurate.
