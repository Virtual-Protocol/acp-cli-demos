# Buyer Workflow Packet - Safe Swap Preflight

**Format:** no-mutation buyer workflow packet  
**Workflow:** `safe_swap_preflight`  
**Public lite route:** `POST /token-safety/lite`  
**Captured:** 2026-07-15T00:11:08Z  
**Boundary:** no payment sent; no wallet action; no settlement attempted; no
revenue claimed

## Buyer Problem

Autonomous finance and execution agents can discover a Base token route before
they know whether the token, pair, or execution path is safe enough to spend
against. `safe_swap_preflight` gives the buyer agent a compact decision before
funds move.

## Expected Request Shape

```json
{
  "workflow": "safe_swap_preflight",
  "chain": "base",
  "token_in": "USDC",
  "token_out": "<token symbol or address>",
  "amount_usdc": 25,
  "route": {
    "dex": "<dex or aggregator>",
    "pool_or_pair": "<pool, pair, or route identifier>",
    "slippage_bps": 100
  },
  "buyer_context": {
    "agent_type": "finance_execution_agent",
    "intent": "pre_spend_swap_risk_check",
    "will_execute_if_go": true
  }
}
```

Minimum useful fields:

- `workflow`: `safe_swap_preflight`
- `chain`: `base`
- `token_out`: token symbol or address being considered
- `amount_usdc`: planned spend size
- `route.dex` or `route.pool_or_pair`: intended execution path
- `buyer_context.intent`: `pre_spend_swap_risk_check`

Requests must not include private keys, seed phrases, wallet signing material,
auth tokens, custody instructions, or instructions for Fia Signals to move
assets.

## Sample Decisions

### GO

```json
{
  "decision": "GO",
  "workflow": "safe_swap_preflight",
  "chain": "base",
  "summary": "No blocking token or route risk found for the proposed swap.",
  "risk_flags": [],
  "execution_note": "Proceed within the buyer agent's own slippage, spend-limit, and signing controls.",
  "evidence_needed_to_change": [
    "fresh honeypot flag",
    "liquidity removal",
    "route mismatch",
    "new contract-risk signal"
  ]
}
```

### CAUTION

```json
{
  "decision": "CAUTION",
  "workflow": "safe_swap_preflight",
  "chain": "base",
  "summary": "The route is not blocked, but the token or liquidity context has unresolved risk.",
  "risk_flags": [
    "thin_liquidity",
    "new_or_unverified_pair",
    "high_slippage_requested"
  ],
  "execution_note": "Reduce size, lower slippage, or require an additional independent token check before spending.",
  "evidence_needed_to_change": [
    "verified deeper liquidity",
    "known-good route history",
    "lower slippage",
    "independent contract verification"
  ]
}
```

### BLOCK

```json
{
  "decision": "BLOCK",
  "workflow": "safe_swap_preflight",
  "chain": "base",
  "summary": "The proposed swap should not execute because a blocking token or route risk was found.",
  "risk_flags": [
    "honeypot_or_sell_restriction",
    "malicious_contract_signal",
    "route_mismatch",
    "unacceptable_settlement_risk"
  ],
  "execution_note": "Do not spend, sign, or route funds through this path.",
  "evidence_needed_to_change": [
    "blocking flag disproven by fresh independent source",
    "safe replacement route",
    "contract-risk remediation",
    "manual operator override with documented rationale"
  ]
}
```

## Public Proof Status

No-spend readback on 2026-07-15T00:11:08Z:

- `/token-safety/lite` returned HTTP `402`, confirming the unpaid x402 boundary.
- `virtuals-direct-buy.json?offering=safe_swap_preflight` returned HTTP `200`.
- The direct-buy manifest included `safe_swap_preflight` at `0.01` USDC context
  with `required_funds: false`.

This is distribution and readiness evidence only. It is not a paid call, not a
settlement, not an external buyer purchase, and not revenue.

## Failure Modes

- Unpaid route returns expected `402`: paywall is reachable; no paid evidence
  exists.
- Paid route returns non-`200`: buyer payment or fulfillment path needs
  diagnosis using non-secret status and job/payment references.
- Paid `200` returns no delivery row/hash: fulfillment evidence is incomplete.
- ACP/direct-buy pricing disagrees with public copy: buyer trust risk; fix copy
  only with before/after readback.
- Discovery search does not surface Fia Signals: distribution/indexing problem,
  not route-health proof.
- Request asks Fia Signals to sign, trade, custody funds, or move assets: out of
  scope.
- Self-buy or team-paid probe succeeds: diagnostic only; do not classify as
  revenue.

## Revenue Boundary

External revenue remains `USD 0.00` for this package. Revenue requires an
external non-team buyer, paid `200`, completed or settled job, non-secret tx/job
reference, buyer identity or wallet, and delivery row/hash.
