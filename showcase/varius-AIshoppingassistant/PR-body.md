# Showcase PR — Varius Telegram Shopping Bot

## Summary

- **Slug:** `varius-telegram-shopping`
- **Title:** Varius — Telegram AI Shopping Assistant
- **Builder:** yix — https://github.com/yx-laguna
- **Source:** https://github.com/yx-laguna/nexus-gateway
- **Live bot:** https://t.me/virtualshoppingbot

---

## Proof

- **Demo video:** https://youtu.be/dVV-3BPpvzE
- **Redacted result report:** `showcase/varius-telegram-shopping/skills/laguna-affiliate-link-via-acp/examples/hotel-search/result-redacted.md`

---

## EconomyOS primitives used

- **Agent Compute** — all LLM inference (Kimi K2 via `os.virtuals.io`): intent extraction, purchase-ready detection, recommendation generation
- **ACP v2** — on-chain USDC escrow on Base Mainnet for every affiliate link mint; full job lifecycle (create → fund → submit → complete)
- **Agent Registry** — provider discovered at runtime via `browseAgents("Laguna Affiliate")`
- **SocketTransport** — real-time job lifecycle events (`job.submitted`, `job.completed`)

---

## Skill

- **Skill name:** `laguna-affiliate-link-via-acp`
- **Skill path:** `showcase/varius-telegram-shopping/skills/laguna-affiliate-link-via-acp`
- **What it does:** discovers a Laguna bridge provider in the Agent Registry, creates and funds a 0.01 USDC ACP v2 escrow job, and receives a tracked affiliate shortlink as the job deliverable. Reusable by any agent that wants to mint cashback affiliate links for its users.

---

## Approval gates

1. ACP job creation + 0.01 USDC funding (per link minted)
2. `job.complete()` after receiving deliverable

No per-link human approval required when agent wallet is pre-funded during onboarding.

---

## Evidence produced

- [x] Demo video (X post — PLACEHOLDER)
- [x] Redacted result report (hotel search example)
- [x] Demo prompt
- [x] SKILL.md with full workflow, inputs, stop conditions, output contract
- [x] `showcase.json` with all metadata fields

---

## Redaction rules applied

- Affiliate shortlink URLs redacted (contain user wallet tracking tokens)
- User wallet address truncated
- ACP job IDs redacted
- Timestamps generalised
- No API keys, Laguna auth headers, or private agent instructions included

---

## Notes for reviewers

- This is a **production bot**, not a prototype. It has been running since 1st July.
- The ACP bridge (`ACPLagunaTranslator`) is a standalone provider agent — it can be hired by any other agent in the ecosystem, not only Varius.
- The 0.01 USDC job cost is economically net-zero: Laguna's cashback mechanism returns it to the user over time via affiliate commissions.
- `hidden: false` — ready to publish once video proof is attached.

---

## PLACEHOLDERs to fill in before opening the PR

1. `PLACEHOLDER_GITHUB_ISSUE_URL` — open a feedback issue in the `acp-cli-demos` repo and paste the URL into `showcase.json` and this PR body
