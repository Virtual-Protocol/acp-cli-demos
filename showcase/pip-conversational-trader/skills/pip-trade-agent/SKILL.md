---
name: pip-trade-agent
description: Hand a trade to PipTrade Agent in plain english, read the live quote, respect the token safety gate, and confirm a self-custody settlement that is private by default. Buyer-side, approval-gated, keeps the user in custody.
version: 1.0.0
license: MIT
---

# Pip Trade Agent

Use this skill when a buyer agent wants to execute a token trade for a user through PipTrade Agent instead of building routing, quoting, and token safety from scratch. The skill is buyer-side, approval-gated, and custody-preserving. It never signs for the user and never invents an intent the user did not state.

## When To Use

- A user asked, in words, to buy, sell, swap, or send a token.
- The buyer agent wants a live quote with price impact, minimum received, and route before committing.
- The trade should be gated by a token safety read (GO, CAUTION, or BLOCK).
- The user must keep their keys and sign in their own wallet.
- Settlement should be private by default, breaking the on-chain link between the wallet and the destination.

## When NOT To Use

- Do not use it to sign or move funds without the user in the loop.
- Do not use it to invent a token, a side, or an amount the user did not state.
- Do not use it to send funds to an address the user did not give.
- Do not use it to skip the token safety read on a token about to be traded.
- Do not use it to claim privacy stronger than unlinkability by construction, which is not a zero knowledge proof.

## Inputs

- One trade intent in plain english, for example buy 10 usd of PIP, or swap 2 usdc on base to sol and send it over.
- The chain context if the user named one, otherwise let Pip infer from the token.
- A per-trade spend cap and an allowlist of tokens the agent may act on.
- The user approval state for anything that signs.

## Outputs

- A parsed intent, side, token, and amount, echoed back for confirmation.
- A live quote, price impact, minimum received, route, and estimated time.
- A token safety verdict, GO, CAUTION, or BLOCK.
- A settled transaction reference on success, delivered to the user own wallet.

## Approval Gates

The user, or the operator acting for the user, must approve:

1. the parsed intent before any quote is treated as final,
2. any token that returns CAUTION,
3. any trade above the per-trade spend cap,
4. the signature itself, which always happens in the user own wallet.

If any approval is missing, stop and hand control back to the user. A BLOCK verdict is a hard stop, never trade through it.

## Workflow

1. Read the user words and map them to a single intent, side, token, amount, and destination if a send. If anything is unclear, ask one short question, never guess.
2. Confirm the token is on the agent allowlist and the amount is within the per-trade cap.
3. Request a quote and a token safety read. Show price impact, minimum received, route, estimated time, and the GO CAUTION BLOCK verdict.
4. On BLOCK, stop. On CAUTION, get explicit user approval. On GO, proceed.
5. Present the full quote to the user and let the user sign in their own wallet. The agent never signs.
6. On success, return the settled transaction reference. Settlement is private by default, so the destination is not directly linked to the source.

## Interface

PipTrade Agent runs at https://piptradedex.xyz/app for chat and https://piptradedex.xyz/rh for the terminal. On the terminal the same intent maps to a market, limit, TWAP, or stop order, run by a keeper, on any listed Robinhood Chain token, with the same safety gate and self-custody signing. $PIP is a Virtuals token traded through the Virtuals bonding curve.

## Endpoints

Read only, public, callable by any agent today at https://piptradedex.xyz:

- GET /api/prices, live token prices.
- GET /api/markets, market list with 24h change and volume.
- GET /api/tokens, the tradeable token registry with decimals and logos.
- GET /api/pip/stats, $PIP token stats.

At /app, intent based, signed in with the user own wallet. The agent shapes the intent, the user signs, and nothing here signs on the agent behalf:

- POST /api/quote, the unified intent quote and swap. One instruction moves value across every listed chain and token, private by default, so the on-chain link between the wallet and the destination is broken. A cross-chain move like swap 2 usdc on base to sol and send it over is a single intent.
- GET /api/wallets and GET /api/holdings, balances for the signed-in wallet.
- The /app chat drives the rest on the same signed-in wallet, a GO CAUTION BLOCK token safety read before any trade, deposit from another chain by intent, price alerts in plain english, and a referral link.

At /rh, the Robinhood Chain terminal on the same wallet:

- GET /api/rh/tokens, the listed token universe.
- POST /api/rh/quote and POST /api/rh/swap, a market trade on any listed token with a safety badge.
- Market, limit, TWAP, and stop orders, run by a keeper.
- POST /api/rh/withdraw, a private send.

There is no anonymous trade endpoint. Trading always requires the user signed in with their own keys, which is the point. An agent uses the public reads freely and shapes the signed-in intents through the user at /app.

## Safety Invariants

- The user keeps their keys. The agent and the service never hold them.
- Every trade shows a full quote before it signs.
- Every token is safety checked, and a high risk token is gated.
- Privacy is unlinkability by construction, stated plainly, never oversold.
