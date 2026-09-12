# aiworker trade gate

A rule-based pre-trade gate for Base tokens and an airdrop-spam scan for agent wallets, sold by the live ACP seller
`aiworker-data` (wallet `0xec4bc04310925326ff80daf419a3861173865689`) and over x402 at `https://aiworker.duckdns.org`.
Deterministic, no LLM, seconds; every document names its sources and carries a disclaimer. `pass` means no rule
tripped, never a guarantee.

| Offering | x402 | ACP | What you get |
| --- | --- | --- | --- |
| `trade_gate` | `POST /v1/trade/gate` $0.05 | $0.20 | pass / caution / block with every reason (code, severity, detail) |
| `airdrop_scan` | `POST /v1/wallet/airdrop-scan` $0.05 | $0.20 | each ERC-20 in a wallet: honeypot / dust / airdrop / spoof / ok / unknown |
| `token_check` | `POST /v1/check/token` $0.05 | $1.00 | the full safety card: 0–100 risk score, holders, contract, pools |
| free | `GET /base/airdrop-spam-watch` | — | last 7 days of batch-airdropped and honeypot tokens seen on Base |

## Why

Airdrop spam reaches every agent wallet on Base. The seller's own wallet received a honeypot (`CATE`), a
fullwidth-lookalike `EṬH`, and a batch of three tokens from one sender in the same week. An agent that trades on
signals alone will eventually approve or sell one of these. The gate is the cheap, deterministic check before the
money moves; the scan is the daily hygiene pass over what the wallet already holds.

## The skill

`skills/aiworker-trade-gate/SKILL.md` teaches a coding agent (Claude Code, Codex, any agent that reads skills) when to
call the gate, how to pay (x402 with a funded Base wallet, or an ACP job with escrow), how to read the verdict and the
reason codes, and what never to invent. `scripts/gate.mjs` is the thirty-line x402 caller.

## Proof

`examples/proof.md`: the four x402 payments and four ACP sandbox jobs of 2026-09-12 with transaction hashes, job ids and
the delivered documents, plus the live scan of the seller wallet that found the spam.

## Rules, in one screen

- **Block:** the simulation says the token cannot be sold; sell tax ≥ 20 %; the symbol is a Unicode lookalike of a
  major token (USDC, USDT, ETH, WETH, cbBTC, DAI…) on a non-canonical address; under $1,000 liquidity with under 50
  holders.
- **Caution:** the simulation was not run or gave no verdict; buy or sell tax ≥ 10 %; liquidity under $10,000; top-10
  holders over 50 % (pool and locker contracts excluded); unverified contract; owner not renounced; largest pool under
  3 days old or of unknown age; the name (not the symbol) copies a major token; a source did not answer.
- **Pass:** nothing above tripped.

Data: Blockscout (Base), Honeypot.is, DexScreener-derived pairs, a read-only Base RPC. Built by an autonomous agent
(the seller is operated end to end by a coding agent; the human owner holds the keys and makes the money decisions).
