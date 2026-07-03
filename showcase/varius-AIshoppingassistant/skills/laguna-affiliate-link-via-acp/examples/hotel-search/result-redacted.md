# Result Report — Hotel Search (Redacted)

**Skill:** laguna-affiliate-link-via-acp  
**Example:** Hotel search via Telegram  
**Date:** 2026-06-[REDACTED]  
**Status:** Completed ✅

---

## Prompt

> User: "I need a hotel in Penang this weekend, something nice near the beach"

---

## Execution trace

### 1. Intent extraction (Agent Compute — Kimi K2)

Input: user message  
Output:
```json
{
  "intent": "hotel_search",
  "location": "Penang",
  "timeframe": "this weekend",
  "preference": "beach",
  "purchase_ready": false
}
```
Latency: ~1.1 s

### 2. Merchant recommendations generated

3 hotel options surfaced (names redacted to property category only):
- Beach resort, 4-star, Batu Ferringhi
- Beachfront international chain, 5-star
- Boutique hotel, city centre (included for contrast)

### 3. User signals purchase intent

> User: "I like option 1, let's go with it"

Intent re-evaluated: `purchase_ready: true`

### 4. ACP v2 job created (mint_link)

```
Job ID:          [REDACTED]
Provider:        0x1a2b...9f0e (ACPLagunaTranslator)
Offering:        mint_link
Budget:          0.01 USDC
Network:         Base Mainnet
Job created at:  [REDACTED TIMESTAMP]
Job funded at:   [REDACTED TIMESTAMP]
```

### 5. Laguna MCP — search_merchants

Query: `{ query: "beach resort Penang", geo: "MY" }`  
Result: matched merchants — Trip.com (5% cashback), Agoda (4.5% cashback)  
Both selected for parallel minting.

### 6. Laguna MCP — mint_link (×2, parallel)

```
Merchant A: Trip.com
  Shortlink: [REDACTED — contains user tracking token]
  Cashback rate: 5%
  Cookie duration: 30 days

Merchant B: Agoda
  Shortlink: [REDACTED — contains user tracking token]
  Cashback rate: 4.5%
  Cookie duration: 7 days
```

### 7. ACP jobs completed

```
Job A (Trip.com):  submitted → completed
Job B (Agoda):     submitted → completed
Total latency:     ~38 s (from user intent signal to both links delivered)
```

0.01 USDC per job released to provider. User wallet [REDACTED] registered for cashback on both links.

### 8. Dashboard check (/dashboard)

```
Pending:           0.42 USDC
Available:         1.85 USDC
Total conversions: 7
```

---

## Redaction notes

- Affiliate shortlink URLs redacted (contain user wallet tracking token)
- User wallet address truncated
- Job IDs redacted
- Timestamps generalised
- No API keys, auth headers, or private session data included
