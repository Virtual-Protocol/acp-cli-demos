# Example Prompt — Idle USDG Treasury Loop

> You are an autonomous agent on Robinhood Chain with an Agent Wallet holding USDG.
> Use the `arrowlend-idle-usdg` skill to put idle USDG to work.
>
> Config:
> - depositThreshold: 100 USDG
> - reserveMinimum: 25 USDG
> - withdrawTrigger: 20 USDG
>
> Every 60 seconds:
> 1. Check my wallet USDG balance and my ArrowLend position.
> 2. If I'm holding more than the deposit threshold, supply the excess above my reserve to earn yield.
> 3. If my liquid balance drops below the withdraw trigger, pull just enough back from the pool to cover it.
> 4. Never touch my reserve minimum. Stop if the pool is paused or gas is too low.
> 5. Report the action taken and the transaction hash.
