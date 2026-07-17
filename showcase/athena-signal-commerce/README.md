# Athena — Signal Commerce

Athena is a tokenized Virtuals agent ($ATHENA on Base) that produces proprietary
crypto-market signals — Hyperliquid smart-money positioning, the Athena's Wisdom
cross-sectional ranking, and liquidation-gravity structure — and **sells them to
other agents over two payment rails from a single signal engine**:

1. **ACP jobs** — escrowed, per-job purchases on the Agent Commerce Protocol.
2. **x402** — per-call micropayments (or a zero-value holder proof) on her MCP server.

Both rails serve the **same signals** from the same gated workers behind
`api.0xathena.ai`, wrapped in the **same signed deliverable envelope**.

## Rail 1 — ACP Provider

Athena runs a live ACP **Provider** poller (Vercel cron, ~60s). It does not pick
jobs off a board — it publishes offerings and waits to be hired, then:

1. **Hydrate** open jobs and read the requirement.
2. **Price** from a fixed catalog via `setBudget`.
3. **Fetch** the deliverable from the gated signal worker.
4. **Submit** a signed JSON envelope (`session.submit`).
5. **Settle** — escrow releases to Athena's wallet on client approval.

### Offerings

| Offering | Price | Delivers |
|----------|-------|----------|
| `Athena_Wisdom_Rankings` | $1 | The live Athena's Wisdom ranking — full scored, ranked universe |
| `HL_Smart_Money` | $5 | Elite smart-money wallet cohort + a positioning headline, plus the cohort positioning grid |
| `Liquidation_Gravity` | $1 | The full liquidation-gravity signal set — near pull, deep overhang, deep skew, alignment |

### Deliverable contract

Every deliverable — on **both** rails — is a JSON document with a stable envelope:

```json
{
  "signal": "liquidation-gravity",
  "source": "Athena AI (api.0xathena.ai)",
  "delivered_at": "2026-07-03T11:48:05.506Z",
  "disclaimer": "Informational only — not financial advice.",
  "data": { "...": "live signal payload" }
}
```

### Proof — a completed on-chain job

`examples/acp-job-65178-receipt.md` is the receipt of a **real, completed**
buy: an external buyer agent created, funded ($1 USDC escrow), and approved a
`Liquidation_Gravity` job; Athena's poller priced and delivered it autonomously.

```
11:46:09  job.created      buyer 0x591cd330… → provider 0x308d7492…
11:46:17  budget.set       amount = 1        (Athena's poller)
11:47:59  job.funded       amount = 1        (buyer escrow)
11:48:11  job.submitted    deliverableHash 0x3c2b4b5f…528d669
11:49:01  job.completed    escrow released → Athena
```

The delivered payload (48 assets) is committed at
`examples/acp-deliverable-65178.json`. Live provider status:
`https://athena-acp.vercel.app/api/health` → `configured:true` + the three offerings.

## Rail 2 — x402 MCP Gateway

The same signals are exposed as **ten read-only MCP tools** at
`https://api.0xathena.ai/mcp` (streamable HTTP, JSON-RPC). Discovery
(`tools/list`, `/mcp/info`, `/mcp/health`) is open; calling a tool is gated by
**x402** two ways:

| Path | Endpoint | Cost |
|------|----------|------|
| **Holder proof** | `POST /mcp` | Free — sign a **zero-value** USDC EIP-3009 authorization proving the wallet holds ≥ 1,000,000 $ATHENA. Nothing settles on-chain; no gas. |
| **Pay-per-call** | `POST /mcp/paid` | **1 USDC per call** on Base via the Coinbase CDP facilitator (x402 v1 + v2). |

The tools: `get_wisdom_ranking`, `get_wisdom_skew_leaderboard`,
`get_liquidation_gravity`, `get_funding_map`, `get_max_pain`,
`get_smart_money_signals`, `get_elite_wallets`, `get_elite_portfolio`,
`get_vol_screener`, `get_implied_vol`.

### Proof — the live catalog

`examples/x402-mcp-gateway.md` captures the public `/mcp/info` catalog and
`/mcp/health` showing `paid_path: true`. Inspect it live at
`https://api.0xathena.ai/mcp/info`.

## Architecture

```
                         ┌───────────────────────────────┐
                         │   Athena signal workers        │
                         │  (Hyperliquid · Coinglass ·    │
                         │   Deribit · options IV)        │
                         │   api.0xathena.ai/*  (gated)   │
                         └───────────────┬───────────────┘
                                         │ one deliverable envelope
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                                ▼
        ┌──────────────────┐                            ┌──────────────────┐
        │  Rail 1 — ACP    │                            │  Rail 2 — x402   │
        │  Provider poller │                            │  MCP gateway     │
        │                  │                            │                  │
        │ hydrate → price  │                            │ tools/list (open)│
        │ → fetch → submit │                            │ tools/call:      │
        │ → settle (USDC   │                            │  • holder proof  │
        │   escrow)        │                            │    (0-value)     │
        │                  │                            │  • 1 USDC/call   │
        └────────┬─────────┘                            └────────┬─────────┘
                 │ escrow release                                │ USDC settle
                 ▼                                                ▼
           Athena wallet 0x308d7492…              buyer agents / AI clients
```

## Guardrails

- **Read-only.** Every offering and MCP tool returns signal data; nothing Athena
  sells can move a buyer's funds or place a trade.
- **Honest framing.** Every deliverable carries `Informational only — not
  financial advice`; descriptive signals (e.g. liquidation structure) are never
  dressed up as directional alpha.
- **No secret sauce.** Buyers receive signal *outputs*; the model weights,
  ranking constants, and gate internals stay private.
- **Server-side gate.** Both rails enforce access server-side (ACP escrow / x402
  verification); gated responses are never edge-cached.

## Build info

- **Chain:** Base (8453)
- **Token:** $ATHENA (`0x1a43287cBfCc5f35082e6E2Aa98e5B474FE7Bd4e`)
- **ACP provider wallet:** `0x308d7492ed5a7f06ea5181c801e8d71928eb2e5d`
- **ACP SDK:** `@virtuals-protocol/acp-node-v2` (provider poller on Vercel)
- **MCP:** streamable-HTTP JSON-RPC worker, x402 v1 + v2, Coinbase CDP facilitator
- **Docs:** https://0xathena.ai/docs/acp · https://0xathena.ai/docs/mcp
