# Arcis Idle Capital

Route an agent's idle USDC into the Arcis yield vault on Base, earning ~3.2% APY through Aave V3, and withdraw automatically when the agent needs funds for payments.

## When to Use

- An agent holds USDC that sits idle between jobs or payments.
- The agent wants to earn yield on that idle balance without manual intervention.
- The agent operates on Base and has an Agent Wallet.

## When Not to Use

- The agent needs 100% of its balance liquid at all times (no idle capital).
- The agent operates on a chain other than Base.
- The deposit amount is smaller than the gas cost of the transaction.

## Required Inputs

- Agent wallet private key or signer (via Agent Wallet).
- Base RPC URL (Alchemy or public endpoint).
- Threshold config: depositThreshold, reserveMinimum, withdrawTrigger.

## Preconditions

- Agent wallet funded with USDC on Base.
- Small ETH balance for gas.

## Workflow

1. Read the agent's USDC balance via `balanceOf(agent)` on USDC.
2. Read the agent's vault position via `balance(agent)` on the Arcis vault.
3. If wallet USDC exceeds depositThreshold:
   a. Approve the vault to spend USDC (`approve(vault, amount)`).
   b. Deposit the excess above reserveMinimum (`deposit(amount)`).
4. If wallet USDC drops below withdrawTrigger and the agent holds shares:
   a. Withdraw the configured amount (`withdraw(shares)`).
5. Repeat on an interval (default: 60 seconds).

## Approval Gates

- USDC approval transaction (one-time or per-deposit).
- Deposit transaction.
- Withdraw transaction.

## Stop Conditions

- Vault is paused (check `paused()` before depositing).
- Insufficient gas balance.
- Deposit amount below economic threshold.

## Evidence and Redaction Rules

- Never log or commit the agent private key.
- Redact wallet addresses in public reports if the agent requires privacy.
- Transaction hashes are public and safe to share.

## Validation Checklist

- [ ] Vault is not paused.
- [ ] Deposit amount is above gas cost.
- [ ] Reserve minimum is maintained in the wallet.
- [ ] Withdrawal returns USDC to the agent wallet.

## Output Contract

Returns transaction hashes for each deposit/withdraw, plus current position:
`{ shares: bigint, value: bigint, walletUsdc: bigint }`.

## Contracts (Base Mainnet)

- Arcis Vault: `0x00325d9da832b38179ed2f0dabd4062d93e325a7`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Links

- Website: https://arcis.money
- Dashboard: https://arcis.money/dashboard
- Full implementation: https://github.com/Arcis-Protocol/docs/blob/main/examples/arcis-x402-idle-capital.ts
- SDK: npm install @arcisprotocol/sdk
