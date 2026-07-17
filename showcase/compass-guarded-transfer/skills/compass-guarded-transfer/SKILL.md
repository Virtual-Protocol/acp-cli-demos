# Compass Guarded Transfer

Use this skill only for a **devnet** SOL transfer of more than zero and at most `0.001 SOL`.

## Safety boundary

Compass is bypassable advisory pre-execution validation in this showcase. It is not custody, co-signing, hard/on-chain enforcement, or post-execution transaction-to-verdict matching. Never use production funds or mainnet.

## Required confirmation

Before running, explicitly confirm the recipient, SOL amount, `devnet` cluster, and the fixed numeric `amountUsd` policy input. The recipient must also appear in the comma-separated `DEMO_RECIPIENT_ALLOWLIST`. ACP's active Solana wallet is resolved before preflight and pays transaction fees. Any changed fact requires a new confirmation and a new Compass preflight.

## Run

1. Copy `.env.example` to a private `.env` file and provide only the required runtime values. Keep the Compass API key private. `AMOUNT_USD_POLICY_INPUT` is a fixed reproducible policy value, not a live quote.
2. Install and authenticate the trusted `acp` command separately. This showcase targets the installed ACP CLI `v1.0.24` command/output shape: `acp wallet sol address --json` returns `{ "address": "<solana-address>" }`, and transfer returns `{ "signature": "<solana-signature>" }`. Tests use mocks; no live CLI proof is claimed.
3. Run `node --env-file=showcase/compass-guarded-transfer/.env showcase/compass-guarded-transfer/scripts/run-transfer.mjs` (Node 20.6+). This native Node flag loads the documented names without a dotenv dependency.
4. The runner uses cluster-independent `acp wallet sol address --json` before Compass and again immediately before transfer. The second address must byte-match the approved fee payer/agent wallet. Only exact lowercase Compass `allow` can invoke `acp wallet sol transfer --to <recipient> --amount <amount> --cluster devnet --json`; transfer is explicitly pinned to devnet. ACP has no wallet-ID transfer flag in this flow, so a residual advisory race remains after the second check; it is not hard binding. `review`, `deny`, malformed responses, timeout/network errors, wrong transfer cluster, input mismatch, or wallet mismatch stop before ACP transfer.

The runner prints allowlisted proof fields only. The public validation report records a real ACP wallet/preflight validation and one failed no-signature attempt; it is not successful transfer proof. For `review`, `deny`, or ACP failure, it prints a redacted stopped record before exiting. On timeout it sends SIGTERM, waits briefly, then SIGKILLs if needed and waits for close; an unreaped process is explicitly uncertain. It claims success only when ACP returns JSON with a valid Solana signature. On any uncertain ACP state, check ACP wallet history before retrying.
