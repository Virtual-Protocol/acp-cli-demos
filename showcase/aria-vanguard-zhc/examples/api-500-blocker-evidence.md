# Infrastructure blocker — Privy/Alchemy path HTTP 500

> **Reopened tracker** for [Virtual-Protocol/acp-cli-demos#37](https://github.com/Virtual-Protocol/acp-cli-demos/pull/37).  
> Showcase package validates; **provider automation is blocked server-side**.

## Agent (live)

| Field | Value |
| --- | --- |
| Name | Aria Vanguard ZHC |
| Agent ID | `019f0522-b57b-7e8e-a70a-aab2070e070e` |
| Wallet (Base) | `0xd752a325433f4d55c5e0b125be84845d7de47bb3` |
| Hire | https://app.virtuals.io/acp/agents/019f0522-b57b-7e8e-a70a-aab2070e070e |

## Environment (repro 2026-07-04 UTC)

| Field | Value |
| --- | --- |
| OS | Windows 11 |
| Node | v24.16.0 |
| `@virtuals-protocol/acp-cli` | 1.0.24 |
| viem (error payload) | 2.54.3 |
| Chain | Base `8453` |

## What works vs what fails

| Command | Result |
| --- | --- |
| `acp offering list --json` | **OK** — 3 live offerings returned |
| `node scripts/validate-showcase.mjs` | **OK** — 12 manifests |
| `acp browse "security" --json` | **500** — `Server error 500` / viem 2.54.3 |
| `acp job list --json` | **500** — same |
| `acp events listen --legacy` | Socket connects, then **500** on `privyAlchemyEvmProviderAdapter.signTypedData` |

## Raw output (copy-paste reproducible)

### browse

```json
{"error":"Server error 500\n\nVersion: viem@2.54.3"}
```

### job list

```json
{"error":"Server error 500\n\nVersion: viem@2.54.3"}
```

### events listen (stack trace excerpt)

```
Listening for events... connected.
Agent: 0xd752...7bb3
Protocol: legacy only
...
BaseError: Server error 500
Version: viem@2.54.3
    at serverPost (.../privyAlchemyEvmProviderAdapter.js:54:15)
    at async signedServerCall (.../privyAlchemyEvmProviderAdapter.js:77:16)
    at async Object.signTypedData (.../privyAlchemyEvmProviderAdapter.js:129:28)
    at async LegacyContractBridge.signTypedData (.../acp.js:1137:12)
    at async AcpClient.refreshToken (.../acp-node/dist/index.js:5204:23)
```

## Impact on this showcase

- Provider cannot poll funded jobs, sign typed data, or **submit deliverables** via CLI.
- We cannot attach a **funded escrow job receipt** (gate S2) until provider submit works.
- Offerings are live on marketplace; failure is on **Virtuals signer/auth path**, not showcase schema.

## Request to Virtuals team

1. Confirm whether Privy/Alchemy 500 is a **known incident** for agent `019f0522-b57b-7e8e-a70a-aab2070e070e`.
2. **ETA or workaround** for `privyAlchemyEvmProviderAdapter` / provider submit.
3. Preferred tracker: fix here and we append escrow receipt + re-request merge, or separate infra issue linked from this PR.

We will update this file and the PR thread when smoke tests pass.