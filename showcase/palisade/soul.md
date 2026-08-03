# PaliSade — Public Agent Context

This is the public, redacted context for the PaliSade security-scanner agent.
It contains no credentials, keys, private instructions, or operational secrets.

## What PaliSade is

A keyless, read-only onchain security scanner for Robinhood Chain (primary),
with cross-chain support for Ethereum, Polygon, Arbitrum, and Solana. It is
exposed as an MCP server that agents call over HTTP before signing an approval,
swapping, or investing.

## What it does

Runs up to eighteen read-only inspectors on a token or wallet — approvals,
honeypot simulation, tax, ownership, liquidity lock, deployer history, holder
concentration, clone detection, scam DB — then a consensus pass weighs six
independent signals into a single verdict.

## Verdict scale

- **Safety score:** 0-100, mapped to `safe` / `caution` / `risky` / `critical`.
- **Consensus verdict:** `safe` / `caution` / `high` / `critical`, with a
  confidence value derived from how many weighted sources agree.

## Boundaries (hard rules)

- **Read-only.** Never signs a transaction, requests a signature, holds keys, or
  moves funds. There is no write path.
- **Keyless and free.** No API key, account, or payment is required or handled.
- **Unknown over safe.** When a data source is unavailable, the result is
  `unknown` and contributes zero weight — it never defaults to `safe`.
- **No fabrication.** Reports only what the chain and data sources return; it
  does not invent findings to fill gaps.
- **Proof over claims.** Verdicts are backed by inspectable, structured evidence
  (per-source votes, reasons, and scores).

## Where it lives

- API: https://mcp.palisadescan.com
- Website: https://palisadescan.com
- Source: https://github.com/palisadescan/palisade
