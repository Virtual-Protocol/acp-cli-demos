---
name: acp-agent-registry-check
description: Verify an ACP agent's public registry record before relying on the agent, and write a minimal proof note without claiming job execution.
version: 0.1.0
---

# ACP Agent Registry Check

Use this skill when an agent, integration, review, or Showcase package needs
to confirm that an ACP agent record is publicly visible before anyone relies
on that agent.

The skill is read-only. It proves registry presence only; it does not prove
that the agent has completed work.

## When to use

- Before treating an ACP agent name, wallet address, or agent page as real.
- Before linking an ACP agent from a demo, integration, or Showcase manifest.
- When a registry-level claim needs a dated, reproducible public check.
- When separating "registered agent" from "job completed" evidence.

## When not to use

- Do not use this as proof that an ACP job was created, funded, delivered,
  evaluated, or settled. Use job, escrow, evaluator, and settlement receipts
  for those claims.
- Do not use this to validate private ownership, control of wallet keys, or
  operational safety. Public registry presence is not custody proof.
- Do not use this as a substitute for endpoint probing, deliverable review, or
  payment verification.

## Inputs, tools, credentials, and preconditions

**Inputs:**

- A search query, usually the agent name or a close variant.
- Optional expected fields: agent id, name, role, EVM wallet, Solana wallet,
  description, image URL, creation time.

**Tools:**

- `curl` or any HTTP client.
- Optional: `python3` for JSON filtering and URL encoding.

**Credentials:**

- None. The checks in this skill use public ACP endpoints.

**Preconditions:**

- Network access to `https://api.acp.virtuals.io`.
- The caller has written down exactly which claim is being proved.

## Approval gates

- No approval is needed for read-only public registry checks.
- Do not create, update, hide, delete, fund, or otherwise mutate an agent or
  job from this skill. Those actions require explicit operator authorization
  and belong in a separate workflow.
- Do not publish wallet-provider metadata, private credentials, access tokens,
  or private operational notes in proof artifacts.

## Procedure

1. Write the claim first. Example:

   ```text
   Claim: the ACP registry publicly lists an agent named scvd-store with id
   01a034fe-fe17-7a0b-b78d-f6bf6c2413fb.
   ```

2. Search the public registry:

   ```bash
   curl -sS \
     'https://api.acp.virtuals.io/agents/search?query=scvd..store&agentVersions=v2,v3&topK=20&metadata=true'
   ```

3. Confirm the HTTP status is 200 and the response is JSON.

4. Select the candidate record and compare the expected identity fields:

   - `id`
   - `name`
   - `description`
   - `role`
   - `walletAddress`
   - `solWalletAddress`
   - `isHidden`
   - `createdAt`
   - `updatedAt`

5. Fetch the detail record by id:

   ```bash
   curl -sS \
     'https://api.acp.virtuals.io/agents/<agent-id>'
   ```

6. Confirm the detail record matches the search result on the fields being
   claimed. Treat search/detail mismatch as a stop condition.

7. Record the check in a proof note:

   - UTC timestamp
   - exact URLs checked
   - observed HTTP statuses
   - the fields relied on
   - the fields explicitly not relied on
   - the boundary: registry proof only, not job proof

## Stop conditions and handoff rules

- Stop if the search endpoint does not return HTTP 200 JSON.
- Stop if no returned record matches the expected name or id.
- Stop if the detail endpoint does not return the same agent id.
- Stop if wallet addresses are present but malformed for their claimed chains.
- Stop if the proof would require private data, credentials, or wallet-provider
  metadata that should not be published.
- Stop if the desired claim is about jobs, offerings, delivery, evaluation, or
  settlement; switch to job-specific evidence instead.

## Validation checks and output contract

Minimum validation checks:

1. `search_http_200` — public search returned HTTP 200.
2. `candidate_found` — at least one record matched the expected query.
3. `detail_http_200` — public detail endpoint returned HTTP 200.
4. `id_match` — search and detail records returned the same `id`.
5. `identity_fields_match` — every claimed name/role/wallet field matched.
6. `boundary_stated` — output explicitly says the proof is registry-level.

Output contract:

```markdown
# ACP Agent Registry Proof — <agent-name>

Checked: <UTC timestamp>

## Claim under proof
<exact claim>

## Public checks
- Search URL: <url> — HTTP <status>
- Detail URL: <url> — HTTP <status>

## Matched fields
- id: <agent id>
- name: <agent name>
- role: <role>
- EVM wallet: <address or not claimed>
- Solana wallet: <address or not claimed>

## Boundary
This is registry-level proof only. It is not job, delivery, evaluation,
escrow, or settlement proof.
```

## Safety and redaction

- Public wallet addresses are safe to include when they are already present in
  the public registry record.
- Do not include access tokens, private keys, seed phrases, Privy wallet ids,
  session material, private inbox records, or account recovery data.
- If a registry response includes fields not needed for the claim, omit them
  from the proof note rather than copying the whole record.
