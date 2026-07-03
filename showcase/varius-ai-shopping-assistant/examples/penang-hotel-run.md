# Example Run: Penang Hotel Search

**Date:** 2026-07-02  
**Bot:** @virtualshoppingbot (Telegram)  
**Outcome:** 2 affiliate links minted, 2 ACP jobs completed on Base Mainnet

---

## User session

```
User:   i want to go to penang this weekend, find me hotels

Varius: Here are some options for Penang this weekend:

        1. Hard Rock Hotel Penang — Batu Ferringhi beachfront,
           music-themed resort with multiple pools - ~$150/night
        2. [Hotel B] — sea view, family-friendly - ~$90/night
        3. [Hotel C] — boutique, city centre - ~$80/night

        → We recommend booking via Trip.com (5% rebate) 🏨
          — affiliate link coming shortly ⏳

        [~38 seconds later]

        Here are your booking links:
        🔗 Trip.com · 5% rebate → https://agents.laguna.network/r/[REDACTED]
        🔗 Agoda · 6% rebate   → https://agents.laguna.network/r/[REDACTED]

        Both links earn you cashback. Click either to book!

User:   /dashboard

Varius: Your Laguna Cashback Dashboard
        Pending:           0.42 USDC
        Available:         1.85 USDC
        Total conversions: 7
```

---

## ACP job trace (redacted)

| Field | Job A (Trip.com) | Job B (Agoda) |
|---|---|---|
| Job ID | [REDACTED] | [REDACTED] |
| Provider | ACPLagunaTranslator | ACPLagunaTranslator |
| Offering | mint_link | mint_link |
| Budget | 0.01 USDC | 0.01 USDC |
| Network | Base Mainnet | Base Mainnet |
| Status | completed | completed |
| Latency | ~35s | ~38s |
| Deliverable | affiliate shortlink | affiliate shortlink |

Both jobs ran in parallel. Total wall-clock time from user intent signal to both links delivered: ~38 seconds.

---

## Compute trace

- Model: `kimi-k2-instruct` via Virtuals Agent Compute (`os.virtuals.io`)
- Calls: intent extraction × 2 (initial query + purchase intent signal), recommendation generation × 1
- Total compute spend: ~$0.002
