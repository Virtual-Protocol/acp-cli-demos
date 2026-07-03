# Skill: laguna-affiliate-link-via-acp

## When to use this skill

Use this skill when an agent needs to mint a tracked affiliate shortlink for a specific merchant and user wallet, using the Laguna Network affiliate platform, mediated by an ACP v2 agent-to-agent job.

**Use when:**
- You have a merchant the user wants to purchase from (hotel, flight, product retailer)
- You want to earn the user real USDC cashback on that purchase
- You need a tracked link — not a raw merchant URL

**Do not use when:**
- You need to complete a purchase autonomously (this skill only delivers a link, not a booking)
- The merchant is not in the Laguna Network catalogue
- You do not have a user wallet address to attach the cashback to

---

## Required inputs

| Input | Source | Notes |
|---|---|---|
| `merchant_name` | User request or search result | e.g. `"Trip.com"`, `"Agoda"`, `"Lazada"` |
| `user_wallet_address` | User profile / onboarding | Base Mainnet EVM address |
| `acp_client` | Agent runtime | Initialised ACP v2 client with funded wallet |
| `laguna_provider_wallet` | Agent config | Wallet address of the ACPLagunaTranslator provider agent |

---

## Preconditions

1. ACP client wallet has ≥ 0.01 USDC on Base Mainnet (job budget).
2. The Laguna bridge provider agent (`ACPLagunaTranslator`) is registered and online in the Agent Registry.
3. The Laguna MCP is reachable at `agents.laguna.network/mcp`.

---

## Step-by-step workflow

### Step 1 — Discover the provider

```ts
const agents = await acpClient.browseAgents("Laguna Affiliate");
const provider = agents.find(a => a.walletAddress === LAGUNA_PROVIDER_WALLET);
const offering = provider.offerings.find(o => o.name === "mint_link");
```

Fail if no matching provider is found. Log and surface error to the user.

### Step 2 — Create and fund the job

```ts
const job = await acpClient.createJobFromOffering(offering, {
  userWallet: user_wallet_address,
  merchantName: merchant_name,
});
// Budget: 0.01 USDC. Set by provider; client funds it.
await job.fund();
```

Record `job.id` for polling / event tracking.

### Step 3 — Wait for delivery

Listen for the `job.submitted` event via SocketTransport:

```ts
acpClient.on("job.submitted", async (event) => {
  if (event.jobId === job.id) {
    const deliverable = event.deliverable; // affiliate shortlink URL
    // proceed to Step 4
  }
});
```

**Polling fallback:** if no event within 60 s, call `acpClient.hydrateSessions()` and check `job.status`.

Timeout at 120 s. If job has not submitted, surface error and offer to retry.

### Step 4 — Complete the job and return the link

```ts
await job.complete();
return deliverable; // the affiliate shortlink URL
```

The 0.01 USDC escrow is released to the provider. The user's wallet is registered for cashback tracking by Laguna.

---

## Approval gates

This skill performs two on-chain actions that require the agent to have pre-authorised funds:

1. **Job creation + funding** — deducts 0.01 USDC from the agent's Base wallet.
2. **Job completion** — releases funds to the provider.

No human approval is required per-link if the agent wallet has been pre-funded. Surface the 0.01 USDC cost to users during onboarding.

---

## Stop conditions

Stop and return an error without completing the job if:
- Provider agent not found in registry
- Job funding fails (insufficient balance)
- Deliverable not received within 120 s
- Deliverable URL is malformed or does not match expected shortlink domain

---

## Evidence and redaction rules

When logging or producing a result report:
- **Include:** job ID, provider wallet (truncated to first 6 + last 4 chars), merchant name, link domain (not full URL), completion timestamp
- **Redact:** full affiliate shortlink URL (contains user tracking token), user wallet address (truncate), any Laguna API keys or auth headers

---

## Validation checklist

- [ ] Provider discovered by wallet address, not by name only
- [ ] Job ID recorded before funding
- [ ] Deliverable is a valid HTTPS URL
- [ ] `job.complete()` called after receiving deliverable
- [ ] Error path surfaces a human-readable message (not a raw exception)

---

## Output contract

```ts
{
  success: boolean,
  jobId: string,          // ACP job ID
  affiliateUrl: string,   // tracked shortlink (deliver to user)
  merchant: string,       // canonical merchant name
  cashbackRate: string,   // e.g. "5%" (from Laguna merchant info)
  timestamp: string,      // ISO 8601
}
```

On failure:
```ts
{
  success: false,
  error: string,          // human-readable reason
  jobId?: string,         // set if job was created before failure
}
```
