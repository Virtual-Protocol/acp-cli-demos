# Budget Governor

## Hard Rules

The weekly compute cap is the highest law. It overrides all other decisions, including accepting jobs that look profitable.

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `weekly_cap_usd` | 199 | Hard weekly compute budget |
| `daily_cap_usd` | 28 | Soft daily cap (leaves buffer) |
| `min_margin_multiplier` | 3x | Minimum payout-to-compute ratio |
| `strict_mode_threshold` | 0.80 | Budget fraction that triggers strict mode |
| `max_consecutive_failures` | 3 | Failures before kill-switch |
| `max_pending_jobs` | 2 | Max concurrent jobs before blocking new |

## Daily Flow

1. At the start of each cycle, read `spent_this_week` from the state file.
2. If `spent_this_week >= weekly_cap_usd` → STOP. Only finish pending jobs. Do not accept new ones.
3. If `spent_this_week >= 0.80 * weekly_cap_usd` → switch to **strict mode**: only accept jobs with margin >= 5x and low failure risk.
4. If `spent_this_week < 0.80 * weekly_cap_usd` → **normal mode**: accept jobs with margin >= 3x.

## Compute Cost Estimation

Before executing any job, estimate compute cost:

```
estimated_cost = (input_tokens * input_price + output_tokens * output_price) / 1_000_000
```

Use conservative estimates — assume 1.5x the expected token count as buffer for retries, context overhead, and tool calls.

## Margin Calculation

```
margin_multiplier = job_payout_usdc / estimated_compute_cost_usdc
```

- `margin_multiplier >= 3x` → acceptable in normal mode
- `margin_multiplier >= 5x` → acceptable in strict mode
- `margin_multiplier < 3x` → reject, log reason

## Weekly Reset

When the week rolls over (track via `week_start` date in state file):
- Reset `spent_this_week` to 0
- Reset `mode` to `normal`
- Carry forward `consecutive_failures` (do not reset on week boundary)

## State File Schema

```json
{
  "budget": {
    "weekly_cap_usd": 199,
    "daily_cap_usd": 28,
    "week_start": "2026-06-19",
    "spent_this_week": 0,
    "jobs_completed": 0,
    "jobs_rejected": 0,
    "jobs_failed": 0,
    "revenue_this_week": 0,
    "consecutive_failures": 0,
    "mode": "normal"
  }
}
```

## Escrow Reconciliation

Before assuming a job is unpaid:
1. Check job status via `acp job status --job-id <id> --json`
2. Check on-chain escrow contract for USDC release
3. If escrow released but wallet balance unchanged, check pending transactions
4. Log reconciliation result
