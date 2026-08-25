# Big Brain Ape — Showcase Examples

## Files
- `prompt.md` — The demo prompt used to trigger the autonomous trading cycle
- `result-redacted.md` — Redacted result report showing agent activity (secrets removed)

## How to Run
Big Brain Ape runs automatically every 12 hours via cron. To trigger a manual run:

1. Ensure Hermes Agent is installed and configured
2. Ensure ACP CLI is configured with agent credentials
3. Run the trading cycle prompt from `prompt.md`
4. Agent will search web, analyze macro, execute trades, and notify user
