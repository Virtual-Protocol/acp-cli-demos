# Sandbox Job History — Builder-Reported Summary

This is a **builder-reported operational summary**, not an on-chain audit —
flagged explicitly so reviewers can weight it accordingly. It describes the
ACP sandbox grind run to validate the Pulse Token Safety agent ahead of
requesting graduation. Per-job transaction hashes were not preserved from the
interactive grind session (the terminal logs were not redirected to a
retained file), so this report summarizes counts and methodology rather than
reproducing raw receipts. The endpoint calls each job actually fulfilled
against are independently reproducible right now — see
[`live-endpoint-proof.md`](live-endpoint-proof.md).

## Agent Identity

- **Name:** Pulse Token Safety
- **Role:** Provider
- **Agent ID:** `019f1f14-7d41-7e7f-86fb-1c903fee8ee3`
- **Chain:** Base
- **Wallet:** `0x472baa91842ffd2d906069a0c816ef456292dc69`
- **Token:** none — no `$PULSE` token was launched; the agent operates on
  wallet + ACP identity only.

## Offerings Exercised

| Offering | Input | Price | Chain routed |
| --- | --- | --- | --- |
| `evmtoken_safety` | `{ tokenAddress, chain }` | $0.05 USDC | Base/EVM |
| `memecoin_safety` | `{ mint }` | $0.05 USDC | Solana |

## Methodology

A single scripted buyer process (`grind-buyer.ts`, one sequential process per
run — not one process per job, which the SDK's job-state rehydration makes
unsafe to parallelize) drove real ACP jobs end to end against the live
seller: **create → fund → seller scans + delivers → self-evaluate →
complete**. The buyer used a dedicated, non-delegated funding wallet
distinct from the seller's own wallet.

## Result Summary

- **`evmtoken_safety`:** 20+ jobs run, all completed cleanly, including a
  run of 5 consecutive successful completions in a row.
- **`memecoin_safety`:** 3 jobs run, 3/3 completed cleanly.
- **Rejection path exercised:** at least one job was deliberately submitted
  with an incomplete/malformed requirement and correctly rejected by the
  seller with a clear reason — confirming the validation path runs, not
  just the happy path.
- **Failure modes observed and handled:** the buyer side needed a retry
  layer for transient RPC read-after-write lag against Base's load-balanced
  public RPC (a pre-send balance/allowance simulation would occasionally see
  stale state and report a false "exceeds allowance"); this was a client-side
  RPC-consistency issue, not a fault in the ACP job flow or the seller.

## Graduation Status

A graduation request citing this history was submitted to the Virtuals team
and is pending manual review as of this writing. Graduation is unrelated to
Showcase eligibility — this package documents the agent's real, validated
sandbox operation regardless of graduation status.
