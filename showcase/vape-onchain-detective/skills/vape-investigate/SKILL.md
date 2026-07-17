---
name: vape-investigate
description: Run a V.A.P.E. deep on-chain investigation on a Base token/contract — multi-source keyless recon (GoPlus, DexScreener, Base RPC, Etherscan V2, DeFiLlama hack feed) that returns a 0-100 safety score and a PROCEED / CAUTION / REJECT verdict with a linkable evidence report.
version: 1.0.0
---

# V.A.P.E. Deep On-Chain Investigation

Use this skill to investigate a Base token or contract **before** you buy, list,
delegate authority, or accept a counterparty in an ACP job. It runs the same
autonomous, real-data pipeline V.A.P.E. (Virtual Ape Private Eye) runs every
cycle, and produces a scored verdict plus a redaction-safe evidence report you
can link publicly.

It is deliberately **read-only and keyless-first**: every finding is sourced
from public APIs and on-chain reads. It never signs, spends, or mutates state.

## When to use it

- You have a Base token/contract address (`0x...`) and need a fast, evidence-backed
  risk read: honeypot, taxes, mint/ownership powers, liquidity depth, pair age,
  contract verification, and correlation to recent real exploit techniques.
- You are screening an ACP counterparty's token/contract before committing to a job.
- You want a repeatable "highest-signal target" sweep of live Base movers
  (`--auto` picks a violent-mover / thin-liquidity target automatically).

## When NOT to use it

- **Not a full smart-contract audit.** For deep bytecode/formal analysis use a
  dedicated auditor (slither/aderyn/mythril tiers or an audit-grade provider).
  This skill flags surface risk; it does not prove absence of vulnerabilities.
- **Not investment advice.** A `PROCEED` verdict means "no automated red flags,"
  not "safe to buy."
- **Not for private keys, seed phrases, or off-chain PII.** Inputs are public
  addresses only. Refuse anything else.
- Chains other than Base are best-effort only (pass the correct chain id).

## Inputs

- `--address 0x...` — the target token/contract on Base, **or**
- `--auto` — let the engine select the highest-signal live Base target.
- `--chain <id>` — chain id (default `8453` = Base).

## Tools, credentials, preconditions

- Python 3.11+, `git`. No paid keys required for the core scan.
- Data sources (all keyless): **GoPlus** token-security, **DexScreener** liquidity,
  **Base RPC** (`eth_getCode`), **DeFiLlama** `/hacks` feed.
- **Optional** `ETHERSCAN_API_KEY` (Etherscan V2 unified key) enables the
  contract-verification dimension. Without it, all other recon still runs.

Install:
```bash
git clone https://github.com/jUXTAPOSITION1/V.A.P.E.git
cd V.A.P.E
python3 -m pip install -r agents/requirements.txt   # stdlib-first; light deps
export ETHERSCAN_API_KEY=your_key_here              # OPTIONAL, Base verification
```

## Workflow

1. Confirm the input is a **public address**, never a secret. Stop if it isn't.
2. Run the investigation:
   ```bash
   # explicit target
   python agents/investigate.py --address 0x... --chain 8453
   # or auto-select the highest-signal live Base target
   python agents/investigate.py --auto
   ```
3. The engine runs GoPlus + DexScreener + Base RPC + (optional) Etherscan V2 +
   hack-feed correlation, computes a weighted **0-100 safety score**, and files:
   - `intel/investigations/investigation-<UTC>-<short>.md` — full evidence report
   - a `finding` entry in Memory (`skillforge/memory/findings.jsonl`)
   - a row in the investigation catalog
4. Read the verdict: `PROCEED` (>=75) / `CAUTION` (45-74) / `REJECT` (<45), the
   penalty rationale, and the raw recon appendix.

## Approval gates

This skill performs **no** spending, posting, account creation, deployment, or
on-chain mutation — so no approval gate is required to run a scan. If you wire it
behind an ACP provider that settles paid jobs, the **payment/settlement** step
(set-budget / submit) is a separate action and MUST be gated on the operator's
explicit authorization of job, price, and counterparty.

## Stop conditions & handoff

- Stop immediately if the input is a private key, seed phrase, or non-address.
- If GoPlus/DexScreener return nothing for the target (unlisted/illiquid), report
  that explicitly rather than inferring safety — hand off to a manual/deep review.
- If a `REJECT` is driven by a honeypot or owner-can-drain flag, hand off to the
  human before any transaction is considered.

## Validation checks

- `python agents/investigate.py --address <known-good-token>` returns a verdict
  and writes a report file under `intel/investigations/`.
- Re-running the same `--auto` target within 12h is de-duplicated (guard), so the
  engine won't re-hammer the same mover.
- The generated report contains the four evidence sections (Market/Liquidity,
  Token Security, On-chain Presence, Threat Correlation) with real values.

## Output contract

`investigate.py` prints and returns a JSON object:
```json
{
  "target": "0x...",
  "symbol": "OpenAI",
  "verdict": "CAUTION",
  "score": 68,
  "report": "intel/investigations/investigation-YYYYMMDD-HHMMSS-0x....md",
  "reasons": ["[-10] Low liquidity $26,641", "[-12] Pair only 0.7 days old (fresh-launch risk)"]
}
```

Redaction: outputs contain only public on-chain data and public API responses.
Never include private keys, operator secrets, or non-public account records.
