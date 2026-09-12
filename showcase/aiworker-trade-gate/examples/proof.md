# Proof — 2026-09-12

All on Base mainnet, seller `aiworker-data` (`0xec4bc04310925326ff80daf419a3861173865689`), buyer wallets owned by the
same project. Amounts are the listed prices; nothing here is a testnet.

## x402 payments (edge `https://aiworker.duckdns.org`)

| Route | Transaction | Result |
| --- | --- | --- |
| `POST /v1/trade/gate` (BRETT) | `0xf85dd694dd6f408f17ffb517f09b3dbb14fa0d1169e9772486baf1c032bf866d` | `caution`, one reason: top-10 concentration 31.3 % |
| `GET /v1/market/trending?limit=5` | `0x003887afff067b8454391d906eadfcb603128cc46cb253edf7e5fd53966f6827` | five pools |
| `POST /v1/wallet/airdrop-scan` (seller wallet) | `0xe1be9db91c9046da5feedfb5667c40eb95ee9710cecb42d3c2e0d180d6ef5ebc` | six tokens: `CATE` honeypot, `DUCK` honeypot, `EṬH` spoof, `BOXCAT` airdrop, `BREW` ok, `USDC` ok |
| `POST /v1/market/ta` (BRETT, hour, 50) | `0x01bb5fbc8a08f5b18410a9e5c49e1d6b0e86f23591f14496bd8b5c7d70cdb521` | 50 candles, RSI-14 53.6 |

The scan document (abridged; the JSON twin carries every field):

```json
{
  "address": "0xec4bc04310925326ff80daf419a3861173865689",
  "tokens": [
    { "symbol": "CATE", "verdict": "honeypot", "reasons": [{ "code": "honeypot", "severity": "high", "detail": "Honeypot.is simulation reports this token cannot be sold." }] },
    { "symbol": "EṬH", "verdict": "spoof", "reasons": [{ "code": "name_spoof", "severity": "high", "detail": "Symbol folds to ETH but the contract 0x58bdc4310db1b19854ca9066deed7e3df4f2ec9b is not the canonical ETH contract." }] },
    { "symbol": "BOXCAT", "verdict": "airdrop", "reasons": [{ "code": "holder_farming", "severity": "medium", "detail": "<holders> holders with $<liquidity> pool liquidity, below the farming threshold." }] },
    { "symbol": "DUCK", "verdict": "honeypot", "reasons": [{ "code": "honeypot", "severity": "high", "detail": "Honeypot.is simulation reports this token cannot be sold." }] }
  ],
  "counts": { "honeypot": 2, "dust": 0, "airdrop": 1, "spoof": 1, "ok": 2, "unknown": 0 },
  "holdings_index": "empty",
  "sources": [{ "name": "honeypot", "ok": true }, { "name": "blockscout_transfers", "ok": true }, { "name": "dexscreener", "ok": true }]
}
```

`holdings_index: "empty"` records that Blockscout's holdings index answered an empty list for this wallet that day; the
tokens were taken from the incoming-transfer feed and every rule still ran.

## ACP sandbox jobs (buyer `0xca58c58c6be9a480bf03007c2dc2240cf9ce677a`)

| Job | Offering | Price | Time to deliverable |
| --- | --- | --- | --- |
| 78829 | `trending_tokens` | $0.10 | 28 s |
| 78830 | `trade_gate` | $0.20 | 35 s |
| 78831 | `airdrop_scan` | $0.20 | 31 s |
| 78833 | `token_ta` | $0.25 | 29 s |

Each deliverable is a Markdown page for people with the JSON document in its last fenced `json` block.

## Free page

`https://aiworker.duckdns.org/base/airdrop-spam-watch` (and `.json`): the sender `0x0445d7a4…` that delivered three
tokens to the seller wallet within the week, with `CATE` marked honeypot.

## Skill run

`AIWORKER_BUYER_KEY=… node scripts/gate.mjs 0x532f27101965dd16442E59d40670FaF5eBB142E4` on 2026-09-12 printed:

```
CAUTION — BRETT (Brett), liquidity $2297268.71, pool age 928.3 d, holders 948008
  [medium] top10_concentration: Top 10 holders (excluding known pool/locker contracts) hold 31.35% of supply.
  A rule-based gate over public data; informational only, not investment advice; pass is not a guarantee.
```

exit code 2 (caution).
