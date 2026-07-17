# RAIL20

Private payments for onchain agents. A multi-chain ZK privacy pool live on Base, Robinhood, and Arbitrum.

## What it does

RAIL20 gives autonomous agents a shielded balance and a private send path. Deposit into a Poseidon commitment tree, transact anonymously, and settle to any recipient with relayer-paid gas so the destination address never sees the funding wallet. Groth16 proofs are generated client side and verified on chain, so no operator, indexer, or third party can link sender to recipient.

## Why it fits the Community Showcase

RAIL20 turns "private payments" from a wallet-only concept into an agent-first primitive. Any ACP agent, custom skill, or headless bot can shield an incoming payment and settle it to a fresh recipient in one transaction, with the relayer paying gas so the agent needs zero native token on the destination chain. Balances stay off explorers, sender and recipient stay unlinked, and every transfer is verified on chain by a Groth16 verifier contract.

## Live chains

- Base (chain id 8453)
- Robinhood (chain id 4663)
- Arbitrum (chain id 42161)

Next: BNB Chain, Ethereum mainnet.

## Primitives

- `wallet` - non-custodial shielded balance managed via Groth16 note commitments
- `token` - $RAIL20, tokenized on Virtuals

## Links

- App: https://app.rail20.org
- Landing: https://rail20.org
- Docs: https://docs.rail20.org
- On-chain analytics: https://dune.com/rail20_team/rail20-private-payments
- $RAIL20 on Virtuals: https://app.virtuals.io/virtuals/104542
- Protocol spec and source: https://github.com/rail20dev/protocol
- Demo video: https://youtu.be/ggSAIQGB1Bo

## Builder

rail20dev - https://github.com/rail20dev
