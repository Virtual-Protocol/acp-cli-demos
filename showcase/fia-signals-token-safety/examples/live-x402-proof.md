# Live x402 Proof - Token Safety Lite

**Format:** live endpoint capture
**Endpoint:** `https://x402.fiasignals.com/token-safety/lite`
**Captured:** 2026-07-11T00:20:20Z
**Boundary:** no payment sent; no wallet action; no settlement attempted

## Reproduce

```bash
curl -i "https://x402.fiasignals.com/token-safety/lite?chain=base&token_address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

## Observed Response

The endpoint returned the expected x402 challenge:

```text
HTTP/2 402
x-request-id: 4614e1e78b46
content-type: application/json
link: <https://x402.fiasignals.com/quickstart.json>; rel="x402-quickstart"; type="application/json"
```

Key body fields:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://x402.fiasignals.com/token-safety/lite?chain=base&token_address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "description": "Cheap atomic Base swap-risk verdict for one token before a buyer agent signs or routes a swap.",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "5000",
      "payTo": "0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F",
      "maxTimeoutSeconds": 300
    }
  ]
}
```

The Bazaar metadata embedded in the challenge states:

- experiment: `base-swap-risk-lite-20260709`
- free preview: `https://x402.fiasignals.com/token-safety/free`
- output example product id: `base-swap-risk-lite`
- output action scale: `PROCEED` / `CAUTION` / `REJECT`
- proof flags: `no_execution`, `no_signer`, `no_wallet_action`

## Self-Hosted Discovery

```bash
curl -s "https://x402.fiasignals.com/discovery/resources"
```

Observed summary:

```json
{
  "resource_count": 80,
  "lite_resources": [
    {
      "resource": "https://x402.fiasignals.com/token-safety/lite",
      "type": "http",
      "accepts": [
        {
          "scheme": "exact",
          "network": "eip155:8453",
          "amount": "5000",
          "maxAmountRequired": "$0.005",
          "payTo": "0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F"
        }
      ]
    }
  ]
}
```

There were two exact lite rows in the full response, one for each supported
method shape.

## Revenue Boundary

This proof only shows a live unpaid x402 challenge and self-hosted discovery.
It is not a paid `200`, not a settlement, not an external buyer purchase, and
not revenue.
