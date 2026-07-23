# HoodFlow

HoodFlow is a self-custody Robinhood Chain market interface. Its public Agent API lets an agent read route-reviewed Stock Token markets and prepare a short-lived buy or sell preflight before handing the exact intent to the user's wallet. Its Virtuals adapter separately distinguishes lifecycle discovery from execution: bonding-stage markets use VIRTUAL as settlement, while graduated markets become executable only when a live liquid route returns a valid quote.

This submission does not claim a live Virtuals ACP listing or autonomous signing. It publishes an inspectable provider manifest, market registry, and quote-preflight contract so reviewers can evaluate whether the bounded surface should become an ACP resource. HoodFlow never holds funds, requests private keys, or submits a transaction for the user.

## Review the agent surface

1. Open the [interactive agent workspace](https://hoodflow.app/?view=agents).
2. Inspect the [public Agent API manifest](https://hoodflow.app/api/agents/hoodflow) for capabilities, safety boundaries, and endpoint contracts.
3. Read the [execution-market registry](https://hoodflow.app/api/agents/markets) exposed to agents.
4. Use the [Agent API guide](https://hoodflow.app/docs#agents) to prepare a bounded buy or sell preflight.
5. Confirm that the result is indicative, expires after 75 seconds, and requires a fresh HoodFlow quote before the user signs.

## Completed execution proof

On 2026-07-22, a HoodFlow Agent API preflight prepared a 1 USDG INTC buy intent. HoodFlow carried that exact side, asset, amount, and slippage into a fresh quote; the user wallet then confirmed the router transaction. Robinhood Chain finalized the transaction successfully in block `16478330`.

- Transaction: [`0x7c9d...03c3`](https://robinhoodchain.blockscout.com/tx/0x7c9d4dcea9c32b5df03283b010617084499d5ab29ca8a093c9f49a6e5c2303c3)
- Machine-readable receipt: [Blockscout API](https://robinhoodchain.blockscout.com/api/v2/transactions/0x7c9d4dcea9c32b5df03283b010617084499d5ab29ca8a093c9f49a6e5c2303c3)
- Decoded proof: [`proofs/executed-intc-buy-4663.json`](./proofs/executed-intc-buy-4663.json)
- Input transfer: `1.0 USDG`
- Output transfer: `0.00937386626109376 INTC`

This records a completed user-wallet token trade after an Agent API preflight. It does not evidence an EconomyOS Agent Wallet or ACP job. The Agent API did not initiate, sign, or submit the transaction; the user wallet remained the signer. The receipt independently proves the trade, but the preceding offchain preflight is builder-attested and is not cryptographically bound to the transaction.

## Reuse the preflight workflow

The [`hoodflow-route-preflight` skill](./skills/hoodflow-route-preflight/SKILL.md) packages the public API workflow for another agent. It verifies the capability manifest and reviewed-market registry, requests a short-lived quote, checks the oracle/deviation/slippage/expiry fields, and returns the exact user-wallet handoff. Its stop conditions forbid wallet connection, token approval, signing, transaction submission, fabricated fallbacks, and ACP claims.

Install after cloning this repository:

```bash
cp -R showcase/hoodflow/skills/hoodflow-route-preflight ~/.agents/skills/
cp -R showcase/hoodflow/skills/hoodflow-route-preflight ~/.claude/skills/
```

## Media proof

- [Commit-pinned 16:9 Showcase poster](https://raw.githubusercontent.com/dereliapps/acp-cli-demos/8245617/showcase/hoodflow/assets/poster.png)
- [Watch the 30-second product tour on X](https://x.com/hoodfloow/status/2079596780711227597)
- [Direct H.264 Showcase asset](https://raw.githubusercontent.com/dereliapps/acp-cli-demos/b34a371c1a44f0d43416b0d83914cb1b2a2308b3/showcase/hoodflow/assets/demo.mp4)

## Review the community-market workflow

1. Open [hoodflow.app](https://hoodflow.app) and enter the community-markets workspace.
2. Select a listed market or import a Robinhood Chain token contract.
3. Inspect the detected lifecycle state and choose an available settlement token.
4. Refresh the quote. HoodFlow enables execution only when a live route returns an executable output.
5. Connect a self-custody wallet to review the exact approval and swap transaction before signing.

## Public proof

- [Public Agent API manifest](https://hoodflow.app/api/agents/hoodflow)
- [Agent API guide](https://hoodflow.app/docs#agents)
- [Completed user-signed wallet/token transaction](https://robinhoodchain.blockscout.com/tx/0x7c9d4dcea9c32b5df03283b010617084499d5ab29ca8a093c9f49a6e5c2303c3)
- [Integration review brief](https://github.com/dereliapps/hoodflow/blob/main/docs/VIRTUALS_REVIEW.md)
- [Block-pinned route proof](https://github.com/dereliapps/hoodflow/blob/main/docs/proofs/virtuals-karma-route-4663.json)
- [Release notes](https://github.com/dereliapps/hoodflow/releases/tag/v0.7.0)

The proof records the Robinhood Chain ID, block number, token addresses, pair reserves, input amount, route, and computed output for a USDG to VIRTUAL to KARMA quote. It contains no wallet credentials or private infrastructure values.

## Safety boundary

HoodFlow never treats launchpad metadata as proof of liquidity. A discovered token remains watch-only until an executable onchain quote passes the route checks. Agent preflights are short-lived, never execution-bound, and cannot sign or submit a transaction. Users keep custody and approve each transaction in their own wallet; the recurring contracts remain clearly labeled pre-audit.
