# ArrowLend Idle USDG

Route an agent's idle USDG into the ArrowLend lending pool on Robinhood Chain, earn yield from borrower interest via the aUSDG share token, and withdraw automatically when the agent needs funds for payments.

## When to Use

- An agent holds USDG that sits idle between jobs or payments.
- The agent wants to earn real, borrow-sourced yield on that idle balance without manual intervention.
- The agent operates on Robinhood Chain and has an Agent Wallet.

## When Not to Use

- The agent needs 100% of its balance liquid at all times (no idle capital to spare).
- The agent operates on a chain other than Robinhood Chain.
- The deposit amount is smaller than the gas cost of the transaction.
- The agent wants to borrow against collateral — this skill only covers the supply/earn side, which is what is live today.

## Required Inputs

- Agent wallet signer (via Agent Wallet).
- Robinhood Chain RPC URL (`https://rpc.mainnet.chain.robinhood.com`).
- Threshold config: `depositThreshold`, `reserveMinimum`, `withdrawTrigger` (all in USDG, 6 decimals).

## Preconditions

- Agent wallet funded with USDG on Robinhood Chain.
- Small native-gas balance for transaction fees.

## Workflow

1. Read the agent's USDG balance via `balanceOf(agent)` on the USDG token.
2. Read the agent's pool position: `convertToAssets(balanceOf(agent))` on the ArrowLend pool (aUSDG shares -> USDG value).
3. If wallet USDG exceeds `depositThreshold`:
   a. Approve the pool to spend USDG (`approve(pool, amount)`).
   b. Supply the excess above `reserveMinimum` (`supply(assets, agent)`), which mints aUSDG to the agent.
4. If wallet USDG drops below `withdrawTrigger` and the agent holds aUSDG:
   a. Withdraw the configured amount (`withdraw(assets, agent)`), which burns aUSDG and returns USDG.
5. Repeat on an interval (default: 60 seconds).

## Approval Gates

- USDG approval transaction (one-time or per-deposit).
- Supply transaction.
- Withdraw transaction.

## Stop Conditions

- Pool is paused (check `paused()` before supplying).
- Insufficient gas balance.
- Deposit amount below economic threshold.
- Requested withdrawal exceeds pool available liquidity (`totalAssets() - totalDebt()`); retry with a smaller amount or wait.

## Evidence and Redaction Rules

- Never log or commit the agent private key or signer material.
- Redact wallet addresses in public reports if the agent requires privacy.
- Transaction hashes are public and safe to share.

## Validation Checklist

- [ ] Pool is not paused.
- [ ] Deposit amount is above gas cost.
- [ ] Reserve minimum is maintained in the wallet.
- [ ] Withdrawal returns USDG to the agent wallet.

## Output Contract

Returns transaction hashes for each supply/withdraw, plus current position:
`{ shares: bigint, value: bigint, walletUsdg: bigint }` (all USDG amounts in 6 decimals).

## Contracts (Robinhood Chain Mainnet, chainId 4663)

- ArrowLend Pool (aUSDG): `0x562ac0d6d140b6e285ACbe2ad642C8c32E1D7dA6`
- USDG (6 decimals): `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`

## Links

- App: https://arrowlend.app
- Pool on explorer: https://robinhoodchain.blockscout.com/address/0x562ac0d6d140b6e285ACbe2ad642C8c32E1D7dA6
- Reference implementation: `arrowlend-idle-usdg.ts` in this folder
