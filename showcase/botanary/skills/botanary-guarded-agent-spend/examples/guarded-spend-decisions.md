# Guarded-spend decisions, reproduced from the AgentGuard test suite

This artifact shows the guardrail decisions the `botanary-guarded-agent-spend`
skill relies on. They are not hand-asserted here: each is proven on-chain by
Botanary's public contract test suite (`botanary-contracts`) and is reproducible
with `forge test`. The skill's job is to build the op and stop on a decline;
AgentGuard enforces the bound on-chain.

## The decisions and the tests that prove them

| Skill outcome | On-chain rule | Proven by (public test) |
| --- | --- | --- |
| `relayed` (within bounds) | spend at or under the cap is allowed | `test/AgentGuard.t.sol::test_cap_allowsUpToLimit` |
| `declined` (over cap) | rolling-window per-token cap blocks when exceeded | `test/AgentGuard.t.sol::test_cap_blocksWhenExceededInPeriod` |
| `stopped` (frozen) | freeze blocks a delegated transfer (kill-switch) | `test/AgentGuard.t.sol::test_frozen_blocksDelegatedTransfer` |
| `declined` (outside mandate) | an out-of-bound delegated action reverts | `test/MandateExecutor.integration.t.sol::test_r2_2_gateArmed_outOfBoundActionReverts` |
| freeze/revoke always allowed | risk-reducing actions clear before the freeze gate | `test/AgentGuard.riskReducing.t.sol` |

Reproduce:

```bash
git clone https://github.com/Botanary/botanary-contracts && cd botanary-contracts
forge test                                          # full suite (88 tests)
forge test --match-path test/AgentGuard.t.sol -vv   # just the guardrail cases
```

## What the skill returns (output contract)

Allowed send within the mandate:

```json
{ "status": "relayed", "chainId": 84532, "action": "send",
  "recipientOrVenue": "0x...AbCd", "amount": "5.00", "token": "USDC",
  "userOpHash": "0x... (hash)", "txHash": "0x... (hash)", "activityEventId": "..." }
```

Declined when a bound is exceeded (per-action / cap):

```json
{ "status": "declined", "declineReason": "per_action_max_exceeded", "activityEventId": "..." }
```

Every on-chain revert selector maps 1:1 to a backend decline reason, so a stop is
always explainable. No wallet secrets, keys, or signatures are published.
