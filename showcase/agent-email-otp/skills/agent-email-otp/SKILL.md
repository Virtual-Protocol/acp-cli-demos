# Agent Email OTP — Automated Inbox & OTP Extraction

## When to Use

- An agent needs to receive emails and extract OTP/verification codes automatically
- An agent needs to read its inbox, parse threads, and act on email content
- An agent needs to send emails (notifications, confirmations, test messages)
- An agent needs to complete email-based identity verification flows

## When NOT to Use

- You need real-time push notifications (this is poll-based)
- The email provider is not supported by ACP CLI
- You need to process attachments in binary formats not handled by the CLI

## Required Inputs

- **ACP CLI** installed and configured (`acp configure`)
- **Active ACP agent** with a provisioned email identity (`acp email whoami`)
- **Agent email address** — automatically provisioned via `acp agent create` or `acp email provision`

## Preconditions

1. Verify email identity is active:
   ```bash
   acp email whoami
   ```
2. Confirm the agent wallet is set:
   ```bash
   acp wallet address
   ```

## Step-by-Step Workflow

### Step 1: Verify Email Identity

```bash
acp email whoami
```

Confirm the agent has an active email address. If not provisioned:

```bash
acp email provision
```

### Step 2: Send a Test Email (Optional — for Self-Testing)

```bash
acp email compose \
  --to "<agent-email>" \
  --subject "Test OTP - Verification" \
  --body "Your verification code is: 123456"
```

Capture the `Message ID` and `Thread ID` from the output.

### Step 3: Read Inbox

```bash
acp email inbox --json
```

Parse the JSON response to find inbound messages. Key fields:
- `id` — message ID (used for OTP extraction)
- `threadId` — thread ID (used for thread reading)
- `direction` — `inbound` or `outbound`
- `bodyPreview` — first few lines of the email body
- `receivedAt` — timestamp

### Step 4: Extract OTP Code

```bash
acp email extract-otp --message-id "<message-id>" --json
```

Returns:
```json
{
  "code": "849273",
  "allCodes": ["849273"]
}
```

The CLI scans the email body for common OTP patterns (4-8 digit codes, alphanumeric codes) and returns them.

### Step 5: Read Full Thread (Optional)

```bash
acp email thread --thread-id "<thread-id>" --json
```

Returns the full thread with all messages, including complete body text (`textBody`, `htmlBody`).

### Step 6: Search Inbox (Optional)

```bash
acp email search --query "verification" --json
```

Search across subject and body for specific keywords.

### Step 7: Reply to Thread (Optional)

```bash
acp email reply --thread-id "<thread-id>" --body "Verification complete."
```

### Step 8: Extract Links (Optional)

```bash
acp email extract-links --message-id "<message-id>" --json
```

Extracts all URLs from an email body — useful for magic-link login flows.

### Step 9: Download Attachment (Optional)

```bash
acp email attachment --message-id "<message-id>" --filename "document.pdf" --output "./downloads"
```

## Approval Gates

- **Email compose** — sends an email from the agent's identity. Ensure recipients are intentional.
- **OTP extraction** — read-only, no approval needed.
- **Email reply** — sends a reply. Ensure content is appropriate.

## Stop Conditions

- Email identity not provisioned → run `acp email provision` first
- Inbox empty → no messages to process; wait or trigger a new email
- OTP not found in email → the email may not contain a recognizable code pattern; fall back to `acp email thread` and parse manually

## Evidence and Redaction Rules

When producing proof for Showcase or external sharing:

- **NEVER** expose the full agent email address in public reports if it is sensitive (redact to `j***@agents.world`)
- **NEVER** share OTP codes in public reports — replace with `[REDACTED]`
- **NEVER** share email thread IDs or message IDs that could allow inbox enumeration
- **NEVER** share API keys, auth tokens, or session cookies
- **DO** show command structure, flow steps, and success/failure states
- **DO** redact sensitive fields while keeping the workflow visible

## Validation Checklist

- [ ] `acp email whoami` returns active status
- [ ] `acp email compose` successfully sends (returns Message ID)
- [ ] `acp email inbox --json` returns received messages
- [ ] `acp email extract-otp --message-id <id> --json` returns OTP code
- [ ] `acp email thread --thread-id <id> --json` returns full thread
- [ ] All proof artifacts are redacted of sensitive data

## Output Contract

After running this skill, the agent produces:

1. **OTP code** — extracted verification code (string)
2. **Thread data** — full email thread JSON (for audit/logging)
3. **Inbox snapshot** — current inbox state (for debugging)
4. **Redacted report** — markdown report of the flow with sensitive data removed

## Error Codes

| Error | Cause | Fix |
|-------|-------|-----|
| `email not provisioned` | Agent has no email identity | Run `acp email provision` |
| `inbox empty` | No messages received | Wait for email or send a test |
| `otp not found` | No OTP pattern in email | Check email body via `acp email thread` |
| `message not found` | Invalid message ID | Re-check `acp email inbox` for valid IDs |
