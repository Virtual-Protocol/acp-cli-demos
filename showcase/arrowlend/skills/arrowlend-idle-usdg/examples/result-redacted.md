# Example Result — Idle USDG Treasury Loop (redacted)

Agent wallet address redacted as `0xAGENT…`. Transaction hashes are public on
the Robinhood Chain explorer.

## Tick 1 — supply excess

```
position (before): { shares: 0, value: 0.00 USDG, walletUsdg: 140.00 USDG }
walletUsdg 140.00 > depositThreshold 100.00 → supply excess above reserve 25.00
approve(pool, 115.00 USDG)  → tx 0xAPPROVE…  (confirmed)
supply(115.00 USDG, 0xAGENT…) → tx 0xSUPPLY…  (confirmed)
action: supplied
position (after): { shares: 115.00, value: 115.00 USDG, walletUsdg: 25.00 USDG }
```

## Tick N — accrual (no action)

```
position: { shares: 115.00, value: 115.42 USDG, walletUsdg: 25.00 USDG }
walletUsdg 25.00 within band → hold
```

*aUSDG value drifts up from 115.00 → 115.42 USDG as borrowers pay interest;
share count is unchanged.*

## Tick M — refill on payment need

```
position (before): { shares: 115.00, value: 115.42 USDG, walletUsdg: 18.00 USDG }
walletUsdg 18.00 < withdrawTrigger 20.00 → withdraw need 2.00 USDG
available liquidity check: totalAssets − totalDebt ≥ 2.00 → ok
withdraw(2.00 USDG, 0xAGENT…) → tx 0xWITHDRAW…  (confirmed)
action: withdrew
position (after): { shares: 113.02, value: 113.42 USDG, walletUsdg: 20.00 USDG }
```

The agent never dips below its 25 USDG reserve on the supply side, earns yield
on idle capital between payments, and self-heals liquidity when it needs to
spend — no human in the loop.
