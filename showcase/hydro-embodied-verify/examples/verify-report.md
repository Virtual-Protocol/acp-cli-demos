# Redacted Verdict Report — Hydro Embodied-Data Verifier

Two clips run through Hydro's live AI quality gate (`supabase/functions/reward`
in the [Hydro repo](https://github.com/hydroboticsdotco/hydrobotics)). Frames
are sampled from each upload and scored by a `gpt-4o-mini` vision model against
the task instructions. Contributor ids, storage paths, and wallet addresses are
redacted; the verdicts are the model's real output shape.

---

## Case 1 — Accepted

- **Task instructions:** "Pick up the cup, pour water into it, and place it back
  on the table."
- **Input:** first-person clip, ~14s, 3 frames sampled.
- **Contribution id:** `contrib_****` (redacted)

**Model verdict**

```json
{
  "approved": true,
  "score": 82,
  "reason": "The hand reaches for the cup, pours water in, and returns it to the table. Full hand-object interaction is visible with stable framing and adequate lighting."
}
```

- **verdict:** `approved` (score 82 >= threshold 55)
- **outcome:** contribution credited in $HYDRO (off-chain balance, claimable at
  token launch).

---

## Case 2 — Rejected

- **Task instructions:** "Fold a shirt completely, from flat to folded."
- **Input:** first-person clip, ~9s, 3 frames sampled.
- **Contribution id:** `contrib_****` (redacted)

**Model verdict**

```json
{
  "approved": false,
  "score": 18,
  "reason": "The shirt is picked up and moved but never folded; the task is not completed within the clip. Motion is also blurry in two of three frames."
}
```

- **verdict:** `rejected` (fails task completion and quality threshold)
- **outcome:** no credit issued.

---

## Case 3 — Needs review

- **Task instructions:** "Plug the cable into the wall socket."
- **Input:** first-person clip, ~6s, frames partially corrupted.
- **Contribution id:** `contrib_****` (redacted)

**Model verdict**

```json
{
  "approved": false,
  "score": 0,
  "reason": "Frames could not be reliably decoded; the socket and cable are not clearly visible. Not enough evidence to confirm task completion."
}
```

- **verdict:** `needs_review` (low confidence / bad input, not a fabricated
  pass) — held for human review.

---

## Notes

- The verdict shape (`{approved, score, reason}`) is exactly what an ACP
  evaluator would consume to accept or reject an embodied-video deliverable and
  settle escrow.
- No secrets, keys, wallet material, or contributor identity appear in any
  verdict output.
