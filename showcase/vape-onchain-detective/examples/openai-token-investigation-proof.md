# Proof — V.A.P.E. auto-caught an anomalous Base token (CAUTION 68/100)

This is a **real, unedited** investigation V.A.P.E. produced autonomously on Base.
No simulation, no fabricated numbers — every value is a live API/on-chain read.

## Context

V.A.P.E.'s deep-investigation engine (`agents/investigate.py`, run with `--auto`)
selects the **highest-signal live Base target** each cycle. On 2026-07-01 it
flagged a token trading under the name **"OpenAI"** that had spiked ~+100,000% on
a mover feed. The engine investigated it end-to-end and returned a **CAUTION**
verdict with specific, sourced rationale.

## The verdict

| Field | Value |
| --- | --- |
| Target | `0xcC67e54FC715246E5B27a97E69747Ecd4c6375B6` (Base) |
| Symbol | OpenAI |
| Verdict | 🟡 **CAUTION** |
| Safety score | **68 / 100** |
| Date (UTC) | 2026-07-01T21:11:18Z |

### Rationale (weighted penalties)

- `[-10]` Low liquidity **$26,641**
- `[-10]` Violent 24h move **+577%** (volatility / manipulation)
- `[-12]` Pair only **0.8 days old** (fresh-launch risk)

### Evidence captured (real data)

- **Market/Liquidity (DexScreener):** price $0.00006415 · liquidity $26,640 ·
  24h vol $11,403 · 24h change +577% · DEX uniswap
- **Token Security (GoPlus):** is_honeypot `0` · is_mintable `0` · is_proxy `0` ·
  can_take_back_ownership `0` · owner_change_balance `0` · hidden_owner `0`
- **On-chain Presence (Base RPC):** is_contract `true` · code size 3,652 bytes
- **Contract Verification:** skipped (keyless run; enable with `ETHERSCAN_API_KEY`)
- **Threat Correlation (DeFiLlama hacks):** no match to recent exploit techniques

The interesting signal here is not a honeypot flag (there is none) — it's the
**combination** of a name impersonating a major brand, a fresh sub-day-old pair,
thin liquidity, and a violent price move. That pattern is exactly what a human
investigator would down-rank, and V.A.P.E. surfaced it automatically.

## How to reproduce

```bash
git clone https://github.com/jUXTAPOSITION1/V.A.P.E.git
cd V.A.P.E
python3 -m pip install -r agents/requirements.txt
python agents/investigate.py --address 0xcC67e54FC715246E5B27a97E69747Ecd4c6375B6 --chain 8453
```

Live values (liquidity, price, pair age) move with the market, so a later run
will show current numbers — but the pipeline, scoring, and report shape are
identical to what is shown above.

## Where this is published

- **Live dashboard (auto-refreshed each cycle):** https://juxtaposition1.github.io/V.A.P.E/
  — the "Latest Investigation" hero and the "Intel Explorer" both link every
  finding back to its source report on GitHub.
- **Source report in-repo:** `intel/investigations/` in
  https://github.com/jUXTAPOSITION1/V.A.P.E

## Redaction note

This report contains only public on-chain data and public API responses. No
private keys, operator secrets, wallet material, or non-public account records
are included.
