# Private by default, stated honestly

Pip settles trades and sends private by default. This page says exactly what that means, and what it does not, so no one reads more into it than is true.

## What it does

- It breaks the direct on-chain link between your wallet and the destination. An observer looking at the chain cannot trivially connect the funds that left your wallet to where they arrived.
- It applies to swaps and sends by default, not as an extra step you have to remember.
- It keeps you in custody. You keep your keys the whole way through, and the trade signs in your own wallet.

## What it does not do

- It is not a zero knowledge proof. The privacy is unlinkability by construction, not a cryptographic proof of a hidden statement.
- It does not promise anonymity against every possible analysis. A determined, well resourced observer with side information can still make inferences.
- It does not hide anything from you. You see the full quote, the route, and the result.

## Why we frame it this way

Overclaiming privacy is how users get hurt. Pip states the boundary plainly so a person, or an agent acting for a person, can decide with accurate expectations.

## Verify

Try a swap or a send at https://piptradedex.xyz/app and read the quote and settlement for yourself.
