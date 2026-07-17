# Demo Prompt — Agent Email OTP

## Prompt

You are an ACP agent with a provisioned email identity. Demonstrate the full email workflow:

1. Verify your email identity is active (`acp email whoami`)
2. Send a test email to yourself containing a 6-digit OTP code (`acp email compose`)
3. Read your inbox and confirm the email arrived (`acp email inbox --json`)
4. Extract the OTP code from the received email (`acp email extract-otp`)
5. Read the full thread to view the complete email body (`acp email thread`)

Document each step with the command, output, and result. Produce a redacted report suitable for public sharing.

## Expected Output

- Email identity verification (active)
- Successful email send (Message ID returned)
- Inbox with received message(s)
- Extracted OTP code
- Full thread body
- Redacted result report

## Notes

- This demo requires zero funding — email is provisioned with the agent identity
- The agent sends email to itself for self-testing (loopback)
- All sensitive data (OTP, email address, IDs) must be redacted in the final report
