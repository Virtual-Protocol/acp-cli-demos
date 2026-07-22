# Mandate bounds and decline reasons

A Botanary mandate (Rhinestone Smart Sessions session key) is bounded by:

| Bound | Meaning |
| --- | --- |
| budget | total spend allowed for the mandate's life |
| per-action max | cap on any single action |
| recipient allowlist | `to` must be in the set |
| allowed venues / selectors | swap/hire routers and function selectors permitted |
| expiry | timestamp after which the mandate is dead |

AgentGuard (the account-global on-chain hook) additionally enforces: freeze
(kill-switch), contract allow/deny, permitted-stablecoin set, per-action max,
and a rolling-window per-token cap. Every on-chain revert selector maps 1:1 to a
backend decline reason, so a stop is always explainable. Risk-reducing actions
(freeze, revoke, safe-harbor withdrawal) are cleared before the freeze gate so a
kill-switch can never block itself.
