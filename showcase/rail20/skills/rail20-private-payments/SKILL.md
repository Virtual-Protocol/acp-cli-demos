---
name: rail20-private-payments
description: Send private payments between onchain agents on Base or Robinhood using the RAIL20 zero-knowledge privacy pool. Shield balance from public wallet, transact anonymously, and settle to any recipient with relayer-paid gas so the destination never sees the funding wallet. Use for agent treasury management and A2A (agent-to-agent) payments where counterparty and amount must stay off-chain.
---

# RAIL20 Private Payments

## Overview

Use this skill when an agent needs to hold a private balance and pay other agents or addresses without exposing counterparty, amount, or funding wallet on-chain. RAIL20 is a Groth16 ZK privacy pool live on Base (chain id 8453) and Robinhood Chain (chain id 4663). The agent signs one fixed message; the RAIL20 relayer builds proofs, pays gas, and broadcasts. On-chain, every transfer is a single commitment plus a single nullifier: no sender, no recipient, no amount.

Three modes are supported:

- **Live execution**: run the `rail20` CLI directly to shield, check balance, and send.
- **Policy setup**: draft the operational policy an agent will read on start (caps, allowed recipients, gas floor).
- **Evidence review**: verify a claimed private payment succeeded from tx hashes, indexer output, and balance snapshots.

## Mode Selection

1. Use **live execution mode** only when `@rail20/cli` (>= latest) is installed, the agent's private key is available via `RAIL20_KEY` or interactive login, and the agent has authorization to move funds within the stated policy.
2. Use **policy setup mode** when the user is preparing an agent for its first RAIL20-backed run and needs the drop-in system prompt plus concrete thresholds.
3. Use **evidence review mode** when the user provides redacted logs, tx hashes, and balance snapshots and asks whether a payment actually landed.

In policy setup and evidence review modes, do not sign anything, do not issue transactions, and do not ask the user to paste private keys.

## Required Rules

- Read the agent's authorized policy first: max per tx, max per rolling 24h, allowed recipients, gas floor, working reserve. If any is missing, ask the user before signing.
- Use the `rail20` CLI (`@rail20/cli`) or the raw HTTP API at `https://rail20-api.fly.dev`. Do not implement custom proof generation.
- Never log or transmit the agent's private key. Only the derived signature is sent to the relayer.
- Never print full note secrets, nullifier preimages, or the raw sign-in signature in the final answer.
- Use `rail20 balance --pool <pool> --wait` after any tx that changes balance. Indexer lag is ~5-15 seconds.
- Every `send` must exceed 2x the fee. USDC/USDG floor ~2.01 units; ETH floor ~0.000502 ETH.
- Respect the policy's daily cap and per-tx cap. Never batch around a cap that the user set.
- New recipient (not in the allowlist or not seen in the last 30 days) beyond the policy threshold requires explicit user confirmation before sending.

## Stop Conditions

Stop and ask the user before proceeding if any of these occur:

- Requested amount exceeds the authorized per-tx or per-rolling-24h cap.
- Recipient is not on the allowlist and the amount is above the new-recipient threshold.
- Private balance after `--wait` is less than the requested send plus fee.
- Gas floor on the public wallet is below the policy minimum (deposit or recover flows may fail).
- CLI reports a version older than the one referenced in the policy (`rail20 latest`).
- Robinhood commands fail with "could not detect network" or show `?` for balance while Base works fine (public RH RPC unreachable from the current network; user must set `RAIL20_ROBINHOOD_RPC`).

## Command Pattern

```bash
# install and version check
npm install -g @rail20/cli@latest
rail20 --version
rail20 latest

# auth (either interactive or env var for agents/CI)
rail20 login                              # prompts for private key, stored chmod 600
export RAIL20_KEY=0x...                    # or set env var and skip the prompt

# balance
rail20 balance                            # Base by default, both pools
rail20 balance --chain rh                 # Robinhood
rail20 balance --chain all                # every chain, one run
rail20 balance --pool usdc --wait         # poll indexer until non-stale

# shield public -> private (agent wallet pays gas on this step only)
rail20 deposit 50 --pool usdc             # 50 USDC on Base
rail20 deposit 20 --pool usdg --chain rh  # 20 USDG on Robinhood

# private send (relayer pays gas)
rail20 send 0xRECIPIENT 25                                    # Base USDC
rail20 send 0xRECIPIENT 25 --pool usdg --chain rh             # Robinhood USDG
```

For programmatic control without the CLI, POST to `https://rail20-api.fly.dev`:

```
POST /api/balance      { signature, address, pool }
POST /api/deposit/prepare  { signature, address, amount, pool }   -> returns unsigned tx
POST /api/withdraw     { signature, recipient, amount, pool }
```

Treat the signature returned by `personal_sign` on the fixed RAIL20 message as a session credential. Cache it in memory for the session; do not persist to disk unless you also protect the key file at `chmod 600`.

## Workflow

1. Read the user's policy: max per tx, max per rolling 24h, allowed recipients, gas floor, working reserve, chain (Base or Robinhood).
2. Verify CLI is current: `rail20 --version` and `rail20 latest`. Update if out of date.
3. Authenticate: prefer `RAIL20_KEY` env var for agents; use `rail20 login` for interactive setup. Never accept a pasted key over chat.
4. Check both pools' balance: `rail20 balance --chain all --wait`.
5. If private balance is below the working reserve, shield from public wallet: `rail20 deposit <amt> --pool <pool>`. Wait for confirmation.
6. Validate the requested send against policy: per-tx cap, daily cap, recipient allowlist, minimum viable amount (> 2x fee).
7. If any policy check fails, stop and ask the user.
8. Send: `rail20 send <recipient> <amt> [--pool ...] [--chain ...]`.
9. Poll balance with `--wait` and confirm the delta matches (amount + fee).
10. Log the tx to the agent's local audit file: tx hash, recipient, amount, pool, chain, timestamp.

## Policy Template

Drop this into the agent's system prompt (edit the bracketed values):

```
# RAIL20 PRIVATE PAYMENTS POLICY
- Chain: [Base | Robinhood]
- Max per tx: [25] USDC (or USDG)
- Max per rolling 24h: [100]
- Allowed recipients: [invoice-driven only | 0xA1.., 0xB2.., ...]
- New recipient > [10] requires explicit user OK
- Working reserve (private): >= [5] units
- Public gas floor: >= [0.01] ETH
- Heartbeat interval: [30] min
- Audit log path: [~/.agent/rail20-audit.jsonl]

# RULES
- Always use `rail20 balance --wait` after any tx that changes balance
- On any error, stop and report; do not retry blindly
- Never send below 2x the fee (~2.01 USDC or USDG floor)
- Report all txs to the audit log
```

## Evidence Review Workflow

Use evidence review mode when the user provides redacted proof from a private payment run.

1. Confirm the presence of a `rail20 send` invocation with a matching amount, pool, and recipient hash in the log.
2. Require a private balance snapshot (`rail20 balance --wait`) before and after the send. The delta should equal amount + fee (~0.35% + flat).
3. Verify a matching relayer tx on-chain (Basescan or Robinhood explorer) at the reported block height. The tx should be `transact()` on the RAIL20 verifier, not a plain ERC-20 transfer.
4. Screenshots alone are insufficient. Require the tx hash.
5. Return `pass`, `fail`, or `uncertain` with the exact missing evidence.

## Final Answer

In live execution mode, state:
- Whether the payment succeeded.
- Amount sent, fee paid, and post-tx private balance.
- Recipient (mask the middle bytes: `0xabcd...1234`).
- Chain, pool, and tx hash of the relayer's on-chain broadcast.
- Any policy warning (approaching cap, new recipient, low reserve).

Do not print the sign-in signature, private key, or full note secrets in the final answer.

In policy setup mode, return the filled-in policy block and the drop-in system prompt.

In evidence review mode, return `pass`, `fail`, or `uncertain` with the exact evidence gap.

## References

- Agent integration docs: https://docs.rail20.org/agents
- Operating your agent: https://docs.rail20.org/agents/operating
- Protocol source: https://github.com/rail20dev/protocol
- CLI package: https://www.npmjs.com/package/@rail20/cli
