# Command surface

Everything PipTrade Agent can do, across chat and the terminal. Pip reads the intent, asks when something is unclear, and never invents a token, a side, or an amount you did not state.

## In chat, at /app

### Trade

```
buy 10 usd of PIP
sell half my PIP
swap 2 usdc on base to sol and send it over
ape 5 usd into VIRTUAL
```

### Move

```
send 3 usdc to 0x... privately
withdraw 0.01 eth to 0x...
deposit 20 usdc from arbitrum
```

### Ask

```
price of PIP
what is my balance
is this token safe 0x...
```

### Watch and grow

```
alert when ETH hits 4000
alert me if PIP drops 20 percent
give me my referral link
```

## At the desk, on /rh

- Trade any listed Robinhood Chain token, with a honeypot and sell guard.
- Market order, fill now at the shown quote.
- Limit order, fill only at your price or better.
- TWAP order, spread a size over time.
- Stop order, protect a position.
- Private send, so the transfer is not directly linked back to you.
- A safety badge and full quote on every trade.

## Rules Pip follows everywhere

- It shows a full quote before anything signs.
- It runs a token safety read and gates a high risk token.
- It signs in your own wallet, and never for you.
- It settles private by default, breaking the on-chain link between your wallet and the destination.

Chat at https://piptradedex.xyz/app, terminal at https://piptradedex.xyz/rh.
