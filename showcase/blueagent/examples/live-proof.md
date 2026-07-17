# BlueAgent — capabilities

Four surfaces, live on Base and Robinhood Chain mainnet.

**Demo video:** [blueagent-demo.mp4](https://github.com/Virtual-Protocol/acp-cli-demos/blob/main/showcase/blueagent/blueagent-demo.mp4)

---

## Blue Chat

Natural-language onchain agent. No commands — it reads the chain, verifies what it finds,
and executes with the user signing every transaction.

**Multi-model** — routes across Claude models; the active model, latency, and credit cost
are shown on every turn.

| | |
|---|---|
| **Read** | live token prices, TVL, trending pairs, new pools, DEX flow, whale movement |
| **Verify** | honeypot detection, contract trust, key/backdoor exposure, AML wallet screening, B20 authenticity |
| **Execute** | swaps with live pool quotes, USDC/token sends with ENS resolution, yield positions, token launches |
| **Build** | Solidity contracts, React dashboards, HTML apps, scripts |
| **Wallet** | full portfolio read; B20 tokens carry a verified badge, everything else does not |

Non-custodial throughout. BlueAgent never holds keys or funds.

**Chains:** Base · Robinhood Chain (4663)

---

## Blue Hub — x402 tool marketplace

A two-sided marketplace on Base. Agents discover tools and **pay per call in USDC** — no
signup, no API key, no account. Anyone can list a tool and keep **95%** of what it earns.

**Live tool categories:**

| Category | Tools |
|---|---|
| **Prices & market** | `hub_token_price` · `hub_token_momentum` · `hub_dex_flow` · `hub_narrative_pulse` |
| **Security** | `hub_risk_gate` · `hub_honeypot` · `hub_contract_trust` · `hub_key_exposure` · `hub_deep_analysis` |
| **Trading intel** | `hub_token_pick` · `hub_whale_signal` · `hub_competitor_scan` · `hub_market_fit` |
| **Builder** | `hub_builder_score` · `hub_repo_health` · `hub_base_grant` · `hub_builder_dd` · `hub_investor_memo` · `hub_fundraise_timing` |
| **Onchain** | `hub_crypto_rpc` (21 chains) · `check_wallet` · `prepare_swap` · `robinhood_swap` |
| **Launches** | `hub_b20_launch` · `hub_robinhood_launch` · `prepare_token_launch` |
| **Research** | `web_search` · `hub_ecosystem` |

**Pricing:** $0.01 – $1.00 per call. Settlement runs on-chain through the Coinbase CDP
facilitator.

**Why it matters for ACP:** Blue Hub already settles over **x402** — the same rail ACP
uses for payment execution. Tools are priced per call, paid in USDC, with no accounts and
no keys. That is the shape of an ACP job. The marketplace and the rails are live; ACP
adds the agent demand and the reputation layer.

---

## B20 Hub — the verify layer

Full lifecycle tooling for Base's **B20 Native Token Standard**, live from day one of
mainnet activation.

| Tool | What it does |
|---|---|
| `hub_b20_inspect` | Read live B20 state — variant, supply, cap, roles, pause state, policies |
| `hub_b20_analyze` | Explain a deployment and its role configuration |
| `hub_b20_manage` | Mint, burn, pause, set policy |
| `hub_b20_launch` | Deploy a B20 — user signs, no custody, no platform fee |
| `check_authorization` | Check whether a wallet is permitted under a token's transfer policy |

**Protocol precompiles** (same address on every Base network):

```
B20 Factory          0xB20f000000000000000000000000000000000000
Activation Registry  0x8453000000000000000000000000000000000001
Policy Registry      0x8453000000000000000000000000000000000002
```

### The trap it closes

Real B20 tokens live at `0xB200…` addresses. **That prefix is CREATE2 vanity — it can be
faked.** Plain ERC-20s already squat `0xB200…` addresses and call themselves "B20." Token
names, holder counts, and address prefixes are all forgeable.

**Only `isB20()` on the Factory proves authenticity.** BlueAgent calls it first, every
time, then multicalls the token for its real state. Grounded reads — never a model's
guess.

This is why a verified B20 in a user's wallet carries a badge and nothing else does.

### Activation gating

B20 tooling reads `isActivated()` from the Activation Registry rather than trusting a
hardcoded date — so it went live in the same block B20 mainnet did. An RPC failure
degrades to `unknown`, never to `active`.

---

## MCP server

Every capability above is exposed over MCP for Claude and Cursor.

```bash
claude mcp add blue-agent --transport http https://blueagent.dev/api/mcp
```

Agents connect once and get chain reads, safety checks, B20 verification, and execution
prep — the same tools Blue Chat uses.

---

## Robinhood Chain (4663)

| | |
|---|---|
| **Stream** | live chain TVL, trending pairs, new pools as they land |
| **Risk** | low-liquidity launches and collapsing tokens flagged — volume against thin liquidity is surfaced, not hidden behind a green percentage |
| **Swap** | live Uniswap pool quotes, user-signed |
| **Launch** | via Bankr — auto Uniswap pool, 0.7% swap fee, 95% recurring to the creator, gas handled |

---

## Live

- **App** — https://app.blueagent.dev
- **B20 verify** — https://blueagent.dev/b20
- **Blue Hub** — https://blueagent.dev/hub
- **MCP** — `https://blueagent.dev/api/mcp`
