# V.A.P.E. — Virtual Ape Private Eye

**Autonomous on-chain detective for Base.** V.A.P.E. investigates tokens and
contracts in real time, scores their risk, and publishes **linkable, real-data
verdicts** to a live dashboard — then sells the same investigations through two
hiring rails, and improves its own codebase along the way.

- **Identity:** ERC-8004 #54988 · wallet `0xa142…2879` on Base · [@based_vape](https://x.com/based_vape)
- **Live dashboard:** https://juxtaposition1.github.io/V.A.P.E/
- **Repo:** https://github.com/jUXTAPOSITION1/V.A.P.E
- **Verify identity:** https://app.virtuals.io/virtuals/54988

## What it does

Each cycle V.A.P.E. auto-selects the highest-signal live Base target (violent
movers / thin-liquidity pools) and runs a **keyless, multi-source investigation**:

| Dimension | Source |
| --- | --- |
| Honeypot / taxes / mint & ownership powers | GoPlus token-security |
| Liquidity, volume, price move, pair age | DexScreener |
| Contract code presence & size | Base RPC (`eth_getCode`) |
| Source verification & proxy surface | Etherscan V2 (optional key) |
| Correlation to recent real exploits | DeFiLlama `/hacks` feed |
| Public reputation signals | real web search, escalated to a full-page scrape on a scam-keyword hit |

It computes a **0-100 safety score** and files a `PROCEED / CAUTION / REJECT`
verdict to a permanent, append-only ledger, then surfaces it on the dashboard —
where every finding deep-links to its source report. Verdicts aren't
fire-and-forget: a scheduled self-review re-checks past calls against fresh
data and logs a real finding if a verdict has drifted.

## It also builds and improves itself

A self-improvement loop runs regularly and — prioritizing V.A.P.E.'s own
red-team findings over open-ended guesses — finds one real, evidence-backed
issue per cycle, proposes a grounded fix, and opens a human-reviewed pull
request. Nothing merges without a maintainer. This is the same repo's
**Development Ledger**: every card on the dashboard's build log links to a
real PR, not a curated changelog.

V.A.P.E. also red-teams itself: real prompt-injection tests (`agents/redteam.py`)
and daily `garak` / `promptfoo` / `deepteam` campaigns run against its actual
production report pipeline, not a mock.

## EconomyOS primitives

- **ACP** — V.A.P.E. is a registered ACP provider (ERC-8004 identity) selling
  15 offerings, from a $0.01 exploit check to a $50 24-hour-SLA deep-dive audit.
- **wallet** — agent-owned Base wallet for identity and job settlement.
- **token** — tokenized agent (`0x2b60…daFE` on Base).

## Two ways to hire it

- **ACP (escrowed, managed)** — for deeper audits, forensic tracing, and bulk
  assessments. Escrowed USDC on Base, ERC-8004-registered identity.
- **x402 (instant, pay-per-call)** — a Cloudflare Worker gates 6 of the same
  automated offerings behind the x402 protocol: pay, get a JSON result back in
  under a second, no account or subscription. The $50 deep-dive audit is also
  x402-payable — it settles instantly, then dispatches the real async job
  (recon + Slither + a frontier-model source review) and delivers the report
  within 24h.

Both rails call the exact same underlying recon/scoring code, so the price you
pay is the only thing that differs — never the rigor of the answer.

## Reusable skill

[`vape-investigate`](skills/vape-investigate/) — run the exact investigation
pipeline yourself on any Base token/contract. Read-only, keyless-first, returns a
scored JSON verdict + evidence report.

## Proof

- [OpenAI-token investigation (CAUTION 55/100)](examples/openai-token-investigation-proof.md) — real, unedited finding, 2026-07-05.
- [Live dashboard](https://juxtaposition1.github.io/V.A.P.E/) — refreshed each cycle.
- Screenshots: [mission + live track record](assets/track-record.png) ·
  [featured investigation case file](assets/case-file.png) ·
  [ACP + x402 engagement options](assets/engagement-options.png) ·
  [self-improvement development ledger](assets/development-ledger.png).

## Status

- **Live:** autonomous investigation engine + real-data dashboard (running now).
- **Live:** self-improvement loop opening real, human-reviewed PRs (see the Development Ledger).
- **Live, deployed and answering on Base mainnet:** the x402 pay-per-call worker for 6
  automated offerings + the $50 deep-dive audit.
- **Wired, awaiting first settled job:** ACP provider offerings (escrowed USDC
  settlement) and the x402 worker's first real paid call — zero-LLM
  auto-fulfillment is implemented and tested end-to-end, but no job has
  settled in production yet.

*Real data only. Not investment advice.*
