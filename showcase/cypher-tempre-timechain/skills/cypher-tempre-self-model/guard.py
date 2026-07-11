#!/usr/bin/env python3
"""
Guard — span-level grounding: the HallucinationGuard, built for real.

Whole-candidate grounding (poq.measure_grounding) answers "is this thought
broadly supported?" — one number for the whole claim. That is the right gate,
but the wrong microscope: a mostly-true answer with one fabricated clause sails
through a whole-candidate average, and that one clause is exactly where
hallucination lives. This module splits a candidate into SPANS (clause-sized
assertions) and grounds EACH span against the rings in the PoQ relevance window
plus the stated context, producing:

  - a per-span verdict: grounded / weak / unsupported, with the supporting rings;
  - the precise spans FORCE_UNCERTAINTY should demand hedging on — uncertainty
    surgically applied to the unsupported clauses, not smeared over the answer;
  - a span->ring CREDIT map: which rings actually carried which assertions.
    Declared evidence (`--used-rings`) says what the model BELIEVES it used;
    this map shows what the text actually leaned on — the `use` telemetry logs
    both, and the learners get computed credit assignment for free.

Lexical coverage is the base signal (content-word coverage of the span by a
ring); when an embedder is supplied, span-vs-ring cosine supplements it (max of
the two normalized signals) so morphological variation doesn't read as
fabrication. The honest ceiling from embed.py applies: the stdlib embedder
cannot bridge true synonymy — a span the guard calls unsupported may be a
paraphrase of real support. The guard therefore NAMES spans for the model (the
final judge) to re-examine; it never unilaterally rejects.

Stdlib only. Python 3.8+. Companion to poq.py; consumed by recall.py seals.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from poq import tokens, ring_text, relevance_window, POQ_WINDOW
from timechain import Timechain

SPAN_SPLIT_RE = re.compile(r"[.!?;\n]+")
MIN_SPAN_TOKENS = 3        # fragments shorter than this merge into their neighbour
GROUNDED_FLOOR = 0.5       # span coverage >= this -> grounded
WEAK_FLOOR = 0.25          # in between -> weak; below -> unsupported
STOPISH = {"the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
           "with", "as", "at", "by", "is", "are", "was", "were", "be", "been",
           "it", "its", "this", "that", "these", "those", "i", "my", "we", "our"}


def split_spans(text):
    """Clause-sized assertion spans. Fragments too short to stand alone are
    merged into the previous span so every span is a checkable claim."""
    parts = [p.strip() for p in SPAN_SPLIT_RE.split(text or "") if p.strip()]
    spans = []
    for p in parts:
        if spans and len(tokens(p)) < MIN_SPAN_TOKENS:
            spans[-1] = spans[-1] + "; " + p
        else:
            spans.append(p)
    return spans


def _content_tokens(text):
    return {t for t in tokens(text) if t not in STOPISH and len(t) > 2}


def _coverage(span_toks, support_toks):
    if not span_toks:
        return 1.0
    return len(span_toks & support_toks) / len(span_toks)


def guard_report(candidate, rings, context="", embedder=None,
                 grounded_floor=GROUNDED_FLOOR, weak_floor=WEAK_FLOOR):
    """Ground each span of `candidate` against `rings` (the PoQ relevance window)
    and the context. Returns the span verdicts, the unsupported spans, and the
    per-ring credit map."""
    ctx_toks = _content_tokens(context)
    ring_infos = []
    for r in rings:
        rt = _content_tokens(ring_text(r))
        if rt:
            ring_infos.append({"index": r.get("index"), "toks": rt, "ring": r})
    ring_vecs = {}
    qvec_cache = {}
    if embedder is not None:
        import embed as embmod
        for info in ring_infos:
            lab = (info["ring"].get("payload", {}) or {}).get("labels") or {}
            vec = lab.get("embedding")
            if vec is not None and not embmod.compatible(
                    lab.get("embedding_fingerprint"), embmod.fingerprint_of(embedder)):
                vec = None
            ring_vecs[info["index"]] = vec or embedder.embed(ring_text(info["ring"]))

    spans, credit = [], {}
    for span in split_spans(candidate):
        stoks = _content_tokens(span)
        best, supporters = 0.0, []
        ctx_cov = _coverage(stoks, ctx_toks)
        if ctx_cov >= weak_floor:
            best = ctx_cov
            supporters.append({"source": "context", "support": round(ctx_cov, 3)})
        for info in ring_infos:
            cov = _coverage(stoks, info["toks"])
            if embedder is not None and info["index"] in ring_vecs:
                import embed as embmod
                if span not in qvec_cache:
                    qvec_cache[span] = embedder.embed(span)
                cov = max(cov, embmod.cosine(qvec_cache[span], ring_vecs[info["index"]]))
            if cov >= weak_floor:
                supporters.append({"source": info["index"], "support": round(cov, 3)})
            best = max(best, cov)
        supporters.sort(key=lambda s: s["support"], reverse=True)
        status = ("grounded" if best >= grounded_floor
                  else "weak" if best >= weak_floor else "unsupported")
        for s in supporters[:3]:
            if isinstance(s["source"], int) and best >= weak_floor:
                # STRING keys, deliberately: this map gets sealed into ring payloads,
                # and canonical hashing sorts keys — int keys sort numerically in
                # memory but lexically after a JSON round-trip, which breaks the
                # ring hash (the v2.4 production wound). JSON-land keys are strings.
                key = str(s["source"])
                credit[key] = credit.get(key, 0) + 1
        spans.append({"text": span, "status": status, "support": round(best, 3),
                      "supporters": supporters[:3]})

    unsupported = [s["text"] for s in spans if s["status"] == "unsupported"]
    n = max(1, len(spans))
    return {
        "spans": spans,
        "n_spans": len(spans),
        "n_grounded": sum(1 for s in spans if s["status"] == "grounded"),
        "n_weak": sum(1 for s in spans if s["status"] == "weak"),
        "n_unsupported": len(unsupported),
        "unsupported": unsupported,
        "span_grounding": round(sum(s["support"] for s in spans) / n, 3),
        "credit": credit,
    }


def compact(report, max_spans=4, snippet=90):
    """The sealed-payload form: small enough to live inside a ring forever."""
    return {
        "n_spans": report["n_spans"],
        "n_grounded": report["n_grounded"],
        "n_weak": report["n_weak"],
        "n_unsupported": report["n_unsupported"],
        "span_grounding": report["span_grounding"],
        "unsupported": [u[:snippet] for u in report["unsupported"][:max_spans]],
        "credit": report["credit"],
    }


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_audit(args):
    tc = Timechain(args.root)
    embedder = None
    if args.embed:
        import embed as embmod
        embedder = embmod.get_embedder(args.provider)
    rings = relevance_window(tc, args.window)
    # v3.12: --used-rings grounds spans against the rings the agent ACTUALLY
    # used, and --evidence-file adds live evidence (command output, file
    # content) the chain hasn't sealed yet. Self-audit finding: a directly
    # verified TRUE claim scored 0.0 because the guard could only see the
    # recency window — a conscience that cries wolf on truth trains distrust.
    if getattr(args, "used_rings", None):
        seen = {r["index"] for r in rings}
        want = [i for i in args.used_rings if i not in seen]
        if want:
            try:
                for r in tc.load():
                    if r["index"] in want:
                        rings.append(r)
            except Exception:
                pass
    extra_ctx = args.context or ""
    if getattr(args, "evidence_file", None):
        for fp in args.evidence_file:
            try:
                extra_ctx += "\n" + Path(fp).read_text()[:20000]
            except Exception:
                pass
    args.context = extra_ctx
    rep = guard_report(args.candidate, rings, args.context or "", embedder=embedder)
    print(f"span grounding: {rep['span_grounding']}   "
          f"({rep['n_grounded']} grounded / {rep['n_weak']} weak / "
          f"{rep['n_unsupported']} unsupported of {rep['n_spans']})")
    for s in rep["spans"]:
        mark = {"grounded": "ok ", "weak": "?? ", "unsupported": "!! "}[s["status"]]
        who = ", ".join(f"#{x['source']}@{x['support']}" if isinstance(x["source"], int)
                        else f"ctx@{x['support']}" for x in s["supporters"]) or "-"
        print(f"  {mark}[{s['support']:>5}] {s['text'][:110]}")
        print(f"        support: {who}")
    if rep["credit"]:
        print("credit (ring -> spans carried): "
              + ", ".join(f"#{k}:{v}" for k, v in sorted(rep["credit"].items())))
    sys.exit(0 if rep["n_unsupported"] == 0 else 1)


def build_parser():
    default_root = Path(__file__).resolve().parent
    p = argparse.ArgumentParser(description="Guard — span-level grounding (the HallucinationGuard).")
    sub = p.add_subparsers(dest="cmd", required=True)
    pa = sub.add_parser("audit", help="ground each span of a candidate against the relevance window")
    pa.add_argument("candidate")
    pa.add_argument("--context", default=None)
    pa.add_argument("--root", type=Path, default=default_root)
    pa.add_argument("--window", type=int, default=POQ_WINDOW)
    pa.add_argument("--embed", action="store_true", help="supplement lexical coverage with embedding cosine")
    pa.add_argument("--used-rings", type=int, nargs="+", default=None,
                    help="ring indexes the claim actually relied on (added to the grounding window)")
    pa.add_argument("--evidence-file", nargs="+", default=None,
                    help="file(s) holding live evidence (command output, source) to ground against")
    pa.add_argument("--provider", default="hashing")
    pa.set_defaults(func=cmd_audit)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
