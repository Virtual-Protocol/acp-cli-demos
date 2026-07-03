# Demo Prompt — Hotel Search

This is the natural-language prompt used by the end user to trigger the skill.

---

**Channel:** Telegram (@virtualshoppingbot)

**User message:**
> I need a hotel in Penang this weekend, something nice near the beach

**Follow-up (purchase intent signal):**
> I like option 1, let's go with it

---

## What the agent does

1. Extracts intent: `hotel_search`, location `Penang`, preference `beach`
2. Returns 3 recommendations via Agent Compute (Kimi K2)
3. Detects `purchase_ready: true` on the follow-up
4. Fires parallel ACP v2 jobs for Trip.com and Agoda affiliate link minting
5. Delivers both tracked shortlinks to the user in Telegram
6. User can check `/dashboard` to see pending USDC cashback
