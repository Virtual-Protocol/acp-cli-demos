# HoodFlow

HoodFlow is a self-custody Robinhood Chain market interface. Its public Agent API lets an agent read route-reviewed Stock Token markets and prepare a short-lived buy or sell preflight before handing the exact intent to the user's wallet. Its Virtuals adapter separately distinguishes lifecycle discovery from execution: bonding-stage markets use VIRTUAL as settlement, while graduated markets become executable only when a live liquid route returns a valid quote.

This submission does not claim a live Virtuals ACP listing or autonomous signing. It publishes an inspectable provider manifest, market registry, and quote-preflight contract so reviewers can evaluate whether the bounded surface should become an ACP resource. HoodFlow never holds funds, requests private keys, or submits a transaction for the user.

## Review the agent surface

1. Open the [interactive agent workspace](https://hoodflow.app/?view=agents).
2. Inspect the [public Agent API manifest](https://hoodflow.app/api/agents/hoodflow) for capabilities, safety boundaries, and endpoint contracts.
3. Read the [execution-market registry](https://hoodflow.app/api/agents/markets) exposed to agents.
4. Use the [Agent API guide](https://hoodflow.app/docs#agents) to prepare a bounded buy or sell preflight.
5. Confirm that the result is indicative, expires after 75 seconds, and requires a fresh HoodFlow quote before the user signs.

## Review the community-market workflow

1. Open [hoodflow.app](https://hoodflow.app) and enter the community-markets workspace.
2. Select a listed market or import a Robinhood Chain token contract.
3. Inspect the detected lifecycle state and choose an available settlement token.
4. Refresh the quote. HoodFlow enables execution only when a live route returns an executable output.
5. Connect a self-custody wallet to review the exact approval and swap transaction before signing.

## Public proof

- [Public Agent API manifest](https://hoodflow.app/api/agents/hoodflow)
- [Agent API guide](https://hoodflow.app/docs#agents)
- [Integration review brief](https://github.com/dereliapps/hoodflow/blob/main/docs/VIRTUALS_REVIEW.md)
- [Block-pinned route proof](https://github.com/dereliapps/hoodflow/blob/main/docs/proofs/virtuals-karma-route-4663.json)
- [Release notes](https://github.com/dereliapps/hoodflow/releases/tag/v0.7.0)

The proof records the Robinhood Chain ID, block number, token addresses, pair reserves, input amount, route, and computed output for a USDG to VIRTUAL to KARMA quote. It contains no wallet credentials or private infrastructure values.

## Safety boundary

HoodFlow never treats launchpad metadata as proof of liquidity. A discovered token remains watch-only until an executable onchain quote passes the route checks. Agent preflights are short-lived, never execution-bound, and cannot sign or submit a transaction. Users keep custody and approve each transaction in their own wallet; the recurring contracts remain clearly labeled pre-audit.
