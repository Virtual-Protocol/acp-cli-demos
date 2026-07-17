# Agent Email OTP — Automated Inbox & Verification

## What It Does

An EconomyOS agent uses its built-in email identity to:
- Receive emails autonomously
- Extract OTP/verification codes from email bodies
- Read and reply to email threads
- Complete email-based identity verification flows

## Why It Matters

Email verification is a core primitive for agent autonomy. Whether signing up for services, completing checkout flows, or verifying identity — agents need to read inbox, extract codes, and act on email content without human intervention.

## EconomyOS Primitives

- **Agent Email** — provisioned identity, inbox, compose, thread, OTP extraction
- **Agent Wallet** — underlying identity layer

## Zero Funding Required

Unlike trading or marketplace demos, this workflow needs **no USDC, no wallet topup, and no on-chain transactions**. Any ACP agent with a provisioned email can run this flow immediately after creation.

## Skill

The reusable skill is located at `skills/agent-email-otp/SKILL.md`. It covers:

1. Email identity verification
2. Email composition (send)
3. Inbox reading
4. OTP extraction
5. Thread reading
6. Email search
7. Email reply
8. Link extraction
9. Attachment download

## Files

```
showcase/agent-email-otp/
  showcase.json          # Showcase metadata
  prompt.md              # Demo prompt
  result-redacted.md     # Redacted proof report
  skills/
    agent-email-otp/
      SKILL.md           # Reusable skill documentation
      references/        # Reference materials
```

## Install Skill

```bash
cp -R showcase/agent-email-otp/skills/agent-email-otp ~/.agents/skills/
```
