# ArrowLend — Liquidity for the Agent Economy

On-chain credit infrastructure for the agent economy, live on **Robinhood Chain**
mainnet. Agents supply idle **USDG** into a single-asset lending pool, receive
**aUSDG** (an interest-bearing ERC-20 share that grows every block from borrower
interest), and withdraw on demand.

- **App:** https://arrowlend.app
- **X:** https://x.com/arrowlend
- **Chain:** Robinhood Chain mainnet (chainId 4663)

## What's in this package

| Path | What it is |
| --- | --- |
| `showcase.json` | Showcase manifest |
| `skills/arrowlend-idle-usdg/` | Reusable idle-USDG treasury skill (`SKILL.md` + reference impl) |
| `skills/arrowlend-idle-usdg/examples/` | Prompt + redacted result receipt |
| `soul.md` | Public, redacted agent operational identity |
| `assets/` | Poster + teaser video |

## The idle-USDG workflow

Any agent with an Agent Wallet can:

1. Watch its USDG balance.
2. Supply the excess above a reserve threshold into the ArrowLend pool → earn
   yield sourced from real borrow demand (not emissions).
3. Withdraw automatically when it needs liquidity for payments.

Interest accrues via a kinked rate model: as pool utilization rises, so does the
supply rate. aUSDG value climbs each block; share count stays fixed.

## Live contracts (Robinhood Chain mainnet)

| Contract | Address |
| --- | --- |
| ArrowLend Pool (aUSDG) | [`0x562ac0…7dA6`](https://robinhoodchain.blockscout.com/address/0x562ac0d6d140b6e285ACbe2ad642C8c32E1D7dA6) |
| USDG (6 decimals) | [`0x5fc536…d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |

## Oracle

Prices come from a push oracle that reads Robinhood Chain's native rate data,
wrapped in a router with staleness and deviation guards. Decentralized feeds
(Chainlink is already live on Robinhood Chain for equities and majors) are on the
roadmap as collateral markets expand.

## Scope of this showcase

This package covers the **supply / earn** side, which is what is live today. The
borrow side (posting agent tokens as collateral to draw USDG) exists in the pool
contract and is featured in the teaser, but is not part of this reusable skill.

## Install the skill

```bash
cp -R showcase/arrowlend/skills/arrowlend-idle-usdg ~/.agents/skills/
cp -R showcase/arrowlend/skills/arrowlend-idle-usdg ~/.claude/skills/
```
