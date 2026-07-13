# Compass Guarded Transfer

Use this skill only for a **devnet** SOL transfer of more than zero and at most `0.001 SOL`.

## Safety boundary

Compass is bypassable advisory pre-execution validation in this showcase. It is not custody, co-signing, hard/on-chain enforcement, or post-execution transaction-to-verdict matching. Never use production funds or mainnet.

## Required confirmation

Before running, explicitly confirm the recipient, SOL amount, `devnet` cluster, fee payer, and the fixed numeric `amountUsd` policy input. The recipient must also appear in the comma-separated `DEMO_RECIPIENT_ALLOWLIST`. Any changed fact requires a new confirmation and a new Compass preflight.

## Run

1. Copy `.env.example` to a private `.env` file and provide only the required runtime values. Keep the keypair and API key private. `AMOUNT_USD_POLICY_INPUT` is a fixed reproducible policy value, not a live quote.
2. Install the local dependency: `npm install --prefix showcase/compass-guarded-transfer`.
3. Run `node --env-file=showcase/compass-guarded-transfer/.env showcase/compass-guarded-transfer/scripts/run-transfer.mjs` (Node 20.6+). This native Node flag loads the documented names without a dotenv dependency.
4. Only an exact lowercase Compass `allow` can continue. The runner confirms the RPC genesis is Solana devnet before preflight, build, signing, or sending. `review`, `deny`, malformed responses, timeout/network errors, wrong cluster, input mismatch, RPC errors, and simulation errors stop before signing or sending.

The runner prints allowlisted proof fields only. For `review` or `deny`, it prints a redacted stopped record before exiting. If broadcast succeeds but proof output fails, it returns the signature with a warning; do not retry blindly. Do not claim a transfer ran unless a real devnet signature was returned.
