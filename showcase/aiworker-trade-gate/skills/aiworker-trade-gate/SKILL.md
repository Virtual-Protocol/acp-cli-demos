---
name: aiworker-trade-gate
description: Check a Base token with a rule-based pre-trade gate (honeypot simulation, taxes, liquidity, holders, contract, lookalike names) before any swap, and scan a wallet for airdrop spam — paid per call in USDC over x402, or as an ACP job. Deterministic, no LLM, seconds.
version: 1.0.0
---

# aiworker trade gate

Use this skill whenever an agent is about to buy, sell, approve or hold a token on Base and needs a fact-based
answer to "is this safe to touch?" before it moves money. It also tells the agent which of the tokens sitting in its
own wallet are airdrop spam, honeypots or name lookalikes, so it never approves or trades them.

Three paid calls, one free page:

| Call | What it answers | x402 price | ACP price |
| --- | --- | --- | --- |
| `trade_gate` | pass / caution / block for one token, with every reason | $0.05 | $0.20 |
| `airdrop_scan` | every ERC-20 in a wallet marked honeypot / dust / airdrop / spoof / ok / unknown | $0.05 | $0.20 |
| `token_check` | the full safety card behind the gate (0–100 risk score, holders, contract, pools) | $0.05 | $1.00 |
| free | the last 7 days of batch-airdropped and honeypot tokens seen on Base | — | — |

Everything is rule-based over public data (Blockscout, Honeypot.is, DexScreener-derived pairs, the Base RPC). No
model, no forecast, no signal. `pass` means no rule tripped, never a guarantee.

## Prerequisites

Pick one payment path.

**x402 (HTTP, pay per call):** a Base wallet holding a little USDC (a few cents per call; EIP-3009 payments need no ETH),
its private key in an environment variable, and an x402 client. Node:

```bash
npm install @x402/core @x402/evm @x402/fetch viem
export AIWORKER_BUYER_KEY=0x…   # the buyer wallet's key; never paste it into a prompt or a file
```

**ACP (job with escrow):** the Virtuals `acp` CLI configured with a funded agent wallet. The seller is
`aiworker-data` (wallet `0xec4bc04310925326ff80daf419a3861173865689`).

## Workflow

1. **Resolve the token address.** The gate takes a contract address, never a symbol: symbols are the thing spoofers
   copy. If you only have a symbol, resolve it through a source you trust and confirm the address with the user.
2. **Call the gate before the trade.**
   - x402: `node scripts/gate.mjs 0x<token>` (the script linked below), or any x402 client:
     `POST https://aiworker.duckdns.org/v1/trade/gate` with body `{"address":"0x…"}`. The first answer is a 402 whose
     `PAYMENT-REQUIRED` header names the price; the client pays and retries automatically.
   - ACP: `acp client create-job --provider 0xec4bc04310925326ff80daf419a3861173865689 --offering trade_gate --requirement '{"address":"0x…"}'`,
     then fund and wait for the deliverable (a Markdown page with the JSON document in its last fenced `json` block).
3. **Act on the verdict.**
   - `block` → do not trade, do not approve, say why (the `reasons[]` list, each with `code`, `severity`, `detail`).
     Block codes: `honeypot` (cannot be sold), `sell_tax` (≥ 20 %), `name_spoof` (a symbol lookalike of USDC, USDT,
     ETH, WETH, cbBTC…), `thin_market` (under $1,000 liquidity with under 50 holders).
   - `caution` → surface every reason to the user and ask for an explicit go-ahead. Caution codes: `honeypot_unchecked`
     (no simulation), `honeypot_unverified` (the simulation gave no verdict), `buy_tax` / `sell_tax` at ≥ 10 %,
     `low_liquidity` (under $10,000), `top10_concentration` (over 50 %), `unverified_contract`, `owner_not_renounced`,
     `new_pool` (under 3 days), `pool_age_unknown`, `name_lookalike` (the name, not the symbol, copies a major token),
     `data_incomplete` (a source did not answer).
   - `pass` → proceed. Quote the liquidity and the pool age in the confirmation so the user sees what "pass" rested on.
4. **Once a day, scan the agent's own wallet.** `POST /v1/wallet/airdrop-scan` with `{"address":"0x<agent wallet>"}`
   (or the `airdrop_scan` ACP offering). Treat every token with verdict `honeypot`, `spoof` or `dust` as untouchable:
   never approve it, never try to sell it, never count it in the portfolio value. `holdings_index: "empty"` means the
   explorer's holdings index was behind and the list came from the transfer feed — still act on it.
5. **Never invent what the document does not say.** A `null` field is an unanswered source, not a zero. A `503` is an
   upstream outage: nothing was charged; retry later rather than guessing.

## When not to use it

- Tokens on any chain but Base (`eip155:8453`): the gate answers `404 not_a_contract` or a wrong-chain card. Do not
  reuse a Base verdict for the same symbol elsewhere.
- As a price or timing signal: the document carries no forecast. Pair it with your own market logic.
- As the only check on a large trade: `pass` is "no rule tripped", not a guarantee; keep the user's confirmation.

## Approval gates

- **Spending:** each x402 call spends the listed price from `AIWORKER_BUYER_KEY`'s wallet; each ACP job locks the
  offering price in escrow. Tell the user the price once per session before the first call and stop if the wallet
  cannot cover it (a `402` after the retry means the balance is short — never move funds to fix that on your own).
- **Trading:** a `block` ends the workflow; a `caution` needs an explicit human go-ahead quoting the reasons; a `pass`
  proceeds only if the user asked for the trade in the first place.
- Never approve, sell or "clean up" tokens the scan marked `honeypot`, `spoof` or `dust`, even if asked to sell them —
  explain why instead (a honeypot cannot be sold; a spoof approval can drain the real token's allowance).

## Stop conditions and handoff

- Stop and report when the gate answers `503`, `504` or `502` twice in a row, when the buyer wallet is short, or when
  the token address could not be confirmed. Hand the user the last document verbatim and the reason you stopped.
- Never retry a paid call in a loop: at most two attempts per token per session.

## Validation and output contract

Before acting, check the document: `verdict` is one of `pass | caution | block`; `reasons` is an array; `chain` is
`eip155:8453`; `address` equals the one you sent (lower-cased). Report to the user: the verdict in one line, the
reasons as a list (severity, code, detail), the liquidity, pool age and holder count it rested on, the `generated_at`
time, and the disclaimer sentence. Say which fields were `null` rather than dropping them.

## The gate document

```json
{
  "chain": "eip155:8453", "address": "0x…", "verdict": "caution",
  "reasons": [{ "code": "top10_concentration", "severity": "medium", "detail": "Top 10 holders hold 31.3% of supply." }],
  "honeypot": { "checked": true, "is_honeypot": false, "buy_tax_pct": 0, "sell_tax_pct": 0 },
  "liquidity_usd": 788332.15, "largest_pool_age_days": 540, "holders_count": 948010, "top10_share_pct": 31.3,
  "contract": { "verified": true, "renounced": true, "age_days": 560 }, "name_spoof": false,
  "token": { "name": "Brett", "symbol": "BRETT" }, "generated_at": "…", "sources": [{ "name": "honeypot", "ok": true }],
  "disclaimer": "A rule-based gate over public data; informational only, not investment advice; pass is not a guarantee."
}
```

## Errors

| Status | Meaning | What to do |
| --- | --- | --- |
| 400 `invalid_address` | not a 0x address | fix the input; nothing charged |
| 404 `not_a_contract` | the address holds no code on Base | wrong chain or wrong address; nothing charged |
| 402 | unpaid, or the wallet's USDC is short | fund the buyer wallet |
| 503 `chain_unavailable` | an upstream did not answer | retry in a minute; nothing charged |
| 504 `handler_timeout` | the upstreams were too slow | retry; nothing charged |

## Script

`scripts/gate.mjs` — kept in the aiworker-examples repo, not here:
`https://github.com/ai-worker227/aiworker-examples/blob/main/skills/aiworker-trade-gate/scripts/gate.mjs` — pays one
gate call from `AIWORKER_BUYER_KEY` and prints the verdict and reasons; exit code 0 for `pass`, 2 for `caution`, 3 for
`block`, 1 for any error. Read it before running it: it is thirty lines. Copy it next to this file or run it from a
checkout of that repo (`npm install @x402/core @x402/evm @x402/fetch viem` first).

## Where the data comes from

Blockscout (Base), Honeypot.is buy/sell simulation, DexScreener-derived pairs, a read-only Base RPC. Discovery documents:
`https://aiworker.duckdns.org/llms.txt`, `/openapi.json`, `/catalog.json`; the MCP endpoint `https://aiworker.duckdns.org/mcp`
serves the same tools at the same prices. The free page: `https://aiworker.duckdns.org/base/airdrop-spam-watch`.
