---
name: acp-sec-scan
description: Run an acp-sec Trust Score scan on an on-chain ACP agent contract and interpret the result.
version: 0.5.0
---

# acp-sec Trust Score Scan

Use this skill to assess whether an on-chain agent contract is safe to transact
with, by computing an acp-sec **Trust Score** (0-100, graded A to F) across six
security dimensions. Works standalone (CLI) or as the executor behind the
acp-sec ACP Provider.

## Prerequisites

Complete these before invoking the skill — copying the skill folder does **not**
install the `acpsec` CLI it calls.

1. Install `acpsec` from source:
   ```bash
   git clone https://github.com/acpsec/acp-sec.git
   cd acp-sec
   python3 -m venv .venv && source .venv/bin/activate
   pip install -e .
   ```
2. Optional but recommended — enable Dimension 1 (Contract Security) deep checks:
   ```bash
   pip install slither-analyzer
   ```
3. Export a `BASESCAN_API_KEY` (Etherscan V2 unified key — one key works for Base
   mainnet and Base Sepolia via the `chainid` param):
   ```bash
   export BASESCAN_API_KEY=your_key_here   # get one at https://etherscan.io/apis
   ```
4. Verify the install:
   ```bash
   acpsec trust-score --help
   ```

## Inputs

- A target contract address (`0x...`) on Base.
- Chain: `base-sepolia` (default) or `base-mainnet`.
- Scan mode: `external` (public/on-chain data only) or `self_audit` (operator
  may supply private data such as Agent Card spend limits).
- A `BASESCAN_API_KEY` (Etherscan V2 unified key) for contract source/ABI.

## Workflow

1. Confirm the input is a public contract address, never a private key.
2. Run the scan:
   ```bash
   acpsec trust-score --agent 0x... --chain base-sepolia --scan-mode external --output scan.json
   ```
   Or, as the ACP Provider bridge:
   ```bash
   python -m acpsec.acp_provider "scan 0x..." --chain base-sepolia
   ```
3. Read the result: `score`, `grade`, `critical`, the six `subscores`,
   `top_findings` (sorted by severity), and any `unrated_checks`.
4. Interpret the numeric score (0-100) and letter grade (A ≥ 90, B ≥ 75, C ≥ 60,
   D ≥ 40, F below 40) together with the subscores and findings. Treat a
   `critical: true` result as a hard stop regardless of the numeric score.
5. Note Unrated dimensions: missing data is reported as Unrated and lowers the
   confidence multiplier; do not read it as "safe".

## Output

Return the Trust Score JSON (or the ACP deliverable wrapping it), including the
score, grade, subscores, top findings, the list of Unrated checks, the scanner
version, and the UTC scan timestamp so a reviewer can reproduce and audit it.

## Boundaries / stop conditions

- Read-only: never sign, transfer, or mutate the assessed contract.
- Never log, print, or include private keys, session keys, wallet material, or
  API keys in any output or proof artifact.
- If contract source is unverified or data is unavailable, report it (Unrated)
  rather than guessing.
- A Trust Score is a point-in-time assessment, not a guarantee or financial
  advice.
