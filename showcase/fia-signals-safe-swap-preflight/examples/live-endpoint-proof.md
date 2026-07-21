# Live Endpoint Proof - Fia Signals Safe Swap Preflight

**Captured:** 2026-07-21T06:21:17+1000 AEST local validation pass
**Mode:** no spend, no wallet signing, no settlement attempt
**Revenue classification:** readiness proof only, not revenue

## Endpoints

| Surface | Purpose | Expected unpaid result |
| --- | --- | --- |
| `/token-safety/lite` | lite pre-swap token safety boundary | HTTP `402` |
| `/token-safety/batch` | batch token safety for up to 5 Base/EVM contracts | HTTP `402` |
| `/contract-risk/batch` | batch contract risk for up to 5 Base/EVM contracts | HTTP `402` |
| `/smart-contract-risk/batch` | alias for contract-risk batch | HTTP `402` |
| `/virtuals-direct-buy.json?offering=safe_swap_preflight` | public direct-buy manifest | HTTP `200` |

## No-Spend Readback Commands

```bash
curl -i "https://x402.fiasignals.com/token-safety/lite?chain=base&token_address=0x4200000000000000000000000000000000000006"

TOKEN_CSV="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,0x4200000000000000000000000000000000000006"
curl -i "https://x402.fiasignals.com/token-safety/batch?chain=base&token_addresses=${TOKEN_CSV}"
curl -i "https://x402.fiasignals.com/contract-risk/batch?chain=base&token_addresses=${TOKEN_CSV}"
curl -i "https://x402.fiasignals.com/smart-contract-risk/batch?chain=base&token_addresses=${TOKEN_CSV}"

curl -i "https://x402.fiasignals.com/virtuals-direct-buy.json?offering=safe_swap_preflight"
```

## Local Readback Result

| Surface | HTTP status | Content type |
| --- | --- | --- |
| `/token-safety/lite` | `402` | `application/json` |
| `/token-safety/batch` | `402` | `application/json` |
| `/contract-risk/batch` | `402` | `application/json` |
| `/smart-contract-risk/batch` | `402` | `application/json` |
| `/virtuals-direct-buy.json?offering=safe_swap_preflight` | `200` | `application/json` |

## Payment Boundary

The batch endpoints are expected to answer unpaid callers with `402` and an x402
challenge. A buyer agent should read the challenge, build the full x402 payment
payload for `accepts[0]`, then retry the same URL with `X-PAYMENT` or
`PAYMENT-SIGNATURE`.

Do not send a bare wallet signature. Do not include private keys, seed phrases,
auth tokens, custody instructions, or signing material in the request.

## What Counts

This proof shows that the public endpoint boundary and direct-buy manifest are
reachable. It does not show a paid buyer, settled payment, completed job, or
delivery row.

Revenue requires all of:

- external non-team buyer
- paid `200`
- settlement or completed job
- non-secret transaction or job reference
- buyer identity or wallet
- delivery row or delivery hash
