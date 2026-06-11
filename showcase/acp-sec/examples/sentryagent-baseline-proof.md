# Proof of Work — SentryAgent Baseline Scan

This is a **real** ACP-SEC scan, not a mock. We scanned our own reference
contract, **SentryAgent**, deployed and verified on **Base Sepolia**, in
`external` scan mode. External mode uses only public/on-chain data and verified
source — exactly what a counterparty agent would have when it scans you. The
JSON below is the unmodified scanner output a builder sees.

- **Target:** `0x7770ED57E3993d4555951a557cd158a6Fb87A470` (Base Sepolia)
- **Scan mode:** `external` (public data only)
- **Scanner:** `acpsec-v0.5.0`
- **Scanned at:** `2026-06-09T08:28:23Z`
- **Source:** [`scans/baseline-sentryagent-sepolia-2026-06-09.json`](https://github.com/acpsec/acp-sec/blob/main/scans/baseline-sentryagent-sepolia-2026-06-09.json)

## Result

| | |
| --- | --- |
| **Trust Score** | **80 / 100** |
| **Grade** | **B** |
| **Critical** | `false` |
| **Confidence multiplier** | `0.85` |
| **ERC-8004 ID** | none registered |

## Per-dimension subscores

| Dimension | Score | Unrated checks |
| --- | --- | --- |
| Contract Security | 100 | — |
| Authority Scope | 60 | `signer_unrestricted`, `agent_card_no_spend_limit` |
| Identity | 50 | — |
| Hook Security | 100 | — |
| ERC-8183 / ACP Compliance | 70 | `fee_split_nonconformant` |
| Behavioral | 100 | — |

The two Unrated authority-scope checks are *not* passes — they are checks whose
data is not provable from public state in `external` mode (an operator could
resolve them with a `self_audit`). Unrated data lowers the confidence
multiplier rather than scoring as safe.

## Top findings (by severity)

| Severity | Dimension | Detail |
| --- | --- | --- |
| High | Authority Scope | no on-chain spending budget or per-period cap |
| High | Identity | no ERC-8004 identity registered |
| High | Identity | claimed handle unverified |
| High | ACP Compliance | missing ACP v3 lifecycle phase (1 of 1) |
| Medium | Authority Scope | no pause / emergency-stop mechanism |
| Medium | ACP Compliance | settlement not atomic |
| Low | Authority Scope | no key rotation path documented |

## How to read this

Contract Security, Hook Security, and Behavioral all scored 100 — the source is
verified, Slither found nothing material, the hooks are owned correctly, and the
on-chain transfer history is clean. The score is pulled down to 80 by Authority
Scope (no spend caps, no pause), Identity (no ERC-8004 registration, unverified
handle), and an ACP-compliance gap (a missing lifecycle phase, non-atomic
settlement). None of the findings are CRITICAL, so `critical` is `false` and the
contract grades **B** — usable, but a counterparty should note the unbounded
authority and missing identity before delegating real value.
