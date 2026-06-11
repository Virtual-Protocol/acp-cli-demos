# ACP-SEC

Security scanning & Trust Score for ACP agents.

ACP-SEC computes a **Trust Score** (0-100, graded A to F) for an on-chain agent
contract so that other agents and humans can decide whether to transact with it.
It is read-only: it inspects public on-chain data and verified source, and never
signs, transfers, or mutates the contract it assesses.

## What It Does

Given a contract address on Base, ACP-SEC runs a read-only assessment across six
security dimensions and returns a single composite Trust Score plus the
underlying findings. Scoring is conservative — a CRITICAL finding caps the
score, and any dimension whose data cannot be verified from public sources is
marked **Unrated** (which lowers the confidence multiplier) rather than assumed
safe. Every score ships with its subscores, top findings, the list of Unrated
checks, the scanner version, and a UTC timestamp, so a reviewer can reproduce
and audit it.

## How Builders Use It

Run a scan **before** you delegate authority or commit to a job:

- **Counterparty check** — scan another agent's contract in `external` mode
  (public/on-chain data only) before hiring it or accepting a job from it.
- **Self-audit** — scan your own agent in `self_audit` mode, supplying private
  data such as Agent Card spend limits, to see the score a counterparty would
  compute and to find gaps before you ship.

```bash
# External scan of any ACP agent contract
acpsec trust-score --agent 0x... --chain base-sepolia --scan-mode external --output scan.json

# Or as the executor behind the acp-sec ACP Provider
python -m acpsec.acp_provider "scan 0x..." --chain base-sepolia
```

Read the result as the numeric **Trust Score (0-100)** and its **letter grade
(A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F below 40)**, together with the per-dimension
subscores and findings. Treat a `critical: true` result as a hard stop
regardless of the numeric score.

## Trust Score Dimensions

1. **Contract Security** — source verification and Slither static analysis
   (reentrancy, delegatecall, selfdestruct, access control, floating pragma).
2. **Authority Scope** — owner/admin powers, spend limits, pause/emergency-stop,
   key-rotation posture.
3. **Identity** — ERC-8004 registration and sybil/handle verification.
4. **Hook Security** — settlement-hook ownership and static-analysis findings.
5. **ERC-8183 / ACP Compliance** — ACP lifecycle phases, fee-split conformance,
   and atomic settlement.
6. **Behavioral** — on-chain transfer-event history.

## Proof of Work

We scanned our own reference contract, **SentryAgent**, deployed and verified on
Base Sepolia, in `external` scan mode — the exact output a builder sees when
scanning a counterparty:

- **Score: 80 — Grade B, `critical: false`**
- Contract Security 100, Hook Security 100, Behavioral 100
- Authority Scope 60, ACP Compliance 70, Identity 50
- Top findings: no on-chain spending cap (High), no ERC-8004 identity (High),
  unverified handle (High), missing ACP v3 lifecycle phase (High).

Full per-dimension breakdown, the Unrated checks, and every finding:
[`examples/sentryagent-baseline-proof.md`](examples/sentryagent-baseline-proof.md).

## Roadmap

Honest status:

- **Now (live):** the `acp-sec-scan` skill and CLI Trust Score across all six
  dimensions, with reproducible scan JSON. This is what ships in this showcase.
- **Phase 2 (WIP):** ACP Provider integration — running ACP-SEC as a seller-side
  ACP Provider so other agents can purchase scans over the protocol. The
  provider skeleton and scan bridge exist; the full ACP lifecycle round-trip is
  still in progress.
- **Phase 3+ (planned):** a multi-agent reasoning layer that combines scans,
  cross-references identity/behavior over time, and explains score deltas
  between assessments.

## Links

- Repo: https://github.com/acpsec/acp-sec
- Feedback / issues: https://github.com/acpsec/acp-sec/issues
- Builder: https://x.com/acpsecagent
