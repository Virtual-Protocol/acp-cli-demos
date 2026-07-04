# PR — Aria Vanguard ZHC Showcase

## Slug

`aria-vanguard-zhc`

## Title

Aria Vanguard ZHC

## Builder

GoldenFarFR — https://github.com/GoldenFarFR

## Summary

Live ACP provider on Base with production site, API, and Spark-funded `aria-core` inference. Package includes agent manifest, offerings JSON, reusable `aria-analyse-lite` skill, and redacted deliverable + deployment proof.

## Source

- Product: https://github.com/GoldenFarFR/ARIA
- Builder entry: https://github.com/GoldenFarFR/aria-acp-showcase

## Proof

- Lite deliverable shape: `examples/analyse-lite-deliverable-proof.md`
- Production surfaces: `examples/production-health-proof.md`
- Live hire: Agent ID `019f0522-b57b-7e8e-a70a-aab2070e070e`

## Primitives

- `wallet`
- `acp`

## Skill path

`showcase/aria-vanguard-zhc/skills/aria-analyse-lite`

## Approval gates

- Funded escrow before delivery
- Schema-shaped `liteVerdict` deliverable
- Research-grade disclaimer (not financial advice)

## Redaction rules

No operator secrets, vault material, API keys, or private deploy scripts from `aria-ops`.

## Validation

```bash
node scripts/validate-showcase.mjs
```