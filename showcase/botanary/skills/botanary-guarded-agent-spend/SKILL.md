---
name: botanary-guarded-agent-spend
description: Let an agent spend from a Botanary self-custodial smart wallet under an on-chain mandate. Request a bounded delegation, then send, swap, or hire another agent within budget, per-action max, recipient allowlist, allowed venues, and expiry, using build, sign client-side, relay. Includes approval gates, a one-op kill-switch, and a tamper-evident audit trail.
---

# Botanary Guarded Agent Spend

## Overview

Use Botanary as the execution layer when an agent must move real money under
limits it cannot exceed. The backend never holds keys and never signs: the API
returns an **unsigned** UserOp, the owner or a bounded session key signs it
client-side, and `POST /userops` relays it. AgentGuard enforces the limits
on-chain.

## When to use

- An agent needs to send, swap, or hire another agent (ACP) with hard spend caps.
- A human wants to delegate bounded, revocable authority to an agent.
- You need an auditable, freezable execution path, not advisory advice.

## When NOT to use

- You need a custodial wallet that signs for you. Botanary never signs.
- You need on-chain guardrail enforcement on **mainnet today** - delegation and
  AgentGuard are testnet-validated; mainnet is basic tier (owner-signed, no
  guardrail hook). Use owner-signed send/swap on mainnet, or testnet for the
  full mandate flow.
- You need advisory-only risk scoring (use a verifier skill instead).

## Inputs, tools, credentials, preconditions

- Base URL: your Botanary backend, self-run from
  `https://github.com/Botanary/botanary-be` (the hosted API is in private waitlist).
- Auth: an owner session (Privy email-OTP login) for owner-lane actions; a
  granted mandate (session key) for delegated actions.
- Chain id: a supported chain (e.g. Base 8453 for send/swap on mainnet; Base
  Sepolia 84532 for the full mandate/guardrail flow).
- A signer available client-side (the owner wallet or the mandate session key).
  **Never send a private key to the backend.**

## Approval gates (must confirm before relay)

Before signing/relaying ANY fund-moving op, explicitly confirm:
1. chain id, 2. action (send | swap | hire), 3. recipient/venue, 4. amount and
token, 5. that amount + venue + recipient are inside the active mandate bounds.
Any changed fact requires a fresh confirmation and a fresh build.

## Flow

1. `GET /chains` and `GET /gas/methods` - confirm the chain and available gas.
2. (Delegated lane) `POST /delegations/build` with the mandate bounds, owner
   signs, `POST /delegations` to activate. (Owner lane) skip to step 3.
3. Build: `POST /money/send/build` | `POST /money/swap/build` |
   `POST /marketplace/hire/build`. The response is an **unsigned** UserOp.
4. Optional preview: `POST /simulation` to see the effect before signing.
5. Sign the UserOp client-side (owner wallet or mandate session key).
6. Relay: `POST /userops`, then poll `GET /userops/:id` for inclusion.
7. Verify: `GET /activity` shows the audited event; `GET /balance` reflects it.

## Stop conditions

- A build returns a decline reason (out of budget, non-allowlisted recipient,
  disallowed venue, over per-action max, expired mandate): STOP, report the
  reason, do not retry with the same facts.
- `GET /userops/:id` shows failure or is uncertain: STOP, check `GET /activity`
  before any retry.
- Any bound is ambiguous: STOP and ask the owner. Never widen a bound to proceed.

## Kill-switch

`POST /account/freeze` (or `POST /delegations/:id/freeze`) halts spending in one
op and is gasless via the revoke-only paymaster. Freeze/revoke are always
allowed, even when already frozen.

## Validation and output contract

Return exactly:
- `status`: `relayed` | `declined` | `stopped`
- `chainId`, `action`, `recipientOrVenue`, `amount`, `token`
- `userOpHash` and `txHash` when `relayed`; `declineReason` when `declined`;
  `stopReason` when `stopped`
- `activityEventId` for the audited record
Print allowlisted fields only. Never print keys, signatures, or raw UserOp
calldata.
