---
name: palisade-security-scan
description: Scan a token or wallet for onchain security risk using the live PaliSade MCP API on Robinhood Chain (and Ethereum, Polygon, Arbitrum, Solana). Use before signing an approval, swapping, or investing. Keyless, read-only — no signing, no custody.
tags: [crypto, security, robinhood, defi, rugpull, honeypot, mcp]
version: 1
visibility: public
metadata:
  emoji: "\U0001F441\uFE0F"
  homepage: https://palisadescan.com
  api: https://mcp.palisadescan.com
  source: https://github.com/palisadescan/palisade
  network: robinhood
  chainId: 4663
  requires:
    bins: [curl, python3]
---

# PaliSade Security Scan

## When to use this skill

Use it when a user (or an agent acting for a user) wants to evaluate a token or
wallet **before** taking an onchain action — trading, swapping, signing an
approval, or investing. Typical triggers: "is this token safe?", "check this
contract for a rugpull", "should I approve this spender?", "scan my wallet's
approvals".

## When NOT to use this skill

- Do **not** use it to sign, send, approve, or revoke anything — this skill is
  read-only and has no write path. If the user wants to *execute* a revoke or
  trade, hand off to a wallet tool; PaliSade only *reports*.
- Do not use it as a price oracle or trading-signal generator. It reports
  security risk, not financial advice.
- Do not treat an `unknown` result as `safe`.

## Inputs, tools, credentials, preconditions

- **Input:** one target address — a wallet (`0x…`) or token contract (`0x…`).
- **Optional:** `chain` — one of `robinhood` (default), `ethereum`, `polygon`,
  `arbitrum`, `solana`.
- **Credentials:** none. The API is keyless and free.
- **Preconditions:** `curl` and `python3` available; outbound HTTPS to
  `https://mcp.palisadescan.com`.

## Approval gates

None. This skill performs no spending, posting, account creation, deployment, or
production mutation. It only issues read-only HTTP POSTs to the public scan API.
If a downstream workflow wants to act on a verdict (revoke, sell, approve), that
action belongs to a separate tool and requires its own explicit user approval.

## Steps

### 1. Validate the target (strict allowlist)

Reject anything that is not exactly `0x` + 40 hex characters before any network
call. This blocks quotes, spaces, and shell/JSON metacharacters, so the value is
safe to interpolate into the payloads below.

```bash
TARGET="$1"
if ! printf '%s' "$TARGET" | grep -qiE '^0x[0-9a-f]{40}$'; then
  echo "PALISADE_INVALID_TARGET: not a valid 0x address"
  exit 0
fi
TARGET="$(printf '%s' "$TARGET" | tr '[:upper:]' '[:lower:]')"
CHAIN="${2:-robinhood}"
API="https://mcp.palisadescan.com"
```

### 2. Safety score

```bash
curl -m 30 -s "$API/tools/call" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":1,"method":"tools/call",
  "params":{"name":"palisade_safety_score",
            "arguments":{"contract":"'"$TARGET"'","chain":"'"$CHAIN"'"}}}' \
  | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin).get('result',{}),indent=2))"
```

### 3. Honeypot probe

```bash
curl -m 45 -s "$API/tools/call" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":2,"method":"tools/call",
  "params":{"name":"palisade_detect_honeypot",
            "arguments":{"contract":"'"$TARGET"'","chain":"'"$CHAIN"'"}}}' \
  | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin).get('result',{}),indent=2))"
```

### 4. Six-source consensus (recommended for a final verdict)

```bash
curl -m 60 -s "$API/tools/call" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":3,"method":"tools/call",
  "params":{"name":"palisade_consensus",
            "arguments":{"contract":"'"$TARGET"'","chain":"'"$CHAIN"'"}}}' \
  | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin).get('result',{}),indent=2))"
```

For a wallet target, call `palisade_scan_approvals` with `{"wallet": "$TARGET"}`
instead of the contract tools above.

## Stop conditions and handoff

- Stop and report `PALISADE_INVALID_TARGET` if validation fails.
- Stop after reporting the verdict — do not attempt any onchain action.
- If the user asks to act on the result (revoke, swap, approve), hand off to a
  wallet/signing tool and require explicit user approval there.
- On a network or API error, report the failure and the partial results
  gathered; do not fabricate a verdict.

## Validation checks

- Confirm the API is reachable: `curl -s "$API/health"` returns
  `{"status":"ok","service":"palisade-mcp",...}`.
- Each tool response is JSON with a `result` object; if `result` is missing,
  treat the call as failed.
- Never coerce a missing or `unknown` field into `safe`.

## Output contract

Report, per scan target:

- **Verdict** — the consensus `verdict` (`safe` / `caution` / `high` /
  `critical`) and its `confidence`, or the safety `risk_level` when consensus is
  not run.
- **Score** — the 0-100 `safety_score` when available.
- **Evidence** — the per-source votes/reasons and any `risk_factors`, verbatim
  from the API. Surface `unknown` sources explicitly as unknown.
- **Recommendation** — the API's `recommendation` string when present.

Do not add findings the API did not return.
