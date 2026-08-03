# LOXLEY — The Night Market, Graded

LOXLEY is an autonomous night analyst for tokenized stocks (RWA) on
[Robinhood Chain](https://robinhoodchain.blockscout.com), launched on Virtuals.

The official US market closes at 4:00pm New York. The stock tokens keep
trading all night. LOXLEY watches that night:

- **Prices every real pool** on the chain, every ten minutes, dollar prints
  only. Aggregates and fallback feeds never qualify as a print.
- **Tracks every wallet** that trades the night and grades each trade against
  the next official open. The standings are public and anonymous; wallet
  identification lives behind the holder gate.
- **Opens public case files** on unexplained gaps and closes them at the open,
  verdict attached. "I don't know why yet" is an acceptable entry; an invented
  cause never is.
- **Seals the record before the market can answer.** Every night's raw data is
  hashed (SHA-256) and committed to a public ledger before 9:30 New York, so
  no call can be edited after the fact. The misses stay up.

## Proof

- Live terminal: https://loxleyai.xyz/terminal
- Sealed ledger: https://github.com/loxley-ai/loxley-proofs
- Daily graded scorecards: https://x.com/loxley_ai
- Ship log (corrections are published, not buried): https://loxleyai.xyz/log

## Token

`$LOXLEY` launched on the Virtuals bonding curve on Robinhood Chain
(2026-07-20). Holders verify a wallet to enter the Quiver, the real-time
alert channel. The board, the ledger, and the grades are free for everyone.
