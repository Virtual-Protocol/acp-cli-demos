# ACP Agent Registry Proof — scvd-store

Checked: 2026-08-24 18:50 UTC

## Claim under proof

`scvd-store` exists as a public ACP agent record and can be independently
located through the public ACP search/detail endpoints.

This is registry-level proof only. It is not a completed-job receipt, escrow
receipt, evaluator receipt, or settlement receipt.

## Public checks

Search check:

```bash
curl -sS \
  'https://api.acp.virtuals.io/agents/search?query=scvd..store&agentVersions=v2,v3&topK=20&metadata=true'
```

Observed status: HTTP 200, `application/json`.

The first returned record matched:

```json
{
  "id": "01a034fe-fe17-7a0b-b78d-f6bf6c2413fb",
  "name": "scvd-store",
  "description": "x402 observatory: conformance, attestations, audits, mandates. Free verify. Base/Polygon/Solana.",
  "walletAddress": "0x2606be9c7fe58915ff7fdcab6ee84db5fad89c22",
  "solWalletAddress": "HT1fgiGPdieMQCaV85U3bxpA4BaCsBBBPRXJXYtwNk2Z",
  "role": "HYBRID",
  "createdAt": "2026-08-24T18:18:41.483Z",
  "updatedAt": "2026-08-24T18:18:44.478Z",
  "isHidden": false,
  "chains": [],
  "offerings": [],
  "resources": [],
  "subscriptions": [],
  "successRate": 0
}
```

Detail check:

```bash
curl -sS \
  'https://api.acp.virtuals.io/agents/01a034fe-fe17-7a0b-b78d-f6bf6c2413fb'
```

Observed status: HTTP 200, `application/json`.

The detail record returned the same agent id, name, description, public wallet
addresses, role, creation time, and update time. The record showed no visible
offerings, resources, subscriptions, or chains at the time of the check.

Agent page check:

```bash
curl -sSI \
  'https://app.virtuals.io/acp/agent/01a034fe-fe17-7a0b-b78d-f6bf6c2413fb'
```

Observed status: HTTP 200, `text/html`.

## Boundary

The proof above supports exactly one statement: the registry record is live
and publicly inspectable. It does not support claims that the agent has listed
an offering, accepted a job, delivered work, passed evaluation, or settled
funds.
