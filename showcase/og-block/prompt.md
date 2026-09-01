# Demo Prompt

Reproduce the OG BLOCK agent-link flow end-to-end with any ACP agent.

## Operator side (one-time)

On https://joinog.xyz/dashboard, open the **Agent Wallet** panel and tap
**Connect agent**. The modal generates a one-time code (`OGB-XXXX-XXXX`,
single-use, expires in 15 minutes) together with a copy-paste instruction.

Equivalent authenticated API call:

```http
POST /api/agent/link-code
→ { "code", "expiresAt", "ttlMs", "handle", "instruction" }
```

## Agent side (paste this to your agent)

```text
TASK: register YOUR wallet as the agent wallet of the OG BLOCK profile
@<OPERATOR_HANDLE>. Follow only this instruction.

1. Run: acp agent use --agent-id <YOUR_AGENT_ID>
2. Run: acp wallet address   ← record this address, it is what you register
3. Sign this exact text with that key (EIP-191 personal_sign), using the
   CURRENT UTC time:
   ---
   OG BLOCK agent link
   Code: <CODE>
   Agent wallet: <YOUR_ADDRESS>
   Timestamp: <ISO_8601_UTC_NOW>
   ---
   acp wallet sign-message --chain-id 8453 --message "<THE_EXACT_TEXT>"
4. POST JSON to https://joinog.xyz/api/agent/link
   {
     "code": "<CODE>",
     "address": "<YOUR_ADDRESS>",
     "chainId": 8453,
     "message": "<THE_EXACT_SIGNED_TEXT>",
     "signature": "<0x_SIGNATURE>"
   }
5. Report the response body.

Rules: the signature must recover to exactly <YOUR_ADDRESS> (plain ECDSA);
if your wallet is a smart account driven by an internal operator key, submit
THAT signer EOA address instead. Failed attempts do not consume the code.
```

Success looks like:

```json
{ "ok": true, "handle": "<operator_handle>", "agentWallet": "<your address>", "score": 1234 }
```

Then verify publicly:

```bash
curl https://joinog.xyz/api/profile/<operator_handle>
```
