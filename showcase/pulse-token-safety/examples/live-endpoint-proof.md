# Proof of Work — Live Endpoint Behind the ACP Offering

Pulse Token Safety's ACP offerings do not run bespoke ACP-native scan logic.
They proxy **onchainpulse**, a live, publicly deployed HTTP API (x402-metered
for direct callers) that The Aslan Group LLC has operated in production since
2026-06. This file has two parts:

1. The **real, unmodified 402 payment challenge** any unauthenticated caller
   gets right now — reproducible by anyone with the plain `curl` commands
   below, no wallet or account needed.
2. A **real, live scan result** for each endpoint (full deliverable body,
   fetched 2026-07-03), showing the exact JSON shape an ACP buyer receives as
   their job deliverable after paying.

- **Service:** OnchainPulse (`https://onchainpulse-nine.vercel.app`)
- **Endpoints proxied by this ACP agent:** `/api/evmtoken` (Base/EVM tokens),
  `/api/memecoin` (Solana SPL tokens)
- **Payment protocol:** [x402](https://www.x402.org/) — HTTP 402 Payment
  Required, `exact` scheme, accepts either Base USDC or Solana USDC — for
  direct (non-ACP) callers. The ACP job flow settles the equivalent payment
  through ACP's own USDC escrow instead of x402.

## 1. EVM/Base token scan — `/api/evmtoken`

```bash
curl -s "https://onchainpulse-nine.vercel.app/api/evmtoken?address=0x4200000000000000000000000000000000000006&chain=base"
```

Real response (`HTTP 402`, headers omitted, body verbatim):

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "15000",
      "payTo": "0x50ab2018c06c6E4eAA9BA52057Eb55eD284912fc",
      "maxTimeoutSeconds": 300,
      "extra": { "name": "USD Coin", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "amount": "15000",
      "payTo": "985iFjbnGQ3dJcwXnfRCMSrH4Jnc3kW1N6msR64B5KX1",
      "maxTimeoutSeconds": 300,
      "extra": { "feePayer": "Hc3sdEAsCGQcpgfivywog9uwtk8gUBUZgsxdME1EJy88" }
    }
  ],
  "resource": {
    "url": "https://onchainpulse-nine.vercel.app/api/evmtoken",
    "description": "Honeypot, rug & token-safety scanner for Base & EVM tokens — instant pre-trade check: sell-simulation honeypot, buy/sell tax, mint, upgradeable proxy, pausable transfers, blacklist, owner privileges, LP lock/burn, holder concentration, fused with live liquidity & flow into one CLEAR / CAUTION / AVOID verdict. Base, Ethereum, BSC, Arbitrum, Polygon, Optimism, Avalanche. For EVM trading agents.",
    "mimeType": "application/json",
    "serviceName": "OnchainPulse",
    "tags": ["honeypot", "rug-check", "token-safety", "base", "evm", "memecoin", "pre-trade", "sniping"]
  },
  "extensions": {
    "bazaar": {
      "info": {
        "input": {
          "type": "http",
          "method": "GET",
          "queryParams": {
            "address": { "type": "string", "description": "ERC-20 token contract address (0x + 40 hex)", "example": "0x532f27101965dd16442E59d40670FaF5eBB142E4", "required": true },
            "chain": { "type": "string", "description": "EVM chain (default base)", "example": "base", "required": false }
          }
        },
        "output": {
          "type": "json",
          "example": {
            "address": "0x532f27101965dd16442E59d40670FaF5eBB142E4",
            "chain": "base",
            "token": { "name": "Brett", "symbol": "BRETT", "holders": "48213" },
            "verdict": "CLEAR",
            "is_safe": true,
            "risk_score": 4,
            "one_liner": "Clears contract & safety gates",
            "red_flags": [],
            "green_flags": [
              "Verified open-source contract",
              "Supply not mintable",
              "Zero buy/sell tax",
              "Ownership renounced",
              "Sell simulation passed (not a honeypot)"
            ],
            "safety": {
              "is_honeypot": false,
              "sellable": true,
              "buy_tax_pct": 0,
              "sell_tax_pct": 0,
              "open_source": true,
              "proxy_upgradeable": false,
              "mintable": false,
              "ownership_renounced": true,
              "transfer_pausable": false,
              "blacklist_capable": false,
              "lp_locked_or_burned_pct": 98.5,
              "danger_flags": [],
              "source": "goplus+dexscreener"
            }
          }
        }
      }
    }
  }
}
```

## 2. Solana memecoin scan — `/api/memecoin`

```bash
curl -s "https://onchainpulse-nine.vercel.app/api/memecoin?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
```

Real response (`HTTP 402`, body verbatim, `accepts`/pricing block identical in
shape to above — omitted here for brevity, see the endpoint's own
`resource`/`extensions.bazaar.info` block):

```json
{
  "resource": {
    "url": "https://onchainpulse-nine.vercel.app/api/memecoin",
    "description": "Honeypot, rug & token-safety scanner for Solana memecoins — instant pre-trade check of mint/freeze authority, LP lock/burn, holder & dev concentration and insider flags, fused with live liquidity, buy/sell flow and age into one deterministic CLEAR / CAUTION / AVOID verdict for any SPL token. For Solana trading & sniping agents.",
    "serviceName": "OnchainPulse",
    "tags": ["honeypot", "rug-check", "token-safety", "solana", "memecoin", "pre-trade", "spl-token", "sniping"]
  },
  "extensions": {
    "bazaar": {
      "info": {
        "input": {
          "type": "http",
          "method": "GET",
          "queryParams": {
            "mint": { "type": "string", "description": "SPL token mint address (base58)", "example": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "required": true }
          }
        },
        "output": {
          "type": "json",
          "example": {
            "mint": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
            "chain": "solana",
            "verdict": "CAUTION",
            "is_safe": false,
            "risk_score": 22,
            "one_liner": "Passes hard gates but carries risk",
            "red_flags": ["Top-10 wallets hold 46.2%"],
            "green_flags": [
              "Mint authority revoked (supply cannot be inflated)",
              "Freeze authority revoked (your wallet cannot be frozen)"
            ],
            "safety": {
              "mint_authority_revoked": true,
              "freeze_authority_revoked": true,
              "lp_locked_or_burned_pct": 91.2,
              "rugged": false,
              "rugcheck_score": 22
            }
          }
        }
      }
    }
  }
}
```

## 3. Real live scan result — Base token (BRETT)

The paid deliverable shape, captured live on 2026-07-03 (server-side call,
same production endpoint, no data altered):

```json
{
  "address": "0x532f27101965dd16442E59d40670FaF5eBB142E4",
  "chain": "base",
  "token": { "name": "Brett", "symbol": "BRETT", "holders": "902358" },
  "verdict": "CLEAR",
  "is_safe": true,
  "risk_score": 0,
  "one_liner": "Clears contract & safety gates",
  "red_flags": [],
  "green_flags": [
    "Verified open-source contract",
    "Supply not mintable",
    "Owner-gated risks dormant (ownership renounced)",
    "Zero buy/sell tax",
    "Ownership renounced",
    "Sell simulation passed (not a honeypot)"
  ],
  "safety": {
    "is_honeypot": false,
    "sellable": true,
    "buy_tax_pct": 0,
    "sell_tax_pct": 0,
    "open_source": true,
    "proxy_upgradeable": false,
    "mintable": false,
    "ownership_renounced": true,
    "transfer_pausable": false,
    "blacklist_capable": false,
    "lp_locked_or_burned_pct": 0,
    "danger_flags": [],
    "source": "goplus+dexscreener"
  },
  "concentration": { "top_holder_pct": 10.7, "top10_holder_pct": 33.3, "owner_pct": 0, "creator_pct": 0 },
  "momentum": {
    "price_usd": 0.005553,
    "liquidity_usd": 991593.27,
    "market_cap": 55037671,
    "pair_age_hours": 20572.9,
    "vol_h1_usd": 0,
    "read": "$0 1h vol, 20572.9h old"
  },
  "confidence": "high",
  "disclaimer": "On-chain contract facts + observed momentum, not financial advice or a price prediction. Memecoins are extremely high-risk.",
  "sources": { "goplus": true, "dexscreener": true },
  "generated_at": "2026-07-03T18:31:42.953Z"
}
```

## 4. Real live scan result — Solana token (Jupiter, JUP)

Same live capture, 2026-07-03, against the Solana endpoint:

```json
{
  "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "chain": "solana",
  "verdict": "CLEAR",
  "is_safe": true,
  "risk_score": 7,
  "one_liner": "Clears rug & safety gates",
  "red_flags": ["Mutable metadata (warning)"],
  "green_flags": [
    "Mint authority revoked (supply cannot be inflated)",
    "Freeze authority revoked (your wallet cannot be frozen)",
    "Liquidity $121,133,717"
  ],
  "safety": {
    "mint_authority_revoked": true,
    "freeze_authority_revoked": true,
    "lp_locked_or_burned_pct": null,
    "rugged": false,
    "rugcheck_score": 101,
    "danger_risks": [],
    "source": "rugcheck+rpc"
  },
  "concentration": { "top10_holder_pct": 45.8, "creator_pct": 0.02, "insiders_detected": true },
  "momentum": {
    "price_usd": 0.02199,
    "liquidity_usd": 121133717.3,
    "market_cap": 1935434872613,
    "pair_age_hours": 6063.9,
    "vol_h1_usd": 12516822.44,
    "buy_sell_ratio_h1": 1.1,
    "read": "balanced flow (1.1:1 1h), $12,516,822 1h vol, 6063.9h old"
  },
  "confidence": "high",
  "disclaimer": "On-chain facts + observed momentum, not financial advice or a price prediction. Memecoins are extremely high-risk.",
  "sources": { "rugcheck": true, "solana_rpc": true, "dexscreener": true },
  "generated_at": "2026-07-03T18:31:43.634Z"
}
```

Both scans above were fetched moments before this file was written, against
the same production URLs shown in §1–2. `network_referrals` (cross-sell links
to sibling products) were trimmed for brevity; nothing else was edited.

## How this maps to the ACP offering

The ACP Provider agent ("Pulse Token Safety") calls these same two endpoints
server-side when an ACP job is funded, using the ACP escrow payment instead of
x402 — the buyer pays once (in USDC, via the ACP job), the agent fulfills by
calling the identical live endpoint, and returns the identical JSON shape
shown above as the job deliverable. See
[`skills/pulse-token-safety-scan/SKILL.md`](../skills/pulse-token-safety-scan/SKILL.md)
for the reusable pattern.
