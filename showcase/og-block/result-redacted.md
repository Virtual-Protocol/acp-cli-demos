# Result Report (redacted)

Live end-to-end run of the `og-block-agent-link` flow against production
(`https://joinog.xyz`), executed 2026-08-25. Secrets redacted per Showcase
contribution rules: codes are single-use and now expired; signatures are
truncated; no private material is included.

## Environment

| Item | Value |
| --- | --- |
| Chain | Base mainnet (8453) |
| Agent | airplane (ACP agent, HYBRID role) |
| Agent ID | `019f0a02-50d4-7169-b047-a5771369e32a` |
| Agent wallet (ACP) | `0x3282f5ae930f8be53695de152cf890b9385e8263` |
| AgentIdentity NFT | #58870 on `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` |
| Operator profile | `@airplanestar_` |
| Endpoint under test | `POST https://joinog.xyz/api/agent/link` |

## Run log

### 1. One-time code issued

```
code=OGB-****-****  expiresAt=2026-08-25T15:52:51.593Z
```

Instruction block generated server-side by `POST /api/agent/link-code`
(authenticated operator session required — unauthenticated calls correctly
return `401 Unauthorized`, verified).

### 2. Agent selects its ACP wallet and signs

```bash
acp agent use --agent-id <AGENT_ID>
acp wallet address
# → 0x3282f5ae930f8be53695de152cf890b9385e8263
acp wallet sign-message --chain-id 8453 --message "<CHALLENGE_TEXT>"
# → signature=0x7261c6874eda1cf5c2…e1d69d1c   (truncated, redacted)
```

### 3. POST /api/agent/link → HTTP 200

```json
{
  "ok": true,
  "handle": "airplanestar_",
  "agentWallet": "0x3282f5ae930f8be53695de152cf890b9385e8263",
  "score": 100
}
```

### 4. Database state after linking

```json
{
  "slots": [
    {
      "address": "0x3282f5ae930f8be53695de152cf890b9385e8263",
      "wallet_slot": "agent",
      "verified_at": "2026-08-25T15:25:30.806+00:00"
    }
  ],
  "score": { "score": 100, "nft_count": 1, "rank": 16 }
}
```

Public read-back matches:
`https://joinog.xyz/api/profile/airplanestar_` → score 100, nftCount 1,
agentWallet linked.

## Negative cases observed in the field

| Case | Server response | Note |
| --- | --- | --- |
| Unauthenticated code generation | `401 {"error":"Unauthorized"}` | Guard works as designed |
| Signature recovers to a different address than submitted (smart-account operator key) | `400 {"error":"Signature could not be verified"}` | Documented fix: submit the signer EOA address instead |
| Failed attempts do NOT consume the code | — | Retry within expiry succeeds after fixing the payload |

## Post-run rescore

Combined score recalculated automatically across human + agent slots after a
successful link (verified-contract NFTs only). Registration retry-hardened:
transient provider errors during rescoring are retried before surfacing.
