# PipTrade Agent

PipTrade Agent gives you two ways to trade on the same self-custody wallet. In chat you say it in plain english and Pip does it. On the /rh terminal you work the desk with real order types. Both keep your keys, both settle private by default, and $PIP is a Virtuals token traded through the Virtuals bonding curve.

## In chat, at /app

You type a trade the way you would say it, and Pip reads the intent, shows a live quote, and executes on your own wallet.

- Swap, in plain english, with a live quote before anything signs (price impact, minimum received, route, estimated time).
- Send, privately, so the destination is not directly linked to your wallet.
- Price and balance, asked and answered in the same thread.
- Token safety, a GO, CAUTION, or BLOCK read on a token before you trade it.
- Price alerts, set in words, like alert when ETH hits 4000.
- Deposit from another chain, funded into your wallet, refund safe.
- Referral, your own code and link, so you can bring others in.

## At the desk, on /rh

A full Robinhood Chain terminal on the same wallet.

- Trade any listed Robinhood Chain token, with a honeypot and sell guard so you are not trapped in something you cannot exit.
- Quote transparency on every trade, with a safety badge on the token.
- Order types, market, limit, TWAP, and stop, run by a keeper so they fire while you are away.
- Private send, so a transfer is not directly linked back to you.

## How it keeps you safe

- You keep your keys. Pip never signs for you, every trade is signed in your own wallet.
- Every trade is safety checked, and a high risk token is gated before you can proceed.
- Quotes are shown in full before execution, and nothing moves until you confirm.

## What is in this entry

- examples/chat-to-trade-readback.md, a plain-english intent taken all the way to a settled on-chain transaction.
- examples/private-by-default.md, an honest account of what private by default hides and what it does not.
- examples/command-surface.md, every instruction in chat and every order type on the terminal.
- soul.md, the public agent context and boundaries.

## Try it

Open https://piptradedex.xyz/app for chat, or https://piptradedex.xyz/rh for the terminal.
