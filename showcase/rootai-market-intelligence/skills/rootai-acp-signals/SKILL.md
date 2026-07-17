---
name: rootai-acp-signals
description: Discover rootAI and purchase graded Hyperliquid market signals through Virtuals ACP.
version: 1.0.0
---

# rootAI ACP Signals

Use this skill when a user wants recent rootAI market signals or the latest signal for one Hyperliquid market through ACP.

Do not use it to place trades, modify orders, manage wallets, or claim that a signal guarantees a return.

## Provider

- Address: `0x9d23ddd0a527b3b63927956840c8ff35b9db95a6`
- Offering: `rootai_pro_signals`
- Chain: Base (`8453`)
- Profile: https://app.virtuals.io/virtuals/92029

## Preconditions

- Install or invoke `@virtuals-protocol/acp-cli`.
- Authenticate a buyer agent with `acp configure`.
- Fund the buyer wallet with enough Base USDC for the selected job.
- Keep buyer credentials and wallet material out of prompts, logs, and proof files.

## Inputs

Recent mode:

```json
{"mode":"recent","limit":3,"min_grade":"B"}
```

Single-market mode:

```json
{"mode":"by_coin","coin":"BTC"}
```

Accepted fields:

- `mode`: `recent` or `by_coin`
- `coin`: required for `by_coin`; use canonical names such as `BTC` or `xyz:SPCX`
- `limit`: 1 to 10 in recent mode
- `min_grade`: optional `A`, `B`, `C`, or `D`
- `asset_class`: optional market filter

## Workflow

1. Confirm the requested mode and filters.
2. Discover the provider if needed:

   ```bash
   acp browse "rootAI Hyperliquid market intelligence" --chain-ids 8453
   ```

3. Create the job:

   ```bash
   acp client create-job \
     --provider 0x9d23ddd0a527b3b63927956840c8ff35b9db95a6 \
     --offering-name rootai_pro_signals \
     --requirements '<JSON>' \
     --chain-id 8453
   ```

4. Show the user the job price and requirements. Get explicit approval before funding.
5. Fund the approved job:

   ```bash
   acp client fund --job-id <JOB_ID> --chain-id 8453
   ```

6. Poll `acp job history --job-id <JOB_ID> --chain-id 8453` until the provider submits or the job reaches its timeout.
7. Parse the structured deliverable and verify that `signals` is an array. For each result, require a market, direction, grade, and signal kind.
8. Present the signals and ask the user whether to complete or reject the job.
9. Complete only after approval:

   ```bash
   acp client complete --job-id <JOB_ID> --chain-id 8453 --reason "Deliverable received"
   ```

## Approval gates

- Never fund a job without explicit user approval of its price and requirements.
- Never complete a job before showing the deliverable to the user.
- Never create a trade or transaction from a signal without a separate execution request and confirmation.

## Stop conditions

- Stop if the discovered provider address does not match the address above.
- Stop if the offering, chain, price, or requirements differ from what the user approved.
- Stop if the deliverable is missing, malformed, or lacks a `signals` array.
- Stop and report the job ID if ACP status is unclear instead of creating a duplicate paid job.

## Output

Return:

- job ID and final status
- provider and chain
- request filters
- each signal's market, direction, grade, signal kind, interpretation, and timestamp when present
- whether the job still needs completion or rejection

Treat grades as quality rankings, not guarantees. Do not describe the result as an executed trade.
