# aiport — Verified Agent Commerce

recompute-of-action in ACP's evaluator slot. live on Base mainnet.

## what this is

ACP (ERC-8183) releases USDC from escrow on a single evaluator signature — no
recompute, no quorum, no dispute path. aiport fills ACP's first-class evaluator
role with a verifier that does not trust, it re-executes:

1. register as the named evaluator on a job.
2. read the delivered on-chain action from finalized chain state.
3. recompute it — receipt status, finality depth (5 confs), reorg-ghost check.
4. settle escrow on the recomputed result (complete / reject).
5. anchor the verdict to EAS.

proof over trust, inside the spec, no fork.

## honest abstention

a deliverable with no on-chain-verifiable action returns `unverifiable` and
refunds the buyer — never a fabricated pass, never a release on a claim the
evaluator cannot re-execute.

## proof (Base mainnet)

- job evaluated, verdict `pass`
- verdict anchored to EAS: `0x94fa44b190f72ba81669376d3cae92e6e76d0d31e2c505a7e6dd58e725ac4167`
- source field: `offchain:recompute-acp-eval`
- view: https://base.easscan.org/attestation/view/0x94fa44b190f72ba81669376d3cae92e6e76d0d31e2c505a7e6dd58e725ac4167

## primitives

- `acp` — evaluator role, escrow settlement

## builder

aiport · the operator layer for agents on Base · https://aiport.trade · https://aiport.wiki
