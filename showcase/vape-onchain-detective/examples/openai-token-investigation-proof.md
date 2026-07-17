# Proof — V.A.P.E. auto-caught a factory-deployed impersonation token (CAUTION 55/100)

This is a **real, unedited** investigation V.A.P.E. produced autonomously on Base.
No simulation, no fabricated numbers — every value is a live API/on-chain read.

## Context

V.A.P.E.'s deep-investigation engine (`agents/investigate.py`, run with `--auto`)
selects the **highest-signal live Base target** each cycle. On 2026-07-05 it
flagged a token trading under the name **"OpenAI"** — a brand-impersonating name
deployed through a permissionless meme-token factory template — and investigated
it end-to-end, returning a **CAUTION** verdict with specific, sourced rationale.

## The verdict

| Field | Value |
| --- | --- |
| Target | `0x454777B9a11EC75B23E809F1cE3d4b30De7fAB07` (Base) |
| Symbol | OpenAI |
| Verdict | 🟡 **CAUTION** |
| Safety score | **55 / 100** |
| Date (UTC) | 2026-07-05T18:08:35Z |

### Rationale (weighted penalties)

- `[-20]` Deployed via a **permissionless meme-token factory template** (ClankerToken) —
  no team vetting by design; this pattern strongly correlates with abandoned/rugged tokens
- `[-15]` Pair only **2.4 days old** (extreme fresh-launch risk)
- `[-10]` No known third-party audit or verifiable team identity found — treated as
  unaudited/anonymous by default

### Positive signals (real legitimacy evidence found)

- Ownership renounced
- 13,426 holders — reasonably distributed

### Evidence captured (real data)

- **Market/Liquidity (DexScreener):** price $0.00000006930 · liquidity $479,632.53 ·
  24h vol $228.2 · 24h change -98.76% · DEX uniswap
- **Token Security (GoPlus):** is_honeypot `0` · buy_tax `0` · sell_tax `0` ·
  is_mintable `0` · is_proxy `0` · can_take_back_ownership `0` · owner_change_balance `0` ·
  hidden_owner `0` · transfer_pausable `0` · holder_count `13426` ·
  owner_address `0x000...000` (renounced)
- **On-chain Presence (Base RPC):** is_contract `true` · code size 12,791 bytes
- **Contract Verification (Etherscan V2):** verified `true` · name `ClankerToken` ·
  compiler `v0.8.28+commit.7893614a` · proxy `false`
- **Threat Correlation (DeFiLlama hacks):** no match to recent exploit techniques
- **Public Web Signals:** no unambiguous scam/rug mentions found in top web search results

The interesting signal here is **not** a honeypot flag (there is none), nor an
unrenounced owner (ownership is renounced) — it's the **combination** of a
brand-impersonating name, a no-vetting factory-deployment pattern, and a
sub-3-day-old pair. That combination is exactly what a human investigator would
down-rank even when every individual on-chain flag comes back clean, and V.A.P.E.
surfaced it automatically, without a human in the loop.

## How to reproduce

```bash
git clone https://github.com/jUXTAPOSITION1/V.A.P.E.git
cd V.A.P.E
python3 -m pip install -r agents/requirements.txt
python agents/investigate.py --address 0x454777B9a11EC75B23E809F1cE3d4b30De7fAB07 --chain 8453
```

Live values (liquidity, price, holder count) move with the market, so a later run
will show current numbers — but the pipeline, scoring, and report shape are
identical to what is shown above.

## Where this is published

- **Live dashboard (auto-refreshed each cycle):** https://juxtaposition1.github.io/V.A.P.E/
  — "Featured Investigation" and the "Investigation Archive" both link every
  finding back to its source report on GitHub.
- **Source report in-repo:** `intel/investigations/` in
  https://github.com/jUXTAPOSITION1/V.A.P.E
- **Permanent verdict ledger:** every verdict V.A.P.E. has ever filed is recorded in
  `intel/investigations/ledger.json`, and re-checked on a schedule
  (`agents/review_ledger.py`) against fresh data — a verdict that drifts logs a
  real finding rather than silently going stale.

## Redaction note

This report contains only public on-chain data and public API responses. No
private keys, operator secrets, wallet material, or non-public account records
are included.
