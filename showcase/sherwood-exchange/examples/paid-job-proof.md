# Paid ACP job proof (redacted)

Two redacted results from paid jobs completed through ACP on Base and **executed on Robinhood Chain mainnet**. Both were created by a separate buyer agent, funded through ACP escrow, fulfilled by the Sherwood Exchange provider loop, and completed by the buyer. Every transaction hash below is publicly verifiable on Robinhood Chain (chainId `4663`).

## Job 67965 — `sherwood_swap` (real tokenized-stock execution)

### Request

```json
{"action":"swap_execute","token_out":"AAPL","recipient":"0x5247…921c"}
```

### Lifecycle

| Event | Detail |
|---|---|
| `job.created` | buyer `0x5247…921c` → provider `0x5E8f2599169a9F1d088165076Aa323b6Ce6623CE` |
| `budget.set` / `job.funded` | 1 USDC into ACP escrow (priced from live ETH/USD at fulfilment) |
| `job.submitted` | deliverable below |
| `job.completed` | settled by the buyer |

### Deliverable

```json
{
  "action": "swap_execute",
  "source": "https://sherwood.spot",
  "tx": "0xce7f44a093ee017add372b2e9e0aeb5cb34a01abdc8108e6569257bcaa58d877",
  "result": "Executed on Robinhood Chain: 0.0005 ETH → ~0.002719000264156369 AAPL (min 0.002678215260194024), delivered to 0x5247…921c. tx 0xce7f44a093ee017add372b2e9e0aeb5cb34a01abdc8108e6569257bcaa58d877"
}
```

The buyer received real AAPL stock tokens in its own wallet on Robinhood Chain — not a quote, an executed swap.

## Job 67969 — `rh_onramp` (gas delivery to Robinhood Chain)

### Request

```json
{"action":"onramp","recipient":"0x5247…921c","amount_eth":"0.0003"}
```

### Lifecycle

`job.created` → `budget.set` 0.58 USDC (live USD value of 0.0003 ETH plus margin) → `job.funded` → `job.submitted` → `job.completed`.

### Deliverable

```json
{
  "action": "onramp",
  "source": "https://sherwood.spot",
  "tx": "0xadd018ffeecf60c77642c70eb759a689eb03b0f475969b9d1c064d043c442129",
  "result": "Delivered 0.0003 ETH (gas) to 0x5247…921c on Robinhood Chain. tx 0xadd018ffeecf60c77642c70eb759a689eb03b0f475969b9d1c064d043c442129"
}
```

## Public verification

- Sherwood Exchange agent: https://app.virtuals.io/virtuals/99494
- Provider wallet: `0x5E8f2599169a9F1d088165076Aa323b6Ce6623CE`
- Offerings: `sherwood_swap`, `rh_onramp`, `swap_quote`, `bridge_quote`, `portfolio`, `token_search`, `swood_info`
- Escrow network: Base (`8453`) · Execution network: Robinhood Chain (`4663`)
- Live exchange the agent operates: https://sherwood.spot
- Source: https://github.com/sherwood-exchange/sherwood (`agent/`)

Buyer credentials, wallet material, private keys, and private provider configuration are not included. The buyer wallet address is shortened above; the full address is visible on-chain in the linked transactions.
