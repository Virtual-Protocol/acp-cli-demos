---
name: sherwood-acp-trading
description: Hire Sherwood Exchange through Virtuals ACP for live DEX quotes, portfolio reads, gas on-ramping, and real bounded swap execution on Robinhood Chain.
version: 1.0.0
---

# Sherwood ACP Trading

Use this skill when a user or agent wants any of the following from Robinhood Chain (chainId `4663`), paid for in USDC through ACP on Base:

- a live routed swap quote (any listed token pair, including tokenized stocks such as AAPL, TSLA, NVDA)
- a cross-chain bridge quote (ETH out of Robinhood Chain via Relay)
- a portfolio valuation of a Robinhood Chain address
- a token search across the exchange's listed universe
- $SWOOD utility and staking stats
- **a real executed swap** delivered to a Robinhood Chain address
- **gas (ETH) delivered** to a Robinhood Chain address

Do not use it to manage the buyer's wallet, provide financial advice, execute amounts above the provider's published bound, or claim a quote guarantees an execution price.

## Provider

- Address: `0x5E8f2599169a9F1d088165076Aa323b6Ce6623CE`
- Profile: https://app.virtuals.io/virtuals/99494
- Escrow chain: Base (`8453`) · Execution chain: Robinhood Chain (`4663`)
- Live exchange: https://sherwood.spot · Source: https://github.com/sherwood-exchange/sherwood

## Preconditions

- Install or invoke `@virtuals-protocol/acp-cli`.
- Authenticate a buyer agent with `acp configure` (with a signer added).
- Fund the buyer wallet with enough Base USDC for the selected job.
- For `swap_execute` and `onramp`: have a Robinhood Chain address to receive delivery.
- Keep buyer credentials and wallet material out of prompts, logs, and proof files.

## Offerings and inputs

Every requirement is a JSON object whose `action` field routes the job:

| Offering | `action` | Other fields | Pricing |
|---|---|---|---|
| `swap_quote` | `quote` | `token_in`, `token_out`, `amount` | $0.10 fixed |
| `bridge_quote` | `bridge_quote` | `amount`, `chain` | $0.10 fixed |
| `portfolio` | `portfolio` | `address` | $0.10 fixed |
| `token_search` | `token_search` | `query` | $0.05 fixed |
| `swood_info` | `swood_utility` | — | $0.05 fixed |
| `sherwood_swap` | `swap_execute` | `token_out`, `recipient`, optional `amount_eth` | dynamic: live USD value × 1.05 |
| `rh_onramp` | `onramp` | `recipient`, `amount_eth` | dynamic: live USD value × 1.05 |

Execution amounts are bounded by the provider (`amount_eth` is clamped to its published maximum, currently 0.002 ETH per job). The provider prices execution jobs at fulfilment time from live chain state; the price appears as the job budget before funding.

Example requirements:

```json
{"action":"quote","token_in":"ETH","token_out":"USDG","amount":"1"}
{"action":"swap_execute","token_out":"AAPL","recipient":"0xYourRhAddress","amount_eth":"0.001"}
{"action":"onramp","recipient":"0xYourRhAddress","amount_eth":"0.0003"}
```

## Workflow

1. Confirm the requested action, parameters, and (for execution jobs) the delivery address with the user.
2. Discover the provider if needed:

   ```bash
   acp browse "Sherwood Exchange Robinhood Chain trading" --chain-ids 8453
   ```

3. Create the job:

   ```bash
   acp client create-job \
     --provider 0x5E8f2599169a9F1d088165076Aa323b6Ce6623CE \
     --offering-name <OFFERING> \
     --requirements '<JSON>' \
     --chain-id 8453
   ```

4. Wait for `budget.set`, then show the user the price and requirements. Get explicit approval before funding — execution jobs are priced dynamically, so never assume the price.
5. Fund the approved job:

   ```bash
   acp client fund --job-id <JOB_ID> --chain-id 8453
   ```

6. Poll `acp job history --job-id <JOB_ID> --chain-id 8453` until the provider submits or the job times out. (If the provider's execution fails it does not submit; the job expires and escrow refunds.)
7. Verify the deliverable:
   - Info jobs: the deliverable must be a JSON object with a `result` for the requested action.
   - Execution jobs: the deliverable must contain a `tx` hash. Confirm it exists on Robinhood Chain (chainId `4663`, RPC `https://rpc.mainnet.chain.robinhood.com`) and that the recipient matches before settling.
8. Complete only after verification and user approval:

   ```bash
   acp client complete --job-id <JOB_ID> --chain-id 8453 --reason "Deliverable verified"
   ```

## Approval gates

- Never fund a job without explicit user approval of its price and requirements.
- Never approve an execution job whose dynamic price deviates unreasonably from the live USD value of the requested amount (expected margin ≈ 5%).
- Never complete a job before showing the deliverable to the user, and for execution jobs, before the delivered transaction is confirmed on-chain.

## Stop conditions

- Stop if the discovered provider address does not match the address above.
- Stop if the offering, chain, price, or requirements differ from what the user approved.
- Stop if an execution deliverable lacks a `tx` hash, the transaction is absent on Robinhood Chain, or the recipient does not match.
- Stop and report the job ID if ACP status is unclear instead of creating a duplicate paid job.

## Evidence and redaction

Record the job ID, offering, price, deliverable JSON, and on-chain transaction hash as proof. Redact buyer credentials, private keys, session tokens, and any private configuration. On-chain addresses and transaction hashes are public by nature and may be kept.

## Validation checklist

- [ ] Provider address matches this skill.
- [ ] Price approved by the user before funding.
- [ ] Deliverable JSON parsed and matches the requested action.
- [ ] For execution jobs: transaction confirmed on Robinhood Chain and recipient matches.
- [ ] Job completed (or rejected) with a stated reason.

## Output

Return:

- job ID and final status
- offering, requirements, and funded price
- the deliverable's `result` text
- for execution jobs: the Robinhood Chain transaction hash and delivered amount
- whether the job still needs completion or rejection

Quotes are point-in-time reads of public liquidity, not guarantees. An executed swap's realized amount is whatever the delivered transaction shows on-chain.
