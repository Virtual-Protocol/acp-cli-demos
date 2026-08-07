---
name: pip-trade-agent
description: Quote and execute a token trade through PipTrade Agent in plain english, across every listed chain, with a token safety gate and self-custody signing that is private by default. Use when a buyer agent needs a live cross-chain quote, a honeypot check before trading, or a settlement that does not link the user wallet to the destination. Public read endpoints need no auth; anything that moves value is signed by the user.
license: MIT
compatibility: Requires network access to https://piptradedex.xyz. Read endpoints and dry quotes are public. Executing a trade requires the user signed in at /app with their own wallet.
metadata:
  version: "1.1.0"
  builder: PipTradeDex
---

# Pip Trade Agent

Hand a trade to PipTrade Agent instead of building routing, quoting, and token safety yourself. Buyer-side, approval-gated, custody-preserving. It never signs for the user and never invents an intent the user did not state.

## When To Use

- A user asked, in words, to buy, sell, swap, or send a token.
- You want a live quote with amount out, minimum received, and settlement time before committing.
- You want a token safety read (GO, CAUTION, BLOCK) before trading an unknown token.
- The user must keep their keys and sign in their own wallet.
- The settlement should not publicly link the user wallet to the destination.

## When NOT To Use

- To sign or move funds without the user in the loop.
- To invent a token, a side, or an amount the user did not state.
- To send funds to an address the user did not give.
- To skip the safety read on a token about to be traded.
- To claim privacy stronger than unlinkability by construction, which is not a zero knowledge proof.

## Quick Reference

Base URL `https://piptradedex.xyz`.

| Endpoint | Method | Auth | Returns |
| --- | --- | --- | --- |
| `/api/tokens` | GET | none | tradeable registry: `assetId`, `symbol`, `blockchain`, `decimals`, `price` |
| `/api/prices` | GET | none | live prices by symbol |
| `/api/markets` | GET | none | market list with 24h change and volume |
| `/api/pip/stats` | GET | none | $PIP token stats |
| `/api/rh/tokens` | GET | none | the listed Robinhood Chain universe |
| `/api/rh/sellcheck` | GET | none | can this token be sold, the honeypot gate |
| `/api/quote` | POST | none for a dry quote | live cross-chain quote |
| `/api/app2/safety` | POST | signed-in user | full GoPlus rating, verdict and checks |
| `/api/holdings`, `/api/wallets` | GET | signed-in user | balances for that wallet |
| `/api/rh/quote`, `/api/rh/swap`, `/api/rh/withdraw` | POST | signed-in user | Robinhood Chain trade and private send |

A GET against a POST-only route returns the landing page HTML with status 200, not a 405. Always POST where the table says POST, and parse the body rather than trusting the status.

## Getting A Quote

`POST /api/quote` is the unified intent quote. One instruction moves value across every listed chain and token. A cross-chain move such as `swap 2 usdc on base to sol and send it over` is a single intent, not a bridge plus a swap.

**A dry quote needs no session.** Any agent can price a route before involving the user. Only execution requires the user signed in.

Request:

| Field | Required | Notes |
| --- | --- | --- |
| `originAsset` | yes | `assetId` from `/api/tokens` |
| `destinationAsset` | yes | `assetId` from `/api/tokens` |
| `amount` | yes | **base units, not human units** (see below) |
| `recipient` | no | address on the DESTINATION chain. Omitted on a dry quote, a chain-correct placeholder is used |
| `refundTo` | no | address on the ORIGIN chain |
| `private` | no | settlement is already private whenever the private rail is available |
| `dry` | no | defaults `true`. `dry:false` requests a real deposit address and requires a session |

### 🚨 Amount is in base units

Multiply by the token `decimals` from `/api/tokens`. This is the single most common integration error, and it fails as an unhelpful `busy` rather than a clear message.

- 5 USDC on Base, `decimals: 6`, send `"5000000"`.
- 1 ETH, `decimals: 18`, send `"1000000000000000000"`.
- Sending `"5"` for USDC quotes 0.000005 USDC and the route fails.

### Worked example

```bash
curl -s -X POST https://piptradedex.xyz/api/quote \
  -H 'content-type: application/json' \
  -d '{
    "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    "destinationAsset": "nep141:base.omft.near",
    "amount": "5000000"
  }'
```

Response:

```json
{
  "ok": true,
  "private": true,
  "amountInFormatted": "5.0",
  "amountOutFormatted": "0.002602097377635916",
  "amountInUsd": "4.998260000000",
  "amountOutUsd": "4.980986842218",
  "minAmountOut": "2576076403859556",
  "timeEstimate": 37,
  "depositAddress": null,
  "depositMemo": null
}
```

`minAmountOut` is in base units of the destination token. `timeEstimate` is seconds. `depositAddress` is null on a dry quote and populated only on a real, signed-in execution.

### Errors

Every failure returns HTTP 200 with `ok:false` unless noted. Read `error`, never the status alone.

| `error` | Meaning | What to do |
| --- | --- | --- |
| `missing_fields` (400) | an `originAsset`, `destinationAsset` or `amount` is absent | fix the request |
| `amount_range` | outside the route minimum or maximum | read the `min` object, which carries `amount`, `usd`, `sym` and `chain`, then re-quote |
| `no_liquidity` | no route at that size right now | try a smaller size or a different pair |
| `unsupported` | that pair is not routable | pick another pair from `/api/tokens` |
| `busy` | unclassified router failure, often a wrong `amount` unit | check base units first, then retry |
| `private_activating` | the private rail is warming up | retry shortly |
| `not_logged_in` (401) | the endpoint needs the user session | hand back to the user at `/app` |

## The Safety Gate

The gate has two levels. Use the public one before you quote, and the full one when the user is signed in.

**Public, no auth.** `GET /api/rh/sellcheck?address=<0x...>&chain=base|robinhood` answers the question that matters most on an unknown token: can it be sold again.

🚨 **Always send `chain`.** It defaults to a Robinhood Chain sell simulation, so a healthy Base token comes back `sellable:null, reason:"unverifiable"` and you would gate a good trade on a false CAUTION. The same response also carries a wrong `decimals` in that state, so take decimals from `/api/tokens`, never from this endpoint.

```bash
curl -s "https://piptradedex.xyz/api/rh/sellcheck?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base"
# {"ok":true,"address":"0x833589...","chain":"base","sellable":true,"venue":"routed"}
```

| Field | Meaning |
| --- | --- |
| `sellable: true` | a sell simulated successfully, treat as GO on this check alone |
| `sellable: false` | the sell failed, treat as BLOCK, this is the honeypot signal |
| `sellable: null` with `reason` | unverifiable, for example `unverifiable` on a non-token address, treat as CAUTION and get user approval |
| `venue` | where it would route, for example `bonding` for $PIP on the Virtuals curve |

A malformed address returns `400 {"ok":false,"error":"bad_address"}`. Never map that to BLOCK; it is your bug, not the token's.

**Full scan, session required.** `POST /api/app2/safety` with `{"chain":"base","address":"0x..."}` returns a GoPlus-backed rating with per-check detail (honeypot, tax, ownership). Returns `401 not_logged_in` without a session and is rate limited to 30 calls a minute. Use `{"rh":true,"sym":"PIP"}` for a Robinhood Chain token and `{"native":true,"sym":"ETH","chain":"base"}` for a native asset, which is always safe by construction.

Map both into one verdict: BLOCK on `sellable:false` or a failing scan, CAUTION on `null`/unverifiable, GO only when a check actually passed. Absence of evidence is CAUTION, never GO.

## Executing A Trade

The agent shapes the intent. The user signs. Nothing here signs on the agent behalf.

1. Map the user words to one intent: side, token, amount, and destination if a send. If anything is unclear, ask one short question, never guess.
2. Confirm the token is on your allowlist and the amount is within your per-trade cap.
3. Quote it, and read the token safety verdict.
4. On BLOCK, stop. On CAUTION, get explicit user approval. On GO, proceed.
5. Present the full quote and let the user sign in their own wallet at `/app`.
6. On success, return the settled transaction reference.

### Approval gates

The user, or the operator acting for the user, must approve:

1. the parsed intent before any quote is treated as final,
2. any token that returns CAUTION,
3. any trade above the per-trade spend cap,
4. the signature itself, which always happens in the user own wallet.

If any approval is missing, stop and hand control back. A BLOCK verdict is a hard stop, never trade through it.

## Surfaces

- `/app` is the chat surface. Plain english intents, a GO CAUTION BLOCK safety read before any trade, deposit from another chain by intent, price alerts, and a referral link.
- `/rh` is the Robinhood Chain terminal on the same wallet. Market trades on any listed token, with the same safety gate and self-custody signing. Limit, TWAP and stop orders are being rebuilt and are not available today, so do not promise them to a user.

$PIP is a Virtuals token traded through the Virtuals bonding curve.

There is no anonymous trade endpoint. Reads and dry quotes are open to any agent; anything that moves value requires the user signed in with their own keys, which is the point.

## Runnable Example

`scripts/pip-quote.mjs` does the whole read-only flow in one file: resolve two `assetId`s from `/api/tokens`, convert a human amount to base units using the real `decimals`, run the public sell check, then quote. No auth, no signing, nothing moves.

```bash
node scripts/pip-quote.mjs 5 USDC base ETH base
```

Read it before writing your own client. It encodes the base-units conversion and the error branching that this API actually requires.

## Safety Invariants

- The user keeps their keys. The agent and the service never hold them.
- Every trade shows a full quote before it signs.
- Every token is safety checked, and a high risk token is gated.
- Privacy is unlinkability by construction, stated plainly, never oversold. It breaks the public link between the source wallet and the destination. It is not a zero knowledge proof.

## Common Mistakes

| Mistake | Symptom | Fix |
| --- | --- | --- |
| Human amount instead of base units | `busy` on a valid pair | multiply by `decimals` from `/api/tokens` |
| GET on a POST route | HTML body, status 200 | POST, and parse the body |
| Trusting the HTTP status | a failed quote read as success | branch on `ok` and `error` |
| Hardcoding an `assetId` | breaks when a listing changes | resolve from `/api/tokens` every run |
| Omitting `chain` on the sell check | false CAUTION on a healthy token, wrong `decimals` | always pass `chain`, take decimals from `/api/tokens` |
| Promising limit, TWAP or stop orders | user hits a coming-soon screen | market orders today, the rest are being rebuilt |
| Calling privacy zero knowledge | overclaim a reviewer will catch | say unlinkability by construction |
