# Result (Redacted)

Agent wallet: 0xbae3...6944 (partially redacted)
Network: Base mainnet (8453)

## Execution Log

1. Read wallet USDC balance: $101.50
2. Balance exceeds $100 deposit threshold → excess above $1.50 reserve = $100.00
3. Checked vault paused(): false → proceed
4. previewDeposit(100000000) → 100 shares expected
5. Approved vault USDC allowance — tx confirmed on Basescan
6. deposit(100000000) — tx confirmed on Basescan
7. Received 100 raUSDC shares (matches preview)

## Verifiable On-Chain State (live)

- Vault position: `balance(0xbae3...6944)` → 100000000 ($100.00)
- Vault totalAssets: $120.00 (includes other depositors)
- Reserve/Deployed split: $44.40 / $75.60 (70% in Aave V3)
- Verify: https://basescan.org/address/0x00325d9da832b38179ed2f0dabd4062d93e325a7

## Redaction Notes

- Private key: never logged
- Full wallet address: redacted to first/last 4 bytes
- Transaction hashes: omitted here; verifiable via the vault's Basescan event log
