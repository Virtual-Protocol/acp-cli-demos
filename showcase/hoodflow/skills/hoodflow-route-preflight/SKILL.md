---
name: hoodflow-route-preflight
description: Inspect HoodFlow's public Robinhood Chain market registry and prepare a short-lived, read-only Stock Token quote preflight. Use when an agent needs to verify a reviewed USDG route, oracle deviation, slippage floor, expiry, and user-wallet handoff without signing, submitting, or claiming an ACP job.
---

# HoodFlow Route Preflight

Prepare an indicative HoodFlow route check from public HTTPS endpoints. Keep the workflow read-only: HoodFlow must requote the intent and the user must approve any wallet action.

## Preconditions

- Use `https://hoodflow.app` as the canonical origin.
- Require an asset ticker, `buy` or `sell`, a positive decimal amount, and an optional slippage limit in basis points.
- Treat buy amounts as USDG and sell amounts as Stock Token units.
- Do not request a private key, seed phrase, wallet session, API key, or RPC credential.

## Workflow

1. Fetch `GET https://hoodflow.app/api/agents/hoodflow`.
2. Require chain ID `4663`, `autonomousSubmission: false`, and `registryStatus: "not-published"`. Stop if the capability or safety boundary differs.
3. Fetch `GET https://hoodflow.app/api/agents/markets` and select the exact ticker only when its status is `route-reviewed`.
4. Normalize the request:
   - uppercase the ticker;
   - keep side to `buy` or `sell`;
   - keep amount as a positive decimal string;
   - allow at most 6 decimals and 100,000 units for buys;
   - allow at most 18 decimals and 1,000,000 units for sells;
   - require integer `slippageBps` from 1 to 500, defaulting to 50 only when the caller did not specify it.
5. Submit the normalized JSON to `POST https://hoodflow.app/api/agents/quote` with `Content-Type: application/json`.
6. Validate the response before presenting it:
   - `status` is `indicative-preflight` and chain ID is `4663`;
   - asset, side, and slippage match the request, and pay amount is numerically equal after decimal normalization;
   - route protocol is Uniswap V3 or V4;
   - the reference is live, `oraclePaused` is false, `updatedAt` is present and not in the future, and `deviationBps` does not exceed `maxDeviationBps`; treat `status: live` as the API's freshness verdict rather than inventing a separate market-calendar threshold;
   - estimated and indicative-minimum outputs are positive;
   - `dataExpiresAt` is still in the future;
   - `executionBinding` is `none-requote-required`;
   - `custody` is `self-custody` and `requiresUserSignature` is true;
   - the handoff intent exactly matches the normalized request and the handoff URL uses HTTPS on the exact `hoodflow.app` host.
7. Return the bounded preflight summary and `executionHandoff.marketUrl`. State that the number is indicative, expires quickly, and must be requoted before the user signs.

Example request:

```bash
curl -sS https://hoodflow.app/api/agents/quote \
  -H 'content-type: application/json' \
  --data '{"asset":"AAPL","side":"buy","amount":"10","slippageBps":50}'
```

## Approval gates

- Stop before connecting a wallet, granting token approval, signing, or submitting a transaction.
- Continue into a value-moving flow only after the user separately approves the exact asset, side, amount, slippage, fresh quote, and destination chain.
- Never describe this preflight as an ACP job, Agent Wallet transaction, executed order, or guaranteed price.

## Stop conditions

- Stop on an unsupported ticker or any response/request mismatch.
- Stop when the quote is expired, the oracle is paused or stale, the deviation guard fails, or minimum output is zero.
- On HTTP `422`, correct the caller's input; do not guess a replacement.
- On HTTP `408`, report the timeout and retry only after a short delay.
- On HTTP `429`, respect `Retry-After`; do not create a retry storm.
- On HTTP `503`, report that no safe executable route is available; do not synthesize a quote or use cached output.

## Output contract

Return:

- asset, side, pay amount and ticker;
- estimated receive amount and indicative minimum;
- route protocol plus both `fee` and `feeBps` exactly as returned, without reinterpreting the pool fee units;
- oracle reference price and deviation;
- expiry timestamp;
- exact HoodFlow handoff URL;
- the boundary: `preflight only; fresh quote and user signature required`.

Do not include credentials, private infrastructure URLs, wallet secrets, or invented execution evidence.
