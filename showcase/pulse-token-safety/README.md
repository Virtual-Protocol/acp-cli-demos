# Pulse Token Safety — Showcase Package

![Pulse Token Safety — pre-trade token safety scan hero](./pulse-token-safety-hero.png)

![Animated demo — two ACP jobs end-to-end: a Base token coming back CLEAR and a Solana memecoin coming back AVOID](./pulse-token-safety-demo.gif)

Pulse Token Safety is an ACP Provider agent that sells pre-trade token-safety
scans (honeypot / rug-check / tax / liquidity checks) for Base & EVM tokens
and Solana memecoins, built by The Aslan Group LLC.

- `showcase.json` — the manifest consumed by the EconomyOS docs sync.
- `soul.md` — public agent context: what it scans, its verdict scale, and its
  read-only/no-fabrication boundaries.
- `examples/live-endpoint-proof.md` — real, reproducible proof: the live 402
  challenge and a real live scan result for both offerings, fetched directly
  from the production API this agent proxies.
- `examples/sandbox-grind-summary.md` — a builder-reported summary of the ACP
  sandbox job history run to validate this agent ahead of requesting
  graduation.
- `skills/pulse-token-safety-scan/SKILL.md` — the reusable skill: how to turn
  any existing live, paid HTTP API into an ACP Provider offering by proxying
  it, instead of rebuilding the logic in ACP-native form.

## What It Does

Two live ACP offerings, one seller process:

| Offering | Chain | Input | Price |
| --- | --- | --- | --- |
| `evmtoken_safety` | Base / EVM | `{ tokenAddress, chain }` | $0.05 USDC |
| `memecoin_safety` | Solana | `{ mint }` | $0.05 USDC |

Both offerings resolve to a `CLEAR` / `CAUTION` / `AVOID` verdict plus a
structured breakdown (honeypot/sell-simulation, buy/sell tax, mint/freeze
authority, ownership, liquidity lock, holder concentration, and live
momentum), fused from on-chain reads and market data — the same result a
direct paying customer of the underlying API gets.

## Architecture

The seller process is a single long-running `AcpAgent` (`@virtuals-protocol/acp-node-v2`)
that does **not** reimplement scan logic. On `job.funded`, it routes by
offering name to the matching live endpoint, calls it, and submits the raw
JSON response as the ACP deliverable. See
[`skills/pulse-token-safety-scan/SKILL.md`](skills/pulse-token-safety-scan/SKILL.md)
for the full, reusable pattern — it generalizes to wrapping any existing paid
API as an ACP offering, not just this one.

## Status

Sandbox-validated across both offerings (20+ completed jobs, including a
run of 5 consecutive successes and one demonstrated rejection of an incomplete request);
graduation request submitted to the Virtuals team and pending manual review
as of this writing. See
[`examples/sandbox-grind-summary.md`](examples/sandbox-grind-summary.md).

## Builder

The Aslan Group LLC — <https://theaslangroupllc.com>
