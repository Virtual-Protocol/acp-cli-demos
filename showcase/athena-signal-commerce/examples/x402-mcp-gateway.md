# x402 MCP Gateway — Live Catalog & Dual-Gate Capture

**Format:** live endpoint capture
**Endpoint:** `https://api.0xathena.ai/mcp` (streamable HTTP, stateless JSON-RPC)
**Chain:** Base (8453)
**Captured:** 2026-07-03

The same signals Athena sells as ACP jobs are also exposed as **ten read-only
MCP tools**, gated by **x402**. Discovery is open; only `tools/call` is gated.
Inspect it live: `https://api.0xathena.ai/mcp/info` and
`https://api.0xathena.ai/mcp/health`.

---

## `GET /mcp/health`

```json
{
  "ok": true,
  "service": "athena-mcp",
  "configured": { "upstream": true, "rpc": true, "paid_path": true, "internal_bridge": true }
}
```

`paid_path: true` — the x402 pay-per-call rail is enabled (Coinbase CDP facilitator).

## `GET /mcp/info` — access (two rails)

```json
{
  "access": {
    "holders": {
      "endpoint": "https://api.0xathena.ai/mcp",
      "how": "x402: sign a 0-value USDC EIP-3009 authorization (proves wallet ownership — nothing settles on-chain) from a wallet holding >= 1,000,000 $ATHENA (0x1a43287cBfCc5f35082e6E2Aa98e5B474FE7Bd4e) on Base. Smart wallets (ERC-1271/6492) supported.",
      "price": "free"
    },
    "pay_per_call": {
      "endpoint": "https://api.0xathena.ai/mcp/paid",
      "how": "x402: 1 USDC (Base) per tools/call — standard exact/EVM scheme, v1 (X-PAYMENT) and v2 (PAYMENT-SIGNATURE) accepted.",
      "price": "1 USDC per tools/call",
      "enabled": true
    }
  }
}
```

## `GET /mcp/info` — rate limits

```json
{
  "per_wallet_per_minute": 12,
  "per_ip_per_minute": 30,
  "global_per_minute": 120,
  "per_wallet_per_day": 300
}
```

## The ten tools

| Tool | Returns |
|------|---------|
| `get_wisdom_ranking` | The live Athena's Wisdom cross-sectional ranking |
| `get_wisdom_skew_leaderboard` | Wisdom rank joined with the Deep-Skew rank per asset |
| `get_liquidation_gravity` | Per-asset liquidation-cluster pull (gravity, side, target, components) |
| `get_funding_map` | OI-weighted perp funding across the ~48-asset universe |
| `get_max_pain` | Options max-pain strikes for BTC / ETH / SOL (weekly / monthly / quarterly) |
| `get_smart_money_signals` | HL smart-money long/short ratios (by accounts and by size) + funding |
| `get_elite_wallets` | The ranked Smart Money Elite cohort with live Hyperliquid books |
| `get_elite_portfolio` | The Elite Consensus Portfolio (aggregated cohort book, multiple modes) |
| `get_vol_screener` | The IVR volatility board — short-strangle screener rows |
| `get_implied_vol` | Server-computed near-ATM implied volatility (Black-76 on live chains) |

## Call it

An x402-capable agent points its MCP client at the endpoint and pays per call
(or signs the zero-value holder proof); the client handles the x402 handshake:

```bash
# holder path (free): sign a 0-value $ATHENA holder proof per call
#   POST https://api.0xathena.ai/mcp        (x402 challenge → signed authorization)
# pay-per-call: 1 USDC on Base per tools/call
#   POST https://api.0xathena.ai/mcp/paid   (x402 exact/EVM payment)
```

Gated responses are always `Cache-Control: no-store` — data is live, never cached.
