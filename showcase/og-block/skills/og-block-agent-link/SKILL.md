# OG BLOCK Agent Link — Register Your Wallet & Track Your Culture Score

## When to Use

- An operator hands you a one-time code (`OGB-XXXX-XXXX`) to join their OG BLOCK profile as its **agent wallet**
- You need your on-chain NFT holdings counted into an OG BLOCK combined culture score
- You need to read back a profile's public culture score, rank, or NFT breakdown after linking

## When NOT to Use

- The code was issued more than 15 minutes ago, or it already completed a link (request a fresh one)
- Someone asks you to sign with the *operator's personal wallet* — never do this; only your own agent wallet key
- You cannot control which key signs (e.g. a smart account whose internal operator key you cannot identify) — see Troubleshooting

## Required Inputs

- **ACP CLI** installed and configured (`acp configure`)
- **Active ACP agent** on **Base mainnet (chainId 8453)** with its own wallet:
  ```bash
  acp agent use --agent-id <AGENT_ID>
  acp wallet address   # this exact address is what you will register
  ```
- **One-time code** from the profile owner (`OGB-XXXX-XXXX`, single-use, expires 15 minutes; a new code invalidates any previous unused one)

## Critical Rule

The signature must **recover (plain ECDSA ecrecover) to exactly the address you submit**.
If your setup is a smart account signed by an internal operator key, submit **that signer EOA
address** instead of the account address — in both the challenge line and the payload.

## Step-by-Step Workflow

### Step 1: Confirm Your Wallet

```bash
acp agent use --agent-id <AGENT_ID>
acp wallet address
```

Record this address — it must appear identically in the challenge line and the payload below.

### Step 2: Sign the Exact Challenge

Build the message with the CURRENT UTC time (±5 minutes of server time), replacing placeholders:

```text
OG BLOCK agent link
Code: <CODE>
Agent wallet: <YOUR_ADDRESS>
Timestamp: <ISO_8601_UTC_NOW>
```

Sign it (EIP-191 `personal_sign`, UTF-8, every line kept intact):

```bash
acp wallet sign-message --chain-id 8453 --message "<THE_EXACT_MULTILINE_TEXT>"
```

Capture `signature` from the output.

### Step 3: POST the Registration

```bash
curl -X POST https://joinog.xyz/api/agent/link \
  -H "Content-Type: application/json" \
  -d '{
    "code": "<CODE>",
    "address": "<YOUR_ADDRESS>",
    "chainId": 8453,
    "message": "<THE_EXACT_MULTILINE_TEXT>",
    "signature": "<0x_SIGNATURE>"
  }'
```

Success response:

```json
{ "ok": true, "handle": "<operator_handle>", "agentWallet": "<YOUR_ADDRESS>", "score": 1234 }
```

`score` is the freshly recalculated combined OG Score across the operator's human + agent slots.

### Step 4: Read Back the Public Result (Optional)

```bash
curl https://joinog.xyz/api/profile/<operator_handle>
```

Returns score, rank, NFT counts, and verified/unverified breakdown for the profile.

## Error Handling

| Error | Cause | Fix |
| --- | --- | --- |
| `Signature could not be verified` | Signature recovers to a different address than submitted | Submit the signer EOA address instead (see Critical Rule) |
| `Invalid, used, or expired code` | Code consumed, expired, or superseded | Ask the operator for a fresh code |
| `Signature expired or has an invalid timestamp` | Clock drift beyond ±5 minutes | Regenerate the Timestamp, re-sign |
| `Signed message does not match the required challenge` | Lines differ from the template | Keep each line exact; address string must be identical in message and payload |
| `This wallet is already registered as an agent for another profile` | One wallet = one profile | Use another agent wallet |

A **failed attempt does not consume the code** — fix the cause and retry within the 15-minute expiry.

## Approval Gates

This flow performs a **production mutation** — it attaches a wallet to a profile's agent slot — so gate it:

- The **one-time code from the operator is the consent/authorization**. Do not proceed without a code you received directly from the operator.
- **No spending, no posting, no account creation** happens in this flow. There is nothing to pay, mint, deploy, or publish — do not send funds anywhere.
- Confirm before acting: the submission `address` matches `acp wallet address`, and the operator's `handle` in the success response is the profile the code belongs to.
- If anything about the code's origin is unclear (e.g. it arrived unsolicited), STOP and ask the operator to confirm.

## Stop Conditions & Handoff

Stop immediately and report back (do not retry blindly) when:

- `acp wallet address` outputs anything other than the wallet you intended to register.
- The code returns `Invalid, used, or expired code` — a new code is required; hand off to the operator.
- The signature cannot recover to the submitted address — hand off; re-issuing a message is fine but the code window is 15 minutes.
- The response is `This wallet is already registered as an agent for another profile` — use a different agent wallet.
- You are asked to sign with the operator's personal/main wallet — refuse.

## Validation & Output Contract

Successful completion means ALL of:

1. `POST /api/agent/link` returns HTTP 200 and `{ "ok": true, "handle": "<operator>", "agentWallet": "<your address>", "score": <number> }`.
2. `GET https://joinog.xyz/api/profile/<operator>` reflects the linked agent wallet and a fresh combined score.
3. `https://joinog.xyz/leaderboard` shows the profile at the returned rank.

Report at minimum: the operator handle, your registered address, the returned score/rank, and the public profile URL. Treat a missing/invalid `handle` or a score that does not match the profile read-back as a failure.

## Verification Notes

- Only NFTs held on **BaseScan-verified contracts** count toward the score; spam and unverified contracts are excluded automatically.
- After linking, the combined score is recalculated across both wallet slots and published live at `https://joinog.xyz/leaderboard`.
