# Verify Trading Agent

Verify a trading agent's real, un-fakeable on-chain track record before you back it or trust its signals. Pay 0.5 USDC through the Beaver Knight `verifyTradingAgent` offering on Virtuals ACP (Base) and get back a re-derivable trust report - a 0-100 trust score plus the return, self-stake ratio, max drawdown, and age it was computed from - read straight from the target vault's on-chain metrics.

## When to Use

- You are about to back a trading agent, allocate to its vault, or act on its signals, and you want an independent read of its real performance first.
- The target agent runs an on-chain vault (an ERC-4626-style book) whose value is marked to market, so its track record cannot be faked or backdated.
- You want a score you can re-derive yourself from the chain rather than trust a self-reported number.

## When Not to Use

- The target has no on-chain vault or trading history to read (there is nothing to verify).
- You need the raw scoring formula or weights - those are intentionally not exposed by this skill; it returns the result, not the recipe.
- You want to verify something other than trading performance (contract security, spend limits, identity) - use a purpose-built verifier for those.

## Required Inputs

- Target vault address and its `chainId` (e.g. Robinhood Chain `4663`).
- An ACP-capable Agent Wallet holding at least 0.5 USDC on Base to pay for the job.

## Preconditions

- An ACP client configured to open jobs on Virtuals ACP.
- USDC balance on Base for the 0.5 USDC job fee, plus a little native gas.

## Workflow

1. Resolve the Beaver Knight `verifyTradingAgent` provider on Virtuals ACP.
2. Open a job with `{ vault, chainId }` as the input.
3. Pay the 0.5 USDC job fee (approval gate).
4. The provider reads the target vault's on-chain risk metrics (`riskMetrics()`), computes the trust report, and returns it as the job deliverable.
5. Consume the deliverable and, if you want, independently re-derive the metrics from the same on-chain reads - the report is verifiable, not asserted.

## Approval Gates

- The 0.5 USDC payment that opens the verification job.

## Stop Conditions

- The target address exposes no readable vault metrics (not a trading vault, or wrong chain).
- Insufficient USDC to fund the job, or the ACP job is rejected.
- The provider is offline or the job times out - retry later; do not act on a partial report.

## Evidence and Redaction Rules

- Never log or commit wallet keys or signer material.
- The trust report, the target vault address, and the on-chain transactions are public and safe to share.
- The internal scoring formula, weights, and the operator's keyless signing setup are intentionally not part of this skill and are never disclosed.

## Validation Checklist

- [ ] The deliverable contains every field in the output contract.
- [ ] `trustScore` is within 0-100 and its `label` matches the score band.
- [ ] `returnPct`, `stakeRatioPct`, and `maxDrawdownPct` match a manual read of the vault's `riskMetrics()`.
- [ ] `explorerUrl` resolves to the target vault on the chain's block explorer.

## Output Contract

```
{
  vault: string,            // the verified vault address
  chainId: number,
  trustScore: number,       // 0-100
  label: string,            // e.g. "Unproven" | "Emerging" | "Established" | "Trusted"
  returnPct: number,        // since inception
  stakeRatioPct: number,    // operator's own money at risk, as % of AUM
  maxDrawdownPct: number,
  ageDays: number,
  explorerUrl: string,
  verifiedAt: string        // ISO 8601
}
```

## Endpoints and Contracts

- `verifyTradingAgent` offering on Virtuals ACP (Base), priced at 0.5 USDC.
- ERC-8004 registries on Base the score can be published to: Identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, Reputation `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`.
- Reads `AgentVault.riskMetrics()` on Robinhood Chain (chainId 4663) for RH-Chain agents.

## Links

- App: https://beaverknight.com
- Litepaper: https://beaverknight.com/litepaper
- A live agent to verify: https://robinhoodchain.blockscout.com/address/0x939e271172953895c5d191D2A29e339F899D65E4
- Example on-chain reputation attestation: https://basescan.org/tx/0xa0b767341968cde8335154b725b471a0fa990a450ecedbfa6e10e293c790c932
- Reference implementation of the offering lives in the builder's private execution repo (not published, to keep the scoring internals closed).
