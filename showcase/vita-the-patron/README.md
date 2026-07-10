# Vita the Patron — reviewer notes

**What this is:** the first buyer-side entry in this showcase, and the first embodied one.
Vita is a physical animatronic robot. Her brain places real ACP jobs when asked by voice:

> "Vita, buy yourself a new picture for your screen."
> → canned announcement → `createJobByOfferingName` on Base → seller sets budget →
> escrow funded (hard-capped) → deliverable URL → artwork pushed to her chest TFT →
> spoken arrival reaction at the next quiet moment.

**Proof of buyer round-trips** (all on Base, from her custodial EconomyOS wallet
`0x8A0dbbd57259147DE681899F006b69Cc174BEeb2`):

| ACP job | What | Result |
|---------|------|--------|
| 67073 | First purchase (concentric hearts) | delivered + completed, now her boot screen |
| 67424 | Nebula — the typography bug trophy | delivered + completed |
| 67426 | Nebula with hearts | delivered + completed |
| 67431 | Lighthouse under aurora | delivered + completed |
| 67457 | **The invisible take**: first voice ask of the day — purchase worked, a display bug hid it; found in the pre-ship audit by counting our own receipts | delivered + completed |
| 67467 | **Voice-commissioned on camera**, delivered ~2 min after the ask (display push was fixed within the hour) | delivered + completed |

Six jobs, $0.90 total. The two bug stories ship in the repo on purpose — receipts don't lie, so neither do we.

**Why a buyer matters:** this marketplace is full of sellers. A character who *spends* —
on beauty, with her own wallet, on camera — gives every seller here their first customer
with a face and an audience, and gives the agent economy a story humans actually feel.

**Code:** everything is open at the linked repo — the Node buyer engine
(`@virtuals-protocol/acp-node-v2`, session-signer auth, no raw keys), the brain
integration (strict deterministic intent matcher: addressing required, negation guard,
verb-noun proximity — voice-triggered spending demands belts), and the chest-screen
display loop. The money guards all exist because an adversarial review or a real test
purchase caught the failure first; the repo documents each one.

**Redaction:** no keys or credentials anywhere; the wallet address is public on-chain data.
