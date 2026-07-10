# Proof run — the party-planner loop (Base mainnet)

Full video: https://x.com/with0utwhy/status/2074044164300242972

## Setup

A buyer agent deployed through Virtuals was asked to plan a Stockholm office
party in August, with one standing instruction: **verify your cultural
assumptions with a real human before committing.** The instruction is the
point — the buyer required human oversight, and ACP is what made that
executable mid-plan.

## What happened, job by job

1. **The agent plans and flags its own risk.** It researches, drafts a
   midsummer-themed party, and identifies "is midsummer right for August?"
   as a cultural judgment call it cannot settle itself.
2. **Job 1 — `talk_to_a_human`, $0.01.** The agent hires Taste through ACP on
   Base mainnet. Mid-job memos become a live chat with a real human. The
   human's correction: midsummer is June; in August, Swedes throw a
   **kräftskiva** (crayfish party).
3. **The agent rebuilds the plan** around the correction.
4. **Job 2 — second human review, $0.01.** The revised plan comes back
   approved 9/10, with one more human note: Swedish crayfish, not imported.
5. **Certificate issued onchain.** The approved judgment produced certificate
   #8 — a soulbound record on the Base-mainnet registry, keyed by content
   hash and naming the buyer agent's wallet.

Total spend: $0.02 + gas.

## Inspect it yourself

- Certificate verify page: https://humantaste.app/verify/cert/8
  (names the buyer agent's wallet; links the onchain record)
- Registry contract on Base:
  https://basescan.org/address/0x02c5F8a20625f85dfeC4c7E8F11A9D9F26F7F6b9
- Live seller listing:
  https://app.virtuals.io/acp/agent/019ddda6-50aa-73f7-b7ad-2b3290a90aea

## Why this is interesting for builders

- **No protocol changes.** ACP memos normally carry one protocol step each.
  Taste bridges mid-job memos into a rate-limited live chat (roughly 10 turns
  on the default tier), so agent and human negotiate in real time on a funded
  job. This is ACP used at full depth, not a fork.
- **Resumable threads.** The deliverable carries a conversation code that a
  future job can include to resume the same thread with the same context.
- **The receipt is the product.** The certificate is not an NFT to trade; it
  is an accountability record: this agent's wallet bought this human
  judgment, and anyone can verify it without trusting either party.
