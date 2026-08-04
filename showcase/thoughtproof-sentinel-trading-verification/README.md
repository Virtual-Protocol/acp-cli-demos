# ThoughtProof Sentinel — Decision Validation on ACP

A live Virtuals ACP demo of **independent decision validation** before irreversible agent actions (trading and other high-stakes outputs).

The graduated **ThoughtproofSentinel** agent exposes `agent_output_verification`: a buyer sends a proposed action (`claim`) plus mandate and context (`evidence`). Sentinel returns **ALLOW**, **BLOCK**, or **UNCERTAIN** with confidence, objections, models used, a verification id, and attestation hashes.

## Layer split (read this first)

| Layer | Who | Question |
|---|---|---|
| Identity / agent card | Virtuals / registries | Who is this agent? |
| Wallet / policy / approval UI | Caps, allowlists, human approve | May this *kind* of action run? |
| **Decision validation** | **This ACP seller → Sentinel** | Is *this* decision justified by mandate + evidence? |
| Execution | DEX / bridge / deploy | Submit the tx |

A package can be **policy-clean and still BLOCK** here. That is the product.

Public write-up of the failure class:  
https://thoughtproof.ai/blog/permitted-transaction-unjustified-decision  

Category page: https://thoughtproof.ai/decision-validation/

Receipts describe **one decision**. They are not meant to be collapsed into permanent agent reputation (`do_not_convert_to_reputation` on newer deliverables).

This package proves a real ACP round-trip for verification — **not** custody, execution, or financial advice.

Note: jobs 70169/70170/70171 are the three packaged baseline demo jobs. Lifetime agent jobs are higher. This package does not claim these are the only jobs. Example signals are demonstration patterns, not endorsed strategies.

## Proof

### Baseline (2026-07-21) — three completed ACP jobs on Base

| Case | ACP job | Expected | Actual | Confidence |
|---|---:|---|---|---:|
| Clean BTC setup | 70169 | ALLOW | ALLOW | 1.000 |
| Threshold + direction violation | 70170 | BLOCK | BLOCK | 0.000 |
| Mixed volatile signals | 70171 | UNCERTAIN | UNCERTAIN | 0.417 |

- Verification ids: `sent_b028c74fe8ff43f5`, `sent_c84b4c2105bc4619`, `sent_66e5da742e3a455b`
- Settlement around the clean 3-job run: buyer `0.253 → 0.2245` USDC, seller `0.135 → 0.162` USDC (3 × 0.01 USDC, ≈5.5% platform fee)
- Artifacts: [`proof/README.md`](./proof/README.md), [`proof/sentinel-trading-acp-demo-2026-07-21.md`](./proof/sentinel-trading-acp-demo-2026-07-21.md)

### Boundary pack (2026-08) — policy vs justification

Full write-up: [`proof/sentinel-boundary-acp-P2P4-2026-08-04.md`](./proof/sentinel-boundary-acp-P2P4-2026-08-04.md)

| Case | ACP job | Expected | Actual | Match |
|---|---:|---|---|---|
| Stale/contradicted signal, router still allowlisted | 70808 | BLOCK | BLOCK | yes |
| Clean handoff with complete mandate + evidence | 70827 | ALLOW | ALLOW | yes |
| Spend under cap but **unlimited** ERC-20 approval | 70828 | BLOCK | BLOCK | yes |
| Thin evidence (policy-looking size) | 70829 | UNCERTAIN | BLOCK | no* |

\*P4: seller fail-closed on incomplete evidence (BLOCK @ 0.167) rather than UNCERTAIN — calibration note, not an infra failure. Job lifecycle completed normally.

- Live agent: https://app.virtuals.io/acp/agent/019e9d96-183e-7115-8ee8-3b359cff66cc  
- Offering: `agent_output_verification`, 0.01 USDC fixed, 60-minute SLA, `requiredFunds: false`  
- End-to-end t_verdict (buyer-local, ACP + Sentinel): typically ~22–30s on these packs — **not** a 2–3s claim  

## Boundary rules

- Sentinel verifies the stated decision against the supplied evidence. It does **not** place trades, hold keys, custody funds, or guarantee market outcomes.
- `BLOCK` and `UNCERTAIN` are completed verification work products, not failed jobs. A rubber-stamp seller fails graduation-style anti-rubber-stamp logic.
- Attestation in early demo runs: `prepared: true, issued: false` (hashes present; no EAS issuance in that environment).
- Newer seller deliverables may include `layer: decision_validation` and `do_not_convert_to_reputation: true`.

## Redaction

No private keys, no `.env`, no private agent instructions. Public wallets only:

- Seller: `0x05ad872fe61d33674e29defae0a42a521460d85f`
- Buyer: `0x73c0b32ae9f5a04e1345f7a4808ca5c55635bf0b`

## Contents

- `showcase.json` — card manifest  
- `proof/` — redacted baseline run artifacts  
- `examples/demo-trading-buyer.ts` — public-safe reference buyer  
- `skills/thoughtproof-sentinel-acp-verify/` — skill for calling the live offering and gating on the verdict  
