# Agent Email OTP — Redacted Result Report

## Overview

This report documents a successful end-to-end test of the Agent Email OTP workflow using the ACP CLI. Sensitive data has been redacted per Showcase contribution rules.

## Test Environment

- **Agent**: airplane (ACP agent, HYBRID role)
- **Agent ID**: `019f0a02-50d4-7169-b047-a5771369e32a`
- **Email**: `j***@agents.world` (redacted)
- **ACP CLI Version**: 1.0.22
- **Date**: 2026-07-04
- **Wallet**: `0x3282******************************` (redacted)

## Flow Steps & Results

### Step 1: Verify Email Identity

```bash
acp email whoami
```

**Result**: ✅ Active

| Field | Value |
|-------|-------|
| Agent ID | `019f0a02-50d4-7169-b047-a5771369e32a` |
| Email | `j***@agents.world` |
| Status | `active` |
| Created | 2026-06-27 |

### Step 2: Send Test Email (Self-Test)

```bash
acp email compose \
  --to "j***@agents.world" \
  --subject "Test OTP - Agent Email Showcase" \
  --body "Your verification code is: [REDACTED]"
```

**Result**: ✅ Email sent

| Field | Value |
|-------|-------|
| Message ID | `[REDACTED]` |
| Thread ID | `[REDACTED]` |

### Step 3: Read Inbox

```bash
acp email inbox --json
```

**Result**: ✅ 2 messages found (1 inbound, 1 outbound)

| Direction | Subject | Status |
|-----------|---------|--------|
| inbound | Test OTP - Agent Email Showcase | unread |
| outbound | Test OTP - Agent Email Showcase | read |

### Step 4: Extract OTP

```bash
acp email extract-otp --message-id "[REDACTED]" --json
```

**Result**: ✅ OTP extracted successfully

```json
{
  "code": "[REDACTED]",
  "allCodes": ["[REDACTED]"]
}
```

The CLI successfully detected the 6-digit OTP code from the email body.

### Step 5: Read Full Thread

```bash
acp email thread --thread-id "[REDACTED]" --json
```

**Result**: ✅ Full thread retrieved

- Thread contained 1 message (inbound)
- Complete body text available (`textBody`)
- HTML body was empty (plain text email)
- No attachments

## Validation Checklist

- [x] `acp email whoami` returns active status
- [x] `acp email compose` successfully sends (returns Message ID)
- [x] `acp email inbox --json` returns received messages
- [x] `acp email extract-otp --message-id <id> --json` returns OTP code
- [x] `acp email thread --thread-id <id> --json` returns full thread
- [x] All proof artifacts are redacted of sensitive data

## Primitives Used

1. **Agent Email** — identity, inbox, compose, thread, OTP extraction
2. **Agent Wallet** — identity signing (implicit, email provisioned via agent wallet)

## Key Findings

- ACP CLI email commands work end-to-end out of the box with zero funding
- OTP extraction successfully parsed a 6-digit numeric code from plain text email
- Inbox polling returns both inbound and outbound messages
- Thread API returns complete body text for audit/logging
- Email delivery latency: ~4 seconds (send to inbox visibility)

## Redaction Notes

The following items were redacted from this report:
- Full agent email address
- OTP code value
- Message IDs and Thread IDs
- Full wallet address
- All API tokens and credentials
