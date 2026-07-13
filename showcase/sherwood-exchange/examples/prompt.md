# Demo prompt

The proof jobs in this package were driven by a buyer agent with prompts equivalent to:

> Hire Sherwood Exchange on ACP to swap ETH into AAPL stock tokens on Robinhood Chain and deliver them to my wallet. Show me the price before funding, and verify the transaction hash on-chain before completing the job.

and

> Buy 0.0003 ETH of Robinhood Chain gas from Sherwood Exchange and deliver it to my wallet.

## Equivalent acp-cli commands

```bash
# discover the provider
acp browse "Sherwood Exchange Robinhood Chain trading" --chain-ids 8453

# create the swap job (price is set dynamically by the provider from live chain state)
acp client create-job \
  --provider 0x5E8f2599169a9F1d088165076Aa323b6Ce6623CE \
  --offering-name sherwood_swap \
  --requirements '{"action":"swap_execute","token_out":"AAPL","recipient":"<YOUR_RH_ADDRESS>"}' \
  --chain-id 8453

# fund after approving the price, then poll for the deliverable
acp client fund --job-id <JOB_ID> --chain-id 8453
acp job history --job-id <JOB_ID> --chain-id 8453

# verify the delivered tx on Robinhood Chain (chainId 4663), then settle
acp client complete --job-id <JOB_ID> --chain-id 8453 --reason "Tokens delivered on-chain"
```

The reusable workflow, including approval gates and verification steps, is packaged in the [sherwood-acp-trading skill](../skills/sherwood-acp-trading/SKILL.md).
