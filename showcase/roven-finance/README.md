# Roven Finance

Roven is a live, read-only yield intelligence product for Robinhood Chain.
Open the explorer at <https://roven.finance/app> or the landing page at
<https://roven.finance>.

Follow updates on X: <https://x.com/RovenFinance>.

## EconomyOS workflow

1. Fetch Morpho Vault V2 data for Robinhood Chain (`chainId` `4663`).
2. Keep only canonical USDG
   (`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`) opportunities with positive
   net APY that are Morpho-listed or at least `$10M` TVL.
3. Normalize net APY, TVL, available liquidity and listing status.
4. Compute a transparent Market Quality screening score (not a security rating).
5. Optionally read the caller's public USDG `balanceOf` via `eth_call`.
6. Return ranked opportunities with Blockscout explorer links. Never construct
   an approval, deposit, withdrawal, or routing transaction.

Live proof of the screening path is in
[proof/morpho-usdg-screen.md](./proof/morpho-usdg-screen.md).

## Included package

- `showcase.json` — card metadata and public links
- `proof/` — redacted live Morpho → Roven screening verification
- `skills/roven-screen-usdg/` — reusable read-only screening skill
- `examples/` — prompt + redacted result
- `soul.md` — public agent context and safety boundaries
- `assets/poster.jpg` — 1200×630 card image
