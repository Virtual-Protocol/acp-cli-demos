# Mock workflow proof

This proof is generated without Virtuals credentials, wallet access, social credentials,
or a live Celebration Hub write. It demonstrates the exact event-to-deliverable contract
used before a hidden owner-controlled production activation.

## Command

```text
npm run mock
```

## Expected redacted output

```json
{
  "submitted": true,
  "giftUrl": "https://celebration-hub.xyz/share-greeting/mock-demo",
  "submission": {
    "ok": true,
    "jobId": "showcase-demo-1",
    "chainId": "8453",
    "deliverable": "https://celebration-hub.xyz/share-greeting/mock-demo"
  }
}
```

## What this proves

- Provider events are normalized from ACP NDJSON.
- Requirement JSON must pass the bounded classic/Base NFT gift contract.
- The Hermes job id is deterministic and polled to a terminal state.
- One deliverable URL is submitted and duplicate events are suppressed.

## What it does not prove

It does not claim a completed ACP escrow or live gift delivery. The separate redacted
production-pilot proof records that lifecycle; this mock remains the reproducible,
credential-free bridge demonstration.
