---
name: rail20-private-swap
description: Perform private same-chain swaps between ETH and the local stablecoin (USDC on Base, USDG on Robinhood) using RAIL20's burner-wallet routing. The relayer withdraws private funds into a fresh random burner, runs a Uniswap V3 trade, and re-shields the output. Observers see one commitment out, an unrelated burner trading, and one commitment in - nothing links them to the agent. Includes automatic burner recovery on any failure.
---

# RAIL20 Private Swap

## Overview

Use this skill when an agent needs to rotate between ETH and the local stablecoin without either side of the trade linking back to the agent's public wallet. RAIL20 handles the full 6-step burner flow atomically from a single CLI command. If any step past the private withdraw fails (RPC glitch, gas spike, indexer stall), the funds sit on a recoverable burner and can always be swept back with `rail20 recover`.

Three modes are supported:

- **Live execution**: run `rail20 swap` with the specified direction, amount, and slippage.
- **Recovery**: sweep stranded burners after a prior failed run, from any device with the sign-in key.
- **Evidence review**: verify a claimed swap fully landed (withdraw, trade, re-shield) from tx traces and balance snapshots.

## Mode Selection

1. Use **live execution mode** when the CLI is installed, the agent is authenticated, and the swap direction, amount, and slippage are within the operating policy.
2. Use **recovery mode** any time after a failed swap, or as a scheduled sanity sweep. Recovery is idempotent and safe to run on any schedule.
3. Use **evidence review mode** when the user provides tx hashes and balance snapshots and asks whether a swap actually completed end-to-end.

## Required Rules

- Only swap direction supported today: ETH <-> the chain's stablecoin (`usdc` on Base, `usdg` on Robinhood). Do not attempt cross-token pairs on-chain; use the bridge skill instead.
- Default slippage is 100 bps (1%). Do not exceed the policy-defined slippage cap.
- After every swap failure, run `rail20 recover --chain <that chain>` before any retry. Never leave funds on a burner.
- Do not attempt swaps below the fee guard. Minimums: ~2.01 stablecoin or ~0.000502 ETH.
- If Robinhood commands fail with "could not detect network", set `RAIL20_ROBINHOOD_RPC` before retrying. Do not hammer the same failing endpoint.
- Never log the burner's private key. The CLI encrypts it with AES-256-GCM under the sign-in signature and registers the ciphertext before funding; that is the only key material that should ever leave the process.

## Stop Conditions

Stop and ask the user before proceeding if any of these occur:

- Requested slippage exceeds the policy cap.
- Requested amount is below the fee guard (2x the flat fee).
- Requested amount is greater than the private balance in the source pool.
- A prior swap in the current session ended in error and `rail20 recover` has not been run.
- The CLI is out of date (`rail20 latest` reports a newer version) and the policy pins gas fixes to a specific version.

## Command Pattern

```bash
# check readiness
rail20 balance --chain base --wait
rail20 latest

# same-chain private swaps (Base)
rail20 swap 3 --from usdc                 # 3 USDC private -> ETH private
rail20 swap 0.001 --from eth              # 0.001 ETH private -> USDC private
rail20 swap 3 --from usdc --slippage 50   # tighter slippage (0.5%)

# Robinhood variants
rail20 swap 3 --from usdg --chain rh
rail20 swap 0.001 --from eth --chain rh

# recovery (idempotent - safe on any schedule)
rail20 recover                            # sweep Base burners
rail20 recover --chain rh                 # sweep Robinhood burners
rail20 recover --chain all                # sweep both chains in one run
rail20 recover --to 0xOTHERADDR           # sweep to a different destination
```

Programmatic control (skip only if you understand all 6 sub-steps):

```
POST /api/burner/auth-message         -> message to sign for registry auth
POST /api/burner/register             { authSig, burnerAddress, chain, token, encKey }
POST /api/swap-private                { signature, fromAsset, amount, burnerAddress }
POST /api/burner-gas                  { signature, burnerAddress, chain, txCount }
POST /api/burner/list                 { authSig }
POST /api/burner/mark-swept           { authSig, burnerAddress, chain }
```

## The 6-Step Burner Flow (why this matters)

Every private swap routes through a fresh random burner wallet so observers cannot link the pool exit and pool re-entry to the same agent. The CLI orchestrates all steps; failures at each step have specific recovery paths.

1. **Create burner** (random Wallet in memory) and encrypt its key with AES-256-GCM under `keccak256(signInSig)`.
2. **Register ciphertext** to the recovery registry BEFORE funding, so any device that re-signs can decrypt and sweep it later. If this write fails, the CLI aborts before funding (funds cannot be stranded on an unregistered burner).
3. **Private withdraw** from the pool to the burner (relayer-built proof).
4. **Gas top-up** for stablecoin-origin swaps: the relayer sends ETH to the burner sized for the exact tx count needed (approve + swap, or approve + deposit).
5. **Uniswap V3 trade** from the burner: approve + swapExactTokensForTokens (or WETH unwrap for ETH destination).
6. **Re-shield**: burner deposits output back into the RAIL20 pool. The re-shield tx verifies a Groth16 proof on-chain and uses ~1.35M gas; the CLI adds a 20% buffer to `estimateGas`.

If any step 3-6 fails, funds sit on the burner. `rail20 recover` re-signs, pulls the registry, decrypts each burner key locally, and sweeps all USDC/USDG plus any non-dust ETH back to the agent's public wallet.

## Workflow (Live Execution Mode)

1. Read the swap request: direction (from asset), amount, chain, slippage.
2. Verify against policy: max swap size, allowed slippage, allowed chains.
3. Confirm private balance in the source pool: `rail20 balance --pool <src> --chain <chain> --wait`.
4. Verify the source balance is at least the requested amount plus fee.
5. Run the swap: `rail20 swap <amt> --from <src> [--chain ...] [--slippage <bps>]`.
6. Poll the resulting private balance with `--wait` on the destination pool.
7. If the swap errors at any step, immediately run `rail20 recover --chain <that chain>` and report the sweep tx hash.
8. If `rail20 recover` also reports errors, stop and escalate to the user with the burner address and last successful step.
9. Log the swap: source amount, destination amount, effective rate, slippage used, tx hash of the re-shield.

## Workflow (Recovery Mode)

1. Run `rail20 recover --chain all` (idempotent; safe to schedule).
2. Parse output for swept burners and their recovered balances (USDC/USDG + ETH).
3. If any burner is reported as "registered but no funds", it was cleaned by a prior sweep. Ignore.
4. If any burner is reported as "registry entry not found", check whether it was a legacy burner (derived at nonce 0-19 in older CLI versions); those are still swept. If none, funds may be truly lost - escalate.
5. Log the recovery outcome to the agent's audit file.

## Workflow (Evidence Review Mode)

1. Locate the swap invocation and its logged tx hashes: the private withdraw, the Uniswap trade, and the re-shield.
2. Confirm the private withdraw appears as `transact()` on the RAIL20 verifier at the expected block.
3. Confirm the Uniswap trade appears on a burner wallet address (never the agent's public wallet).
4. Confirm the re-shield appears as another `transact()` moving the traded output back into the pool.
5. Confirm the destination-pool private balance grew by the expected amount (within slippage).
6. If any step is missing, run `rail20 recover` (still safe) and report which step failed.
7. Return `pass`, `fail`, or `uncertain` with the specific missing tx.

## Final Answer

In live execution mode, state:
- Whether the swap succeeded end-to-end.
- Source amount and destination amount.
- Effective rate and slippage applied.
- Tx hashes: private withdraw, Uniswap trade (on burner), re-shield.
- Whether `rail20 recover` was needed post-run and its outcome if so.

In recovery mode, list swept burners and total recovered per asset.

In evidence review mode, return `pass`, `fail`, or `uncertain` with the exact missing tx or balance mismatch.

## References

- Agent integration docs: https://docs.rail20.org/agents
- Operating your agent (failure modes): https://docs.rail20.org/agents/operating
- Protocol source: https://github.com/rail20dev/protocol
- CLI package: https://www.npmjs.com/package/@rail20/cli
