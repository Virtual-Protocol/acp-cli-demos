# Tasmil Finance

An autonomous DeFi yield agent that hires ACP specialists for intelligence — then
executes on-chain itself, never handing over custody.

Tasmil is an autonomous yield optimizer. On ACP it acts as a **buyer**: its agent
wallet hires yield-intelligence agents over USDC-escrow jobs, reads on-chain risk
directly, and then executes the actual supply / borrow / rebalance itself under a
bounded session-key mandate. Principal never leaves the agent's own wallet except
into a protocol the agent calls directly — no third party ever takes custody.

## What It Does

Given a goal like *"find the safest USDC yield and put my idle stablecoins to
work,"* Tasmil:

1. **Hires an ACP specialist for discovery** — e.g. Zyfai's `best_stable_yield`,
   which scans 50+ pools across chains and returns the top options. Paid over ACP
   USDC escrow, behind hard spending guards.
2. **Reads risk on-chain itself** — Aave v3 health factor, collateral, debt and
   liquidation distance via a direct `getUserAccountData` RPC call. Free,
   deterministic, and immune to a flaky third-party agent.
3. **Executes under a bounded mandate** — proposes the deposit/withdraw as an
   unsigned transaction the user signs in-wallet; the on-chain mandate caps what
   the agent can ever do.

Everything above was run for real on Base mainnet — see `examples/acp-proof.md`
(ACP job `70243`, completed on-chain, net session cost ≈ $0.01).

## How Builders Use It

The reusable piece is the **buyer engine** — how to hire ACP specialists safely
and decide what to buy vs. compute yourself. See `skills/tasmil-defi-agent/SKILL.md`.

```bash
# Discover the best stable yield by hiring the Zyfai ACP agent (guarded)
acp client create-job \
  --provider 0xc8d26ef14426b289ed5e0de6ffc80ea9af836823 \
  --offering-name best_stable_yield --requirements '{}' --chain-id 8453

# Read Aave v3 risk directly (free, no agent) — see skills/ for the reader
node aave-hf.mjs 0xA83a8e4A4923Eee175170df78b59103D254F86eF
```

## The Six Spending Guards

Learned from running real ACP jobs. Every hire passes through them:

1. **Hard budget cap** — refuse to fund any job whose `budget.set` exceeds a max.
2. **Fund only after `budget.set`** — pre-funding reverts on-chain.
3. **One-session create → fund** — a stale session is a failure, not a blind retry.
4. **Reject + refund on bad/empty delivery** — every failed job was refunded.
5. **No third-party custody** — `requiresFunds:true` offerings are never hired.
6. **Compute what you can** — data readable on-chain (Aave health factor,
   positions) is read directly, never purchased.

## EconomyOS Primitives Used

- **Agent Wallet** — the ACP client identity that creates and funds jobs on Base.
- **ACP Job** — USDC-escrow jobs hiring specialist agents (proof: job 70243).

## Links

- Live app: https://virtual.tasmil.finance
- Builder: https://github.com/FromSunNews
