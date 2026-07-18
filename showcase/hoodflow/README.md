# HoodFlow

HoodFlow is a self-custody Robinhood Chain market interface. Its Virtuals adapter separates discovery from execution: public lifecycle metadata identifies the launch state, while every executable quote is derived from live onchain liquidity. Bonding-stage markets use VIRTUAL as settlement; graduated markets can use USDG or another supported liquid pair.

This submission does not claim an ACP integration. It packages the existing wallet-and-token workflow for review and asks the Virtuals community whether the adapter should next expose a reusable quote or execution primitive for agents.

## Review the workflow

1. Open [hoodflow.app](https://hoodflow.app) and enter the community-markets workspace.
2. Select a listed market or import a Robinhood Chain token contract.
3. Inspect the detected lifecycle state and choose an available settlement token.
4. Refresh the quote. HoodFlow enables execution only when a live route returns an executable output.
5. Connect a self-custody wallet to review the exact approval and swap transaction before signing.

## Public proof

- [Integration review brief](https://github.com/dereliapps/hoodflow/blob/main/docs/VIRTUALS_REVIEW.md)
- [Block-pinned route proof](https://github.com/dereliapps/hoodflow/blob/main/docs/proofs/virtuals-karma-route-4663.json)
- [Release notes](https://github.com/dereliapps/hoodflow/releases/tag/v0.7.0)

The proof records the Robinhood Chain ID, block number, token addresses, pair reserves, input amount, route, and computed output for a USDG to VIRTUAL to KARMA quote. It contains no wallet credentials or private infrastructure values.

## Safety boundary

HoodFlow never treats launchpad metadata as proof of liquidity. A discovered token remains watch-only until an executable onchain quote passes the route checks. Users keep custody and approve each transaction in their own wallet; the recurring contracts remain clearly labeled pre-audit.
