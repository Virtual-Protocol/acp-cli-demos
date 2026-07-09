# Result (redacted): CG-005 → cooker-class execution profile

Full emitted file: [`CG-005-cooker.json`](./CG-005-cooker.json)

## What the converter extracted

| Step | Action(s) | Temp (°C) | Duration (min) | Note |
|------|-----------|-----------|----------------|------|
| 1 | infuse | 60 | 15 | Hot Earl Grey infusion — 60°C hard cap (bergamot degrades above) |
| 2 | mix, heat | 40 | — | Base mixing |
| 3 | heat, strain | 85 | 0.5 | Pasteurization gate: 85°C / 30 s |
| 4 | cool | 4 | — | Rapid cooling |
| 5 | rest | 4 | 1080 | 18 h maturation, filmed in contact |
| 6 | freeze | -6 | — | Churning — do not over-churn |
| 7 | freeze | -35 → -18 | — | Blast-freeze then storage |

## Why this matters

- 7/7 steps parameterized, 0 flagged `needs_review`
- The two safety-critical values (60°C infusion cap, 85°C/30s pasteurization)
  were extracted from the chef's own wording, not inferred
- Original French instructions preserved per step for traceability
- Same source recipe also emitted for grill-class and dispensing-class
  targets in the full run (215 recipes × 3 targets = 645 files)

## Redaction

The recipe is the builder's own intellectual property, published
intentionally. Supplier, cost, and client data do not appear in this dataset.
No credentials, keys, or private agent instructions are included.

Not affiliated with or endorsed by Posha, Aniai, or XRobotics; trademarks
belong to their respective owners.
