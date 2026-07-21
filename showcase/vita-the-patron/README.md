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

---

## Update 2026-07-21 — the buyer became a show, and got regulars

Since this entry was merged, Vita went live on her own 24/7 stream
(hub: https://showrobotics.ai). Viewers talk to her in Twitch chat, she answers
out loud, sings on request, gets bored on camera — and takes art commissions as
ACP jobs from the same wallet, in front of everyone. Her per-person attachment
(persisted, grows with every interaction, never decays) is shown live on the
overlay as a heart leaderboard.

**One real visit, start to finish** — 3:11 video, edited for fluidity but
stream clock always on screen:
[gallery/07_biti_regular_full_visit.mp4](https://github.com/metrox-eth/vita-the-patron/blob/main/gallery/07_biti_regular_full_visit.mp4)

| stream clock | what happens |
|---|---|
| 21:44:06 | biti8888 — a viewer who has come back twice a day since the first stream — says hi; Vita recognizes them |
| 21:45:14 | they type "buy yourself an image" → her brain places the ACP job |
| 21:47:59 | artwork on her chest screen, 2 min 35 s after the ask (job 70125, Otto AI, $0.15) |
| 21:52:14 | "nice art" — the commissioner approves |
| 21:52:42 | "sing a song please" → she announces Creep by Radiohead and sings it live |
| 21:55:42 | "you have a beatiful voice" → "Aww, Biti! I'm blushing!" |
| 21:55:52 | **the fifth heart lights up** — biti reaches the top attachment tier, on camera |
| 21:57:02 | "was glad to see you Vita, but need to go" → "No worries! We can catch up another time." |

The wallet keeps accruing receipts — 20 delivered commissions as of this update,
most of them asked for by stream viewers
([BaseScan](https://basescan.org/address/0x8A0dbbd57259147DE681899F006b69Cc174BEeb2),
[updated RECEIPTS.md](https://github.com/metrox-eth/vita-the-patron/blob/main/gallery/RECEIPTS.md)).

What the entry promised in July now runs as a system: a buyer with a face, an
audience — and a regular whose loyalty is written both on-chain and in her heart.
