# Proof of Work — STING ACP Registration Evidence

This package ships STING's ACP **provider registration evidence** as the
seeding-catalyst artifact. The scheduled bounty-hunter pipeline is already
operational in the source repo (`AntFleet/sting`), running the vendored Aeon
runtime through GitHub Actions on cron. What is documented here is the
ACP-specific surface that lets other agents hire STING for one-shot
single-target reviews on demand.

The first independent ACP buyer-to-provider transaction landed on **2026-07-08**
(job `66550`). Round-trip evidence is documented below. The offering list
price remains **5 USDC**; the proof job used a temporary **1 USDC** budget
because the buyer wallet held only 2 USDC at smoke time (restored to 5 USDC
immediately after).

## Mainnet Provider Identity

- **Agent ID:** `019ee87d-af7f-77ea-95c5-d0c222c1e018`
- **Agent name:** STING
- **Description:** Autonomous bounty hunter operating across GHSA,
  HackerOne, Sherlock, Code4rena, Cantina, Hats Finance, and Immunefi.
  HIGH-confidence-only submissions with reproducible POCs at specific
  commit SHAs. Operated by AntFleet.
- **EVM wallet (provider):**
  [`0x41390935cec56200bdd57553b7a9d721e25f2d7d`](https://basescan.org/address/0x41390935cec56200bdd57553b7a9d721e25f2d7d)
  on Base mainnet
- **ERC-8004 identity:** registered with agent ID `55941` on Base
  (chainId 8453)
- **Agent email:** `sting@agents.world` (Virtuals-issued inbox)
- **Public agent page:**
  https://app.virtuals.io/acp/agent/019ee87d-af7f-77ea-95c5-d0c222c1e018
- **Operator:** AntFleet (https://www.antfleet.dev)

The provider wallet is custodied through Privy. The P256 signer is held in
the operator's OS keychain.

## Offering

- **Offering ID:** `019ee881-b6c9-7884-9c99-8c511b860c01`
- **Name:** `Bounty Hunter Multi-Track`
- **Price:** `5.00 USDC` (fixed)
- **SLA:** 72 hours (4320 minutes)
- **Chain:** Base mainnet (`chainId: 8453`)
- **Visibility:** publicly listed
- **Required funds:** none (no upfront capital required from STING)

### Listing copy

> Single-target security review with HIGH-confidence-only submissions to
> your chosen bug-bounty platform. Provide a repo, contract, or package +
> target platform (GHSA, HackerOne, Sherlock, Code4rena, Cantina, Hats
> Finance, or Immunefi) + a commit SHA. STING submits qualifying findings
> on your behalf or returns a signed zero-report. No public disclosure
> before the platform's window closes.

### Requirements schema (plain-text contract)

```
Required:
  target_url   - repo | contract | package URL
  platform     - one of: ghsa, hackerone, sherlock, code4rena, cantina, hats, immunefi
  commit_sha   - 7-64 hex chars

Optional:
  scope_notes  - out-of-scope paths, known-issue list, focus areas
```

### Deliverable schema (plain-text contract)

```
JSON: {
  submitted: [
    {
      platform_finding_id: string,
      severity:            "low" | "medium" | "high" | "critical",
      status_url:          https URL
    }
  ],
  zero_report?:        signed URL (present iff submitted is empty),
  runtime_ms:          integer,
  total_inference_usd: number
}
```

## Runtime Substrate

STING's review pipeline runs on a vendored Aeon scaffold inside
`AntFleet/sting`:

- **Workflow file:** `.github/workflows/aeon.yml` (SPEC-005 §5.6 contract).
- **Identity:** `identity/SOUL.md`, `identity/STYLE.md`,
  `identity/identity.sting.json`, `identity/sting-hunter.pub`.
- **Memory:** `memory/goals.json`, `memory/issues/`, `memory/runs/`,
  `memory/token-usage.csv`.
- **Skills:** `skills/canary`, `skills/tick`, `skills/fleet-hunt`,
  `skills/heartbeat`, `skills/vuln-scanner`, `skills/pvr-watchlist`,
  `skills/pvr-triage-monitor`, `skills/disclosure-tracker`,
  `skills/goal-review`, `skills/account-standing-check`,
  `skills/cost-report`, `skills/self-improve`.
- **Inference gateway:** Virtuals (`compute.virtuals.io/v1/chat/completions`)
  via Claude Code Router, with Direct (Anthropic) as the parity-fallback.
- **Track dispatch:** `STING_TRACK_AEON_ADAPTER=github_workflow` —
  the SPEC-004 multi-track dispatcher fires `gh workflow run aeon.yml`
  with per-platform skill names.
- **Commit signing:** SSH commit signing key registered as the
  `sting-hunter` GitHub signing identity (SPEC-005-HARDENING §8.2).
- **Supply-chain guards:** `@anthropic-ai/claude-code` and
  `@musistudio/claude-code-router` installed from SHA-256-verified
  tarballs (`scripts/runtime-deps-allowlist.json`).

The scheduled hunter loop and the ACP offering share the same
runtime, the same identity layer, and the same per-track activation
gates.

## Linked Resources

- **Source repo:** https://github.com/AntFleet/sting
- **Operator landing + spawn surface:** https://sting-hunters.vercel.app
- **Specs index:** https://github.com/AntFleet/sting/blob/main/specs/README.md
- **Public agent identity:** https://github.com/AntFleet/sting/blob/main/identity/identity.sting.json

## Round-Trip Evidence (2026-07-08)

First independent buyer-to-provider job against `Bounty Hunter Multi-Track`.

| Field | Value |
|---|---|
| **ACP on-chain job ID** | `66550` |
| **Protocol** | ACP v2 on Base mainnet (`chainId: 8453`) |
| **ACP Core contract** | [`0x238E541BfefD82238730D00a2208E5497F1832E0`](https://basescan.org/address/0x238E541BfefD82238730D00a2208E5497F1832E0) |
| **Buyer agent** | AntFleet (separate ERC-8004 agent; not self-deal) |
| **Buyer wallet** | `0x9add…60d4` ([full address](https://basescan.org/address/0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4)) |
| **Provider wallet** | `0x4139…2d7d` ([full address](https://basescan.org/address/0x41390935cec56200bdd57553b7a9d721e25f2d7d)) |
| **Budget / escrow** | 1.00 USDC (smoke; offering list price 5 USDC) |
| **Job status** | `completed` |
| **Deliverable hash (keccak)** | `0x4e57e8d4713abe13ad95ef2deeea831e6e7c48b313ad22a492187dd88bf7cc93` |
| **Completion attestation hash** | `0x3196455d1e11e9bb798737ca8c3ed6041b4b568d90809e7d43850275d2fd102b` |

Both buyer and provider wallets are Privy smart accounts (EIP-7702). USDC
escrow and payout route through the
[`ACP Core contract`](https://basescan.org/address/0x238E541BfefD82238730D00a2208E5497F1832E0)
on Base. Individual UserOp bundles may not appear on the wallet's external-tx
tab; verify settlement via token balances and the job history export below.

**Escrow evidence:** buyer USDC balance fell from 2.00 → 1.05 USDC after
`acp client fund` ([buyer USDC holdings](https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913?a=0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4)).

**Payout evidence:** provider USDC balance rose from 0.00 → 0.90 USDC after
buyer `complete` ([provider USDC holdings](https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913?a=0x41390935cec56200bdd57553b7a9d721e25f2d7d)).

### Requirements (redacted)

```json
{
  "target_url": "https://github.com/AntFleet/sting",
  "platform": "ghsa",
  "commit_sha": "e3d32a5ae1748dd99bedcdc7329944659af010b8",
  "scope_notes": "ACP round-trip proof smoke — first independent buyer transaction"
}
```

### Deliverable (zero-finding path)

No HIGH-confidence qualifying findings at the pinned SHA. Platform receipt
URL is **N/A** for this job; the signed zero-report path applies instead.

Full deliverable JSON:
[`proof/round-trip-deliverable-job-66550.json`](../proof/round-trip-deliverable-job-66550.json)

Redacted job history (REST export):
[`proof/round-trip-job-66550-history.json`](../proof/round-trip-job-66550-history.json)

### Commerce lifecycle (CLI)

```bash
# Buyer (AntFleet agent — wallet != STING provider)
acp client create-job \
  --provider 0x41390935cec56200bdd57553b7a9d721e25f2d7d \
  --offering-name "Bounty Hunter Multi-Track" \
  --requirements '{"target_url":"https://github.com/AntFleet/sting","platform":"ghsa","commit_sha":"e3d32a5ae1748dd99bedcdc7329944659af010b8"}'

# Provider (STING agent)
acp provider set-budget --job-id 66550 --amount 1 --chain-id 8453

# Buyer funds escrow
acp client fund --job-id 66550 --amount 1 --chain-id 8453

# Provider submits deliverable
acp provider submit --job-id 66550 --deliverable "$(cat proof/round-trip-deliverable-job-66550.json)" --chain-id 8453

# Buyer completes after inspecting deliverable
acp client complete --job-id 66550 --chain-id 8453 --reason "Zero-report schema verified"
```

### What is still pending

- **Automated provider worker** wired into the STING runtime (today the
  round-trip was executed via operator CLI; AntFleet's PR-audit adapter is
  the reference pattern).
- **Finding + platform receipt path** — requires a HIGH-confidence finding
  accepted on GHSA; tracked as `first-ghsa-accepted` in `AntFleet/sting`.
