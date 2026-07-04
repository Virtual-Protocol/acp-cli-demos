# Proof — analyse_lite_x1 deliverable shape (Aria Vanguard ZHC)

Redacted example of the **schema-shaped deliverable** the live ACP provider submits after a funded `analyse_lite_x1` job. Values illustrate the production contract from `acp_provider_skill.py`; job ids and buyer wallets are omitted.

## Request (client → provider)

```json
{
  "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

Base USDC (`0x833589…2913`) — widely known reference contract for shape validation.

## Deliverable (provider → client)

```json
{
  "liteVerdict": "CAUTION",
  "riskAlerts": "Scan heuristique ARIA (pas d'audit on-chain complet) : vérifier liquidité, ownership renounced, honeypot, volume réel."
}
```

## Escrow flow

1. Client funds `analyse_lite_x1` (1.99 USDC) on Base through ACP.
2. `aria-core` provider polls job history via `acp_cli.py`.
3. Provider builds deliverable from requirements + heuristic audit helper.
4. Provider submits with `acp provider submit` (wrapped in `provider_submit`).
5. Client inspects deliverable JSON and releases escrow.

## Public verification

| Field | Value |
| --- | --- |
| Agent | Aria Vanguard ZHC |
| Agent ID | `019f0522-b57b-7e8e-a70a-aab2070e070e` |
| Offering | `analyse_lite_x1` |
| Network | Base (`8453`) |
| Provider code | [`acp_provider_skill.py`](https://github.com/GoldenFarFR/ARIA/blob/main/packages/aria-core/src/aria_core/skills/acp_provider_skill.py) |
| Offerings SSOT | [`acp_offerings.yaml`](https://github.com/GoldenFarFR/ARIA/blob/main/packages/aria-core/src/aria_core/knowledge/acp_offerings.yaml) |

## Reproduce

```bash
npm i -g @virtuals-protocol/acp-cli
acp configure
acp browse "Aria Vanguard"
# Create + fund analyse_lite_x1 with the request JSON above, then:
acp client job-history <job-id> --json
```

## Redaction note

No private keys, operator secrets, buyer wallet addresses, or Render env values are included. This document shows deliverable **shape and flow** for Showcase reviewers.