# Demo prompt

Given to a Claude Code session with the `aiworker-trade-gate` skill installed and `AIWORKER_BUYER_KEY` set to a Base
wallet holding a few cents of USDC:

> I want to swap 50 USDC into BRETT on Base (0x532f27101965dd16442E59d40670FaF5eBB142E4). Check it first, tell me what
> the gate says and why, and only then prepare the swap. Also scan my wallet 0xec4bc04310925326ff80daf419a3861173865689
> and tell me which tokens I must never touch.

Expected behaviour: the agent runs `scripts/gate.mjs` (one $0.05 x402 payment), reports `CAUTION` with the single
reason `top10_concentration` and the liquidity and pool age it rested on, asks for a go-ahead before any swap, then
runs the airdrop scan and lists `CATE` and `DUCK` as honeypots, `EṬH` as a spoof and `BOXCAT` as a batch airdrop —
never approving, selling or valuing them.
