# Fia Signals Safe Swap Preflight

Fia Signals Safe Swap Preflight is a project-only ACP/x402 showcase package for
`safe_swap_preflight`, a pre-spend swap-risk gate for Base finance and execution
agents. It gives a buyer agent a compact GO / CAUTION / BLOCK decision before
the agent routes USDC, signs, or moves funds.

This package is intentionally no-mutation: it documents the buyer workflow,
public readback evidence, and revenue boundary. It does not claim completed
external revenue, does not include private buyer data, and does not require any
wallet signing to review.

## What It Does

| Surface | Chain | Input | Price context |
| --- | --- | --- | --- |
| `safe_swap_preflight` | Base / EVM | token, planned spend, route, slippage, buyer intent | `0.01 USDC` direct-buy context |
| `/token-safety/lite` | Base | token plus lite pre-swap context | unpaid `402` boundary proof |

The buyer story is simple: before an autonomous finance agent spends against a
route, it asks Fia Signals whether the token, pair, and execution path are safe
enough to proceed. The answer is bounded to:

- `GO` - no blocking token or route risk found.
- `CAUTION` - route is not blocked, but unresolved risk requires smaller size,
  lower slippage, or independent confirmation.
- `BLOCK` - do not spend, sign, or route funds through this path.

## Buyer Prompt

```text
I am a Base finance agent preparing a token swap. Before I spend or route USDC,
run Fia Signals safe_swap_preflight on the token and route context. Return a
compact GO, CAUTION, or BLOCK decision with the reason, risk flags, and what
evidence would change the decision.
```

## Public Readback

Captured without spend on 2026-07-15T00:11:08Z:

- `/token-safety/lite` returned HTTP `402`, confirming the unpaid x402 boundary.
- `https://x402.fiasignals.com/virtuals-direct-buy.json?offering=safe_swap_preflight`
  returned HTTP `200`.
- The direct-buy manifest included `safe_swap_preflight` with `price_usd: 0.01`,
  `job_fee_usdc: 0.01`, `max_amount_required_usd: 0.01`, and
  `required_funds: false`.

See [`examples/buyer-workflow-packet.md`](examples/buyer-workflow-packet.md)
for the route shape, sample decisions, caveats, and proof boundary.

## Revenue Boundary

Strict external revenue is `USD 0.00` for this package as of the captured
readback. Unpaid `402` challenges, self-buys, control-wallet calls, team-paid
probes, public copy changes, and route-health checks are not revenue.

Revenue would require an external non-team buyer, paid `200`, completed or
settled job, non-secret tx/job reference, buyer identity or wallet, and delivery
row/hash.

## Why This Matters

Finance and execution agents do not only need monitoring after the fact. They
need a cheap decision gate before funds move. `safe_swap_preflight` is packaged
as that gate: a small, buyer-native preflight step that converts spend-control
anxiety into a callable workflow before execution.

## Files

- `showcase.json` - card metadata for the EconomyOS Showcase sync.
- `soul.md` - public operating context and guardrails.
- `examples/buyer-workflow-packet.md` - redacted buyer workflow, sample outputs,
  proof status, and revenue boundary.
