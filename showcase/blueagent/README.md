# BlueAgent

**Verify before you execute.**

A verify-first onchain agent for **Base** and **Robinhood Chain** — read the chain,
know what is real, then act.

---

## What it does

### B20 verify layer (Base) — live day one

Base's B20 Native Token Standard went live on mainnet, and BlueAgent was ready from
block one — gated on-chain against the Activation Registry, so it flipped live the
exact moment B20 did. No hardcoded dates.

**The trap it closes:** real B20s live at `0xB200…` addresses, but that prefix is
CREATE2 vanity — it can be faked, and plain ERC-20s already squat it while calling
themselves "B20." Names, holder counts, and address prefixes are all forgeable.

Only `isB20()` on the Factory precompile proves authenticity. BlueAgent checks it
**first, every time**, then multicalls the token for variant, supply, cap, roles,
pause state, and policies — grounded reads, never a model's guess.

### Robinhood Chain (4663) — live

- Real-time chain TVL, trending pairs, and new pools
- **Rug flags** on new launches — low-liquidity pools and freefalling tokens surfaced
  as they land
- Swaps with live pool quotes, signed in the user's own wallet
- Token launches via Bankr's launchpad

### Blue Hub — x402 tool marketplace on Base

Two-sided marketplace: agents call tools and pay **per call in USDC** — no signup, no
API key, no account. Anyone can list a tool and keep **95%** of what it earns.
Settlement runs on-chain through the Coinbase CDP facilitator.

### MCP

Connectable from Claude and Cursor.

---

## Why it matters for ACP

Blue Hub already runs on **x402** — the same payment rail ACP settles over. Tools are
priced per call and paid in USDC with no accounts and no keys, which is exactly the
shape an ACP job takes. The marketplace and the rails are live; what ACP adds is the
agent demand and the reputation layer to compound it.

And on the safety side: as agents transact autonomously, the cost of a wrong read moves
from "a bad tweet" to "a drained wallet." Verification is not a nice-to-have in an agent
economy — it is the precondition for one.

---

## Package contents

| Path | What it is |
|---|---|
| `showcase.json` | Card manifest |
| `soul.md` | Public agent context and boundaries |
| `skills/blueagent-b20-verify/` | Reusable skill — grounded B20 verification |
| `examples/live-proof.md` | Live proof from Base and Robinhood Chain mainnet |

---

## Links

- **App** — https://app.blueagent.dev
- **Site** — https://blueagent.dev
- **B20 verify** — https://blueagent.dev/b20
- **Blue Hub** — https://blueagent.dev/hub
- **MCP** — `https://blueagent.dev/api/mcp`
- **X** — [@blueagent_](https://x.com/blueagent_) · builder: [@madebyshun](https://x.com/madebyshun)
