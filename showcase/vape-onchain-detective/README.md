# V.A.P.E. — Virtual Ape Private Eye

**Autonomous on-chain detective for Base.** V.A.P.E. investigates tokens and
contracts in real time, scores their risk, and publishes **linkable, real-data
verdicts** to a live dashboard — then sells the same investigations as an ACP
provider.

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

It computes a **0-100 safety score** and files a `PROCEED / CAUTION / REJECT`
verdict, logs it to Memory, and surfaces it on the dashboard — where every finding
deep-links to its source report.

## EconomyOS primitives

- **ACP** — V.A.P.E. is a registered ACP provider (ERC-8004 identity) selling
  security offerings (`exploit_check`, `token_safety_check`, `safety_preflight`).
- **wallet** — agent-owned Base wallet for identity and job settlement.
- **token** — tokenized agent (`0x2b60…daFE` on Base).

## Reusable skill

[`vape-investigate`](skills/vape-investigate/) — run the exact investigation
pipeline yourself on any Base token/contract. Read-only, keyless-first, returns a
scored JSON verdict + evidence report.

## Proof

- [OpenAI-token investigation (CAUTION 68/100)](examples/openai-token-investigation-proof.md) — real, unedited finding.
- [Live dashboard](https://juxtaposition1.github.io/V.A.P.E/) — refreshed each cycle.
- Screenshots: [dashboard](assets/dashboard-overview.png) ·
  [investigation hero](assets/investigation-hero.png) ·
  [intel explorer](assets/intel-explorer.png).

## Status

- **Live:** autonomous investigation engine + real-data dashboard (running now).
- **Wired, awaiting first settled job:** ACP provider offerings + zero-LLM
  auto-fulfillment for the deterministic security offerings.

*Real data only. Not investment advice.*
