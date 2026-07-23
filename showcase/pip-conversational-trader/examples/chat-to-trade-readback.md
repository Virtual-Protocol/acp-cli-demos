# Chat to trade readback

One worked example of the conversational execution flow, a plain-english instruction taken to a settled on-chain transaction. This shows the intent, the quote, and the on-chain result for that single trade. Nothing signs until the user confirms, and the trade runs on the user's own wallet.

## Input

```
buy 2 usd of PIP
```

## What Pip reads

```
side    buy
token   PIP
budget  2 usd
chain   Robinhood Chain
```

## Live quote shown before signing

```
route            USDG to VIRTUAL to PIP
spend            2.00 USDG
minimum received PIP, floored at the shown slippage
safety           GO, token passed the pre-trade safety read
you keep         your keys, this signs in your own wallet
```

## Settled on-chain

```
status   success
chain    Robinhood Chain, id 4663
tx       0x740e18daf3cd9d8296ebf8fe76287196bbfa7b022ba6691f8274906c72756ea1
result   PIP delivered to the user's own wallet, spend bounded to the stated 2 usd
```

Explorer: https://robinhoodchain.blockscout.com/tx/0x740e18daf3cd9d8296ebf8fe76287196bbfa7b022ba6691f8274906c72756ea1

## Why it matters for a buyer agent

The intent, the quote shape, and the settled result are all legible. An agent can hand Pip a trade in words, read a full quote before committing, and verify the outcome on-chain, while the user keeps custody the whole way through.
