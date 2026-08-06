# Private by default, stated honestly

Pip settles trades and sends private by default. This page shows three real settlements the operator made, with the on-chain links, and says exactly what the privacy does and does not mean so no one reads more into it than is true.

## Three real private settlements

### Swap A, base to base

- Direction: 30 USDC to 0.0155305 ETH
- Private: yes
- Done: 2026-07-21 19:09 UTC
- Result: two on-chain legs, and the receive is not directly linked to the send.

There is a send leg where funds leave the user wallet:

https://basescan.org/tx/0xaf00110622fa7ff93b9cb2c7ef2655c775d95814b84e1a2c01bea4ef0410377d

And a private receive leg where the funds arrive at the user wallet 0xbbd9aCE37cc8AF0C11Fd050b01a95Ae2d9e8D9f0 from a different counterparty 0x2cff890f0378a11913b6129b2e97417a2c302680:

https://basescan.org/tx/0x2821db35ab0f66ed898a10a8ce5c28f12994cedc3edbb2163d86d9ad217d62ee

Because the receive arrives from a different counterparty than the one the send paid, an observer cannot trivially connect the funds that left the wallet to the funds that arrived. Both transactions are confirmed successful on Base.

### Swap B, cross-chain base to sol

- Direction: 0.000598 ETH to 0.0146482 SOL
- Private: yes
- Done: 2026-07-22 09:08 UTC
- Settled to the in-app Solana wallet C1zCrNGXNc92TmY6f9NWUUaKZjoAbPk9QKn1LHbmN6k4

Crossing to Solana further breaks the link, because the destination sits on a different chain than the funds that were spent on Base.

### Swap C, base to base

- Direction: 0.00011957 ETH to 0.2259 USDC
- Private: yes
- Settled to the in-app base wallet

## What is hidden

- The route and the counterparty link. An observer looking at the chain cannot trivially connect the funds that left your wallet to where they arrived, because the receive comes from a different counterparty, and in the cross-chain case it lands on a different chain.
- This applies to swaps and sends by default, not as an extra step you have to remember.

## What is not hidden

- This is unlinkability by construction, not a zero knowledge proof. There is no cryptographic proof of a hidden statement here, only a break in the direct on-chain link.
- It does not promise anonymity against every possible analysis. A determined analyst with side information can still infer the connection.
- It hides nothing from you. You keep your keys the whole way through, and you see the full quote, the route, and the result.

## Why we frame it this way

Overclaiming privacy is how users get hurt. Pip states the boundary plainly, unlinkability and not zero knowledge, so a person or an agent acting for a person can decide with accurate expectations.

## Verify

Try a swap or a send at https://piptradedex.xyz/app and read the quote and settlement for yourself, then check the transactions above on Base.
