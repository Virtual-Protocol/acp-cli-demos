# Proof — Fiducia deterministic rebalance planner

Everything below is reproducible from a clean clone. The planner is pure
computation: no RPC, no keys, no network, no clock. Same input, same hash,
anywhere.

```bash
git clone https://github.com/fiduciaindex/fiducia.git
cd fiducia/packages/mandate
pnpm install --ignore-workspace

node --experimental-strip-types --test test/*.test.ts        # 46 tests
node --experimental-strip-types examples/deterministic-plan.ts
```

Node 22 or newer. `--experimental-strip-types` runs the TypeScript directly, so
there is no build step to trust.

## What the demo shows

A five-name mandate (cap 30%, floor 10%, USDG base) against a book that has
drifted, planned into a leg sequence and committed to a single hash.

```
========================================================================
1. MANDATE IDENTITY
========================================================================
name        : Mag Five Capped
canonical   : {"base":{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","dec...
bytes       : 827
mandateHash : 0xe3420dccd9f0f958d51e2b2e1ae6d3a6fac1baffe12dc23e9a7a213e2d5125dd

========================================================================
2. TARGET WEIGHTS  (cap 30%, floor 10%)
========================================================================
  AAPL   raw  22.97%   target  21.49%
  MSFT   raw  20.95%   target  20.47%
  NVDA   raw  29.05%   target  24.53%
  AMZN   raw  12.84%   target  16.42%
  GOOGL  raw  14.19%   target  17.09%
  sum    10000 bps (must be exactly 10000)

========================================================================
3. CURRENT BOOK
========================================================================
NAV : 10000 USDG
  AAPL    18.00%   vs target  -3.49%
  MSFT    20.00%   vs target  -0.47%
  NVDA    36.00%   vs target  +11.47%
  AMZN     9.00%   vs target  -7.42%
  GOOGL   17.00%   vs target  -0.09%

========================================================================
4. REBALANCE PLAN
========================================================================
drift before   : 1147 bps
drift expected : 0 bps
turnover       : 2294 bps (cap 3000 bps)
violations     : none

  seq  side  ticker  notional        minAmountOut
  0    SELL  NVDA      1147 USDG     1141
  1    BUY   AMZN       742 USDG      738
  2    BUY   AAPL       349 USDG      347
  3    BUY   MSFT        47 USDG       46
  4    BUY   GOOGL        9 USDG        8

planHash : 0x07061e2f22ea83cca89468e9eba86c26300e92896a0e1ce69a8d30187df3e30e

========================================================================
5. DETERMINISM
========================================================================
100 rebuilds -> identical planHash

========================================================================
6. TAMPER DETECTION
========================================================================
committed        : 0x07061e2f22ea83cca89468e9eba86c26300e92896a0e1ce69a8d30187df3e30e
halve minAmountOut: 0x76c1fff76e9629e20d6a9eae65cf28e98def3024ced63bc5e1ffb073496fc4af
  -> IndexVault reverts PlanMismatch

swap calldata swapped: 0xfbccc8be085024cb1c881fe72c89834955adabd000af0f842aefcf1607cd8040
  -> also reverts: calldata is inside the hash, not alongside it
```

## Why the hashes are the point

An agent that plans its own trades can quietly widen its own limits. The plan is
hashed before execution and checked at settlement, so the discretion is bounded
by arithmetic rather than by trust:

- Sells are sequenced before buys, so the base currency exists before it is spent.
- `minAmountOut` is `notional * 9950 / 10000` — halving it changes `planHash`.
- Swap calldata is hashed *inside* the tuple, not passed alongside it, so
  swapping the router payload changes `planHash` too.
- Section 6 demonstrates both tamper cases producing different hashes.

The hash preimage is an ABI encoding of `(bool, bytes32, uint256, uint256,
address, bytes)[]`, matching what the Solidity side would hash.
`test/planner.test.ts` asserts this against an independent restatement of the
tuple rather than against the implementation's own helper.

## A real bug this surfaced

The weight solver carried a comment claiming its invariants were
"property-tested". No tests existed. Writing them found that `waterFill`
returned allocations summing to **13000 bps — 130%** whenever a cap and a floor
bound simultaneously. With `cap 0.9 / floor 0.1` over five assets it produced
`0.9 + 4×0.1` instead of the feasible `0.6 + 4×0.1`.

The cause: it clamped in both directions in a single pass and never revisited a
pinned name, so a name pinned to the cap could leave less mass than the
remaining floors required. It is reformulated as floor-plus-excess — seat every
name at the floor, then water-fill the remainder capped at `cap - floor` — and
verified across 4000 randomised feasible cases with zero invariant violations.

In production this would have misallocated capital. It is in
[`src/weights.ts`](https://github.com/fiduciaindex/fiducia/blob/main/packages/mandate/src/weights.ts),
and the comment now points at the tests instead of claiming them.

## Test coverage

`node --experimental-strip-types --test test/*.test.ts` → **46 tests, 46 pass, 0 fail**

| File | Covers |
| --- | --- |
| `canonical.test.ts` | Key ordering, whitespace, `undefined` vs `null`, non-finite and bigint rejection, address-case normalisation, hash stability under key reordering |
| `weights.test.ts` | Sum is exactly 10000 bps for every n in 2–50, largest-remainder rounding, cap and floor binding together, untradable names dropped and renormalised, infeasible bounds rejected |
| `planner.test.ts` | Leg sequencing, notional and slippage sizing, turnover and single-leg caps, guardrail blocking, `planHash` sensitivity to every field, cross-checked against an independent ABI restatement |

## Scope — what is and is not built

Stated plainly so the proof is not read as more than it is.

**Running and reproducible:** the deterministic core in `packages/mandate` —
mandate canonicalisation and hashing, the weight solver, the rebalance planner,
plan hashing, and the guardrail checks. 46 tests, 1134 lines including tests.

**Live:** the `$FIDUCIA` agent token on Virtuals (agent #139254) and the project
site at [fiduciaindex.com](https://fiduciaindex.com/).

**Written but not deployed:** the Solidity contracts (`IndexVault`,
`MandateRegistry`, `NavOracle`, `AttestationHub`). No Foundry tests yet, no
deployment, no audit.

**Not implemented:** the ACP adapter. No ACP job has been created or settled by
this project, which is why `primitives` lists only `token`. The agent processes
in `apps/agents` do not run without that adapter. No token utility is
implemented — all accounting in the planner is denominated in USDG, not
`$FIDUCIA`.

The repo README carries the same per-component status table.
