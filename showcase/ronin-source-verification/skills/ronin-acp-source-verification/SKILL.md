---
name: ronin-acp-source-verification
description: Buy source-cited information retrieval or claim-check research from the pinned RONIN provider through Virtuals ACP, using an independently controlled buyer wallet and explicit price approval.
version: 1.0.0
---

# RONIN ACP Source Verification

Use this skill when a buyer asks for sources, information retrieval, or a source-backed check of a claim and chooses RONIN's existing ACP offering. Do not invoke it for unrelated research or treat catalog rank as a purchase decision.

## Provider

- Address: `0x7ffde998bb8e05cf1a946f4edf3e8d8a991e387f`
- Offering: `information_retrieval`
- Chain: Base (`8453`)
- Public seller site: https://seller.agratys.website/

## Buyer preconditions

- Use the official `@virtuals-protocol/acp-cli` in the buyer's own environment. Authenticate the buyer agent with `acp configure` and use only its own signer and funded Base wallet. Never use RONIN's, the Creator's, an affiliated, or a reciprocal buyer identity.
- Keep credentials and wallet material out of prompts, logs, proof files, and the RONIN package.
- A skill install grants no wallet access by itself. Stop if the buyer runtime cannot run `acp client` with its own authorization.

## Requirements

Ask the buyer for a concrete question or claim, then form JSON such as:

```json
{"query":"Find primary sources for this claim and identify any contradiction","max_results":5}
```

Use a non-empty `query` or `topic` of at most 2,000 characters. `max_results`, if present, must be an integer from 1 through 10. The live offering schema permits other aliases, but this skill uses `query` or `topic` so the intent is clear. Do not put private material into requirements without the buyer's specific authorization.

## Buyer workflow

1. Confirm the user's research intent. If discovery is useful, run `acp browse "information retrieval" --chain-ids 8453`; do not assume the first result is RONIN. Check that the chosen provider address, chain, and exact offering name match the pinned values above.
2. Show the buyer the exact requirements and explain that creating a job may cause an on-chain action. Obtain the buyer's approval to create this specific job.
3. Create one job only:

   ```bash
   acp client create-job --provider 0x7ffde998bb8e05cf1a946f4edf3e8d8a991e387f --offering-name information_retrieval --requirements '<JSON>' --chain-id 8453
   ```

4. Record the job ID. Read `acp job history --job-id <JOB_ID> --chain-id 8453` until the agreed budget or price is visible. Show the buyer the job ID, provider, requirements, price, chain, and wallet to be charged. Require explicit approval for that exact amount before funding. The 0.010000 USDC observed in the 2026-10-01 catalog is context, not a spending authorization.
5. Fund only that approved job from the independent buyer's wallet:

   ```bash
   acp client fund --job-id <JOB_ID> --chain-id 8453
   ```

6. Read `acp job history --job-id <JOB_ID> --chain-id 8453` until the provider submits a deliverable or the job reaches its timeout. Inspect the structured result: require `service_id` equal to `ronin.search-router.v0`, a matching `query`, arrays for `results` and `sources`, a string `summary`, an object `fact_check`, a `delivery_id`, and a 64-character lowercase hexadecimal `fulfillment_sha256`. Examine source relevance and whether the answer actually addresses the buyer's request; schema shape alone does not prove factual correctness.
7. Show the result and source limitations to the buyer. Complete only after the buyer accepts the deliverable; reject only on the buyer's explicit decision and stated reason:

   ```bash
   acp client complete --job-id <JOB_ID> --chain-id 8453 --reason "Deliverable accepted"
   acp client reject --job-id <JOB_ID> --chain-id 8453 --reason "<BUYER_REASON>"
   ```

## Stop conditions

- Stop if provider, offering, chain, requirement schema, price, or wallet differs from what the buyer approved.
- Stop on missing budget, malformed deliverable, timeout, or unclear ACP status; report the existing job ID rather than creating a duplicate.
- Do not infer purchase, delivery, or revenue from a browse result or this skill's presence. Do not submit a review or other write without a separate buyer request.

Report the job ID, status, provider, chain, requirements, paid amount if any, source-backed findings, and whether completion or rejection still awaits the buyer.
