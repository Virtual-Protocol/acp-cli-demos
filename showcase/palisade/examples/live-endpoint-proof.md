# Live Endpoint Proof

All responses below are **real, reproducible** calls against the public PaliSade
MCP API at `https://mcp.palisadescan.com`. No API key, no account, no payment —
every call is keyless and read-only. Captured 2026-07-29.

Reproduce any call by pasting the `curl` block into a terminal.

---

## 1. Service health

```bash
curl -s https://mcp.palisadescan.com/health
```

```json
{"status":"ok","service":"palisade-mcp","tools":18}
```

---

## 2. Tool inventory (18 read-only tools)

```bash
curl -s https://mcp.palisadescan.com/tools/list \
  | python3 -c "import sys,json;t=json.load(sys.stdin)['result']['tools'];print(len(t));[print(x['name']) for x in t]"
```

```
18
palisade_scan_approvals
palisade_scan_token
palisade_detect_honeypot
palisade_safety_score
palisade_wallet_report
palisade_monitor_wallet
palisade_token_market
palisade_deployer_check
palisade_batch_scan
palisade_check_scam
palisade_sentinel_status
palisade_consensus
palisade_liquidity_lock
palisade_simulate_approval
palisade_detect_clone
palisade_check_tax
palisade_check_ownership
palisade_holder_concentration
```

---

## 3. Safety score — WETH (known-good blue-chip)

```bash
curl -s -X POST https://mcp.palisadescan.com/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"palisade_safety_score",
                 "arguments":{"contract":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","chain":"ethereum"}}}'
```

```json
{
  "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "chain": "ethereum",
  "score": 92,
  "risk_level": "safe",
  "breakdown": [
    {"category": "Verified Registry", "score": 92, "note": "Wrapped Ether (WETH) — Canonical WETH"}
  ],
  "risk_factors": [],
  "positive_factors": ["Listed in PALISADE verified registry as Wrapped Ether"],
  "recommendation": "Score: 92/100 — Wrapped Ether is a known, verified contract. Risk level: safe."
}
```

---

## 4. Honeypot probe — WETH

```bash
curl -s -X POST https://mcp.palisadescan.com/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"palisade_detect_honeypot",
                 "arguments":{"contract":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","chain":"ethereum"}}}'
```

```json
{
  "token": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "chain": "ethereum",
  "token_name": "Wrapped Ether",
  "token_symbol": "WETH",
  "is_honeypot": false,
  "can_buy": true,
  "can_sell": true,
  "buy_tax": 0.0,
  "sell_tax": 0.0,
  "block_reason": null,
  "simulations": [
    {"action": "known_contract_lookup", "success": true, "gas_used": null,
     "error": "Wrapped Ether (WETH) is a verified blue-chip contract"}
  ],
  "high_tax_warning": false
}
```

---

## 5. Six-source consensus — WETH

The consensus tool weighs six independent signals. Risk only escalates when
multiple sources concur — a built-in false-positive guard. Note the
`liquidity_lock` source returns `unknown` (not `safe`) when a lock cannot be
determined.

```bash
curl -s -X POST https://mcp.palisadescan.com/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"palisade_consensus",
                 "arguments":{"contract":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","chain":"ethereum"}}}'
```

```json
{
  "token": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "chain": "ethereum",
  "verdict": "safe",
  "confidence": 1.0,
  "risk_sources": 0,
  "safe_sources": 5,
  "unknown_sources": 1,
  "total_sources": 6,
  "votes": [
    {"source": "goplus",         "vote": "safe",    "weight": 1.0, "reasons": ["no honeypot/tax flags"]},
    {"source": "onchain_score",  "vote": "safe",    "weight": 0.8, "reasons": ["score 92/100 (safe)"]},
    {"source": "market",         "vote": "safe",    "weight": 0.6, "reasons": ["liquidity risk: low"]},
    {"source": "deployer",       "vote": "safe",    "weight": 0.5, "reasons": ["verified registry contract"]},
    {"source": "scam_db",        "vote": "safe",    "weight": 0.4, "reasons": ["no community reports"]},
    {"source": "liquidity_lock", "vote": "unknown", "weight": 0.0, "reasons": ["lock undetermined"]}
  ],
  "summary": "5/5 sources agree: no risk signals detected."
}
```

---

## What this proves

- The public API is **live** and answers real tool calls over HTTPS with no key.
- Scans return **structured, inspectable verdicts** — not opaque scores.
- The design is **conservative**: an undetermined liquidity lock votes `unknown`
  and contributes zero weight rather than inflating a `safe` verdict.
- All 18 tools are registered and reachable (`/tools/list`).
