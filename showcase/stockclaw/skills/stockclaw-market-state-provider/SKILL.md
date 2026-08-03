---
name: stockclaw-market-state-provider
description: Project-specific operational skill for running the StockClaw ACP provider — a poller that prices and fulfills market-state-report jobs (Entry Score + 5-desk read + live model reference) from a fixed six-asset catalog, sourced from an existing analysis endpoint rather than computed fresh. Use when standing up an ACP Provider for a data/report product you already have a REST endpoint for.
---

# StockClaw Market State Provider

## Overview

This skill drives an ACP **Provider** that sells `stockclaw.market-state/v1`
reports (Entry Score, indicator-family summary, five desk notes, live model
reference) for six offerings (`btc`/`eth`/`sol`/`avax`/`xrp`/`doge`
`_market_state_report`), each priced at a flat $0.50 in USDC on Base. The
provider does not compute anything itself — it calls the same backing
endpoint (`/api/v2/market-state`) that the free public terminal renders, and
reshapes the response into the protocol envelope. This generalizes to any
project that already has a working analysis/report endpoint and wants to
sell its output per job.

## When To Use

- You have a **working** report/data endpoint and want to sell its output
  as an ACP job, without duplicating the computation.
- The report is naturally parameterized by a small fixed set (here: asset
  symbol), and you want one offering per parameter value rather than one
  offering with a free-form input.
- You want the provider unattended (poll → price → fetch → submit → settle)
  rather than a human approving each job by hand.

## Prerequisites

- `@virtuals-protocol/acp-cli` installed locally (not globally — a global
  install can collide with an older `acp` binary already on the machine).
- An authenticated agent with an **unrestricted** signer policy. A
  `restricted`/`ACP_ONLY` policy requires a dashboard approval for every
  single CLI call, including read-only ones — unworkable for a poller.
- `TS_KEYRING_BACKEND=file` set on every `acp` invocation if the native
  D-Bus Secret Service keyring is unavailable (headless boxes, containers).
- Six offerings created via `acp offering create` / `acp offering update`,
  each with a `requirements` JSON schema that **requires and `const`-pins a
  `symbol` field** per offering (see "Design: self-describing jobs" below).
- A backing endpoint the sidecar can call to build the deliverable.

## Design: self-describing jobs

Neither `acp job list --all --json` nor `acp job history --job-id X --json`
exposes which **offering** a job was created from — that name only appears
in the buyer's own `create-job` response, which the provider never sees.
If a provider sells more than one asset/variant, the requirement message is
the *only* provider-visible signal for which one a job is for. Fix this at
the schema level, not in code: make every offering's `requirements` schema
require a `symbol` field pinned with `const` to that offering's asset —

```json
{
  "type": "object",
  "required": ["symbol"],
  "properties": {
    "symbol": { "type": "string", "const": "BTC", "description": "Fixed for this offering — always BTC." },
    "timeframe": { "type": "string", "enum": ["1h", "4h", "1d"], "default": "4h" }
  }
}
```

Then the deliverable builder trusts `requirement.symbol`, not the offering
name, treating the offering name (when available) as a cross-check only,
never the asset source of truth.

## Setup

### 1. Local CLI, not global

```bash
npm install --save-dev @virtuals-protocol/acp-cli
# always invoke via: npx acp <command>
```

### 2. Force the working keychain backend

```bash
export TS_KEYRING_BACKEND=file   # on every acp invocation, incl. from the poller process
```

### 3. Upgrade the signer to unrestricted

`acp agent set-signer-policy --policy unrestricted` does not accept that flag
directly — it only opens a dashboard URL for a live-signer policy change,
which may not render anything actionable. Register a **new** signer with the
desired policy instead, which is a flow that reliably works:

```bash
acp agent add-signer --policy unrestricted
# approve in the dashboard, then confirm:
acp agent signer-status --json   # expect {"status":"completed",...}
```

### 4. Run the poller as a persistent service

A one-shot foreground process is not a live provider. Run it as a systemd
user service so it survives terminal exits and restarts on crash:

```ini
[Unit]
Description=<project> ACP provider orchestrator
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/path/to/provider
ExecStart=/usr/bin/env npx tsx src/orchestrator.ts
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now <service-name>
loginctl enable-linger $USER   # survive logout, not just reboot
```

## Verification

```bash
# Confirm the provider identity resolves and matches the expected wallet
acp agent whoami --json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['name'],d['walletAddress'])"

# Confirm the service is up
systemctl --user is-active <service-name>

# End-to-end: create a real small job as a second (buyer) agent/config dir,
# fund it, and watch the poller's own log — not manual CLI calls — set the
# budget and submit the deliverable. Then complete the job as buyer and
# re-read the provider's on-chain USDC balance directly (not via CLI output)
# to confirm settlement.
```

## Teardown

```bash
systemctl --user stop <service-name>
systemctl --user disable <service-name>
```

## Pitfalls

- **Active-agent state is a shared, mutable pointer.** If you also run
  manual `acp` commands under a different `ACP_CONFIG_DIR` (e.g. a buyer
  test config) while the provider poller is live, a write race in the file
  keychain backend can leave the *wrong* agent active for the provider's
  next poll — not just at process start, but mid-run. Re-pin the active
  agent explicitly (`acp agent use --agent-id <id>`) at the top of **every**
  poll cycle, and hard-fail if `whoami`'s returned wallet doesn't match the
  expected one, rather than trusting whatever is currently active.
- **Field names differ between `job list` and `job history`.** `job list`
  returns `onChainJobId` / `jobStatus` (values like `"OPEN"`, uppercase);
  `job history` returns `status` (lowercase) and has no per-job offering
  name anywhere. Compare status case-insensitively and never assume the two
  commands share a schema.
- **Detached background processes die with their wrapping shell.** Starting
  the poller with a shell `&` inside a command that is *also* passed to a
  tool's own "run in background" flag leaves the real process a child of a
  shell that exits — it dies silently. Use exactly one backgrounding
  mechanism (systemd, or the tool's native backgrounding), never both.
- **`pkill -f <pattern>` can match its own invoking shell.** If the pattern
  is broad enough to appear in the current shell's own command line, `pkill`
  kills the shell that ran it. Prefer an exact PID from `pgrep`, then `kill`
  that PID.
- **A restricted/`ACP_ONLY` signer policy blocks automation entirely**, not
  just fund-moving calls — even `job list` requires a fresh dashboard
  approval on every call. There is no custom-policy escape hatch for this;
  the fix is an unrestricted signer, not a smarter retry loop.
