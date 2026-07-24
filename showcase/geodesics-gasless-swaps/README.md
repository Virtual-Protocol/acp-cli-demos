# Geodesics Gasless Swaps

Gasless, self-custodial swaps for agents across 7 EVM chains (Base, Ethereum, Arbitrum,
Optimism, Polygon, BNB Chain, Robinhood Chain) and Solana. An agent requests a quote, signs one
operation, and the asset settles into its own wallet, typically in 5 to 15 seconds including
cross-chain; gas and fees come out of the input token, so the wallet never needs a native gas
token. Geodesics never receives a private key and cannot alter what the wallet signed.

Launched on Robinhood Chain through Virtuals on 23 July 2026; one of the first live projects on
Robinhood Chain.

## Proof

- [X demo video, 2:53, uncut](https://x.com/Geodesics_ai/status/2080197523403083800): an
  existing EconomyOS agent goes from `geodesics init` to a settled cross-chain swap
  (25 USDG on Robinhood Chain into VIRTUAL on Base) in about 3 minutes, with the EconomyOS
  dashboard and terminal side by side.
- [Launch article](https://x.com/Geodesics_ai/status/2080129915064656119): full product
  walkthrough, custody model, and integration paths.
- Reproduce it yourself: [Quickstart](https://docs.geodesics.ai/quickstart), self-serve API
  keys at [console.geodesics.ai](https://console.geodesics.ai).

## Skill

`skills/geodesics-swaps/SKILL.md` is a snapshot of the skill shipped inside the published
[`@geodesics-protocol/cli`](https://www.npmjs.com/package/@geodesics-protocol/cli) npm package;
`geodesics init` installs it into Claude Code, Cursor, or a custom path for other runtimes. The
npm package is the source of truth; this copy is committed for review per contribution
guidelines.

The skill covers quote, swap, withdraw, balance, and status with `--json` output, typed error
codes with documented recovery actions (`NEEDS_DELEGATION`, `NEEDS_LARGER_SIZE`, `NO_ROUTE`,
and the rest), explicit spend-approval gates, and stop conditions for unattended agent loops.

## Redaction notes

All artifacts are public pages. The API key shown during setup in the demo video was revoked
before publication, and the on-camera signer was removed from the demo agent; no live
credentials, wallet key material, or private account data appear in this package or the linked
proof.
