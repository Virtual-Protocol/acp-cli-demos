#!/usr/bin/env python3
"""Local-only overlay: the CPHY economic attention layer (OP1 weight).

This file is the LOCAL half of the recall overlay seam. recall.retrieve calls
rerank() when this module exists beside it; the published bundles never ship
it (CPHY is local-only by standing directive), so upstream syncs that replace
recall.py can no longer sever the economy — the seam is neutral upstream, the
wiring lives here.

Doctrine (CPHY-DESIGN.md invariants):
  I1  tokens buy salience, never brightness — this reranks recall ORDER only;
      poq.py never touches CPHY weight.
  I2  the multiplier is clamped to [0.25x, 4x] inside WeightMap (log2 +/-2).
Audit: any ring whose rank was moved carries score_parts["cphy"] = multiplier.
"""

from cphy import WeightMap


def rerank(root, scored):
    """Multiply each candidate's ranking score by its CPHY weight, then run
    relevance realization over the ETCHED set (positive scars).

    `scored` is recall.retrieve's list of (score, ring, labels, parts) tuples,
    already sorted best-first. The provisional top-5 serve as bridge anchors:
    a bridge's far side gains its activation bonus when the near side anchors.

    Etch guarantee: among all etched rings in the candidate set, the TOP-N by
    realized relevance (n = etch_recall_n, the load the owner pays for) are
    lifted past both retrieval cuts — the absolute floor and the relative
    half-of-top — so an etched memory is CONSIDERED every turn its subject
    matter is even faintly live. Consideration, not belief: PoQ judges the
    surfaced memory exactly as hard as any other (I1)."""
    wm = WeightMap.load(root)
    if wm is None:
        return scored
    anchors = [r["index"] for _, r, _, _ in scored[:5]]
    out = []
    for s, r, lab, parts in scored:
        m = wm.multiplier(r["index"], anchors)
        if m != 1.0:
            parts = dict(parts)
            parts["cphy"] = round(m, 3)
        out.append((s * m, r, lab, parts))
    out.sort(key=lambda x: x[0], reverse=True)

    etched = getattr(wm, "etched", None) or {}
    if etched and out:
        from cphy import etch_recall_n, ETCH_MAX_ECHELON, ETCH_CEILING
        n = etch_recall_n(root)
        if n > 0:
            top = out[0][0]
            ceiling = ETCH_CEILING * top      # the current turn is NEVER superseded
            floor_clear = max(0.19, 0.51 * top)
            # ECHELON = RECENCY BIAS: depth (1..21 burned tokens) pulls the
            # memory toward just-beneath-the-top — an E=21 memory reads as
            # freshly lived; an E=1 memory barely clears the floor. Blend,
            # rank by blended value, and realize only the top-n (the load
            # the owner pays for). An etch never REDUCES an organic score.
            blended = []
            for i, (s, r, _, _) in enumerate(out):
                e = etched.get(r["index"])
                if e:
                    w = min(ETCH_MAX_ECHELON, e) / ETCH_MAX_ECHELON
                    blended.append((s + w * max(0.0, ceiling - s), i))
            for b, i in sorted(blended, reverse=True)[:n]:
                s, r, lab, parts = out[i]
                lifted = max(s, min(ceiling, max(b, floor_clear)))
                parts = dict(parts)
                parts["etched"] = etched[r["index"]]     # the echelon, auditable
                out[i] = (lifted, r, lab, parts)
            out.sort(key=lambda x: x[0], reverse=True)
    return out
