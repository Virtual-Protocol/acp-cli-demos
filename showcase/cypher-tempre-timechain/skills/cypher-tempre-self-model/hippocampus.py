#!/usr/bin/env python3
"""
Hippocampus — a persistent, rebuildable recall INDEX over the Timechain.

Memory-index theory, made literal. The hippocampus does not STORE memories; it
holds a sparse INDEX that points at the full cortical traces and enables fast
pattern-completion recall. Here the Timechain is the cortical store (the single
source of truth) and this module is the sparse index over it.

It exists for ONE job the chain cannot do itself: turn O(n) recall over millions
of rings into a SUB-LINEAR candidate shortlist. It NEVER decides relevance — it
hands a small candidate set to recall.py, where the model (relevance realization)
and the multi-faculty scorer still judge, and dissonance still gates appetite. So
every benefit of timechain recall is preserved; only the "scan ALL rings" step is
replaced by "scan the candidates."

PROPERTIES (so it adds no trust surface and loses none of recall's benefits):
  - DERIVED, never canonical. Built entirely from each ring's OWN sealed labels
    (keywords, entities, embedding) — or freshly extracted content when a ring was
    sealed without labels. If lost or corrupted, `build` regenerates it from the
    chain; `timechain verify` is unaffected; it is not a second source of truth.
  - REBUILDABLE + INCREMENTAL. `build` scans once; `update` ingests only rings
    appended since the last indexed byte — O(new), not O(n) — so staying current is
    cheap. The chain is append-only, so byte offsets of existing rings never move.
  - LOCAL + STDLIB. An inverted token index (term -> ring ids) for sub-linear
    lexical candidates, plus a stdlib sign-random-projection LSH over any sealed
    embeddings for approximate semantic candidates. No vector DB, no network, no
    off-machine embedding — the local-first privacy posture is preserved.
  - SUBORDINATE. Returns CANDIDATE ids ONLY. recall.py ranks them with its existing
    faculty / salience / recency scorer and the model makes the final call.

Stdlib only. Python 3.8+. Companion to timechain.py, recall.py, embed.py.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import sys
from collections import Counter
from pathlib import Path

from timechain import Timechain, atomic_write_json
import embed as embmod

WORD_RE = re.compile(r"[a-z0-9']+")

# ---- v3.15 stem + synonym folding ------------------------------------------
# The stdlib tier cannot bridge synonymy, but it CAN fold morphology and the
# skill's own domain vocabulary. Folding happens at BOTH index and query time,
# so 'verifying integrity' hits rings that say 'verify' or 'tamper'. This
# raises the REPLAY hit rate without any ML dependency — and the full chain
# stays indexed verbatim (folding only ADDS canonical forms, it never drops).
_SUFFIXES = ("ations", "ation", "ising", "izing", "ingly", "ities", "ments",
             "ness", "ment", "ions", "ing", "ers", "ies", "ily", "ed", "es",
             "er", "ly", "s")


def _stem(w):
    """Light suffix-stripper (Porter-flavoured, deliberately conservative):
    only strips when the stem stays >= 4 chars, so short roots stay intact."""
    for suf in _SUFFIXES:
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: len(w) - len(suf)]
    return w


# Domain synonym table: each group folds to its first member (the canon).
_SYN_GROUPS = [
    ("verify", "verification", "integrity", "tamper", "tampering", "audit"),
    ("faculty", "modality", "sense", "faculties", "modalities", "senses"),
    ("seal", "sealed", "sealing", "ring", "rings"),
    ("recall", "retrieve", "retrieval", "remember", "memory"),
    ("conjecture", "speculation", "hypothesis"),
    ("chain", "timechain", "ledger"),
    ("error", "bug", "crash", "failure", "broken"),
    ("fix", "repair", "patch", "fixed"),
    ("grow", "growth", "grown", "sprout", "cambium"),
    ("gate", "poq", "conscience", "brightness"),
]
_SYN = {}
for _grp in _SYN_GROUPS:
    for _w in _grp:
        _SYN[_w] = _grp[0]


def fold(w):
    """Canonical form of a term: synonym-fold first (exact), then stem, then
    synonym-fold the stem (so 'verifying'->'verify'->canon)."""
    w = w.lower()
    if w in _SYN:
        return _SYN[w]
    s = _stem(w)
    return _SYN.get(s, s)


def _toks(text):
    return [w for w in WORD_RE.findall((text or "").lower()) if len(w) > 1]


def _atomic_write(path: Path, obj):
    atomic_write_json(path, obj, compact=True)


def _block_text(ring):
    """Distinctive content only (mirrors recall.block_text) so rolling task
    boilerplate (objective/findings/labels/state) does not pollute the terms."""
    payload = {k: v for k, v in ring.get("payload", {}).items()
               if k not in ("labels", "state", "poq_verdict")}
    out = []

    def walk(o):
        if isinstance(o, str):
            out.append(o)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(payload)
    return " ".join(out)


def _ring_terms(ring):
    """The terms that index a ring: its sealed label keywords+entities if present,
    else freshly extracted from its content. Always lowercased."""
    lab = ring.get("payload", {}).get("labels") or {}
    kws = lab.get("keywords") or []
    ents = lab.get("entities") or []
    quants = lab.get("quantities") or []
    if kws or ents or quants:
        terms = {str(t).lower() for t in kws} | {str(t).lower() for t in ents}
        for q in quants:                       # '5 mile' -> '5', 'mile' (both searchable)
            terms |= set(str(q).lower().split())
    else:
        terms = set(_toks(_block_text(ring)))
    # v3.15: index BOTH the verbatim term and its folded canon — verbatim-perfect
    # recall is preserved; folding only widens the net.
    return terms | {fold(t) for t in terms}


class Hippocampus:
    DF_CAP = 5000     # at query time, skip a term whose postings list exceeds this
    LSH_BITS = 16     # bits in the random-projection signature (Hamming-1 neighbours probed)
    LSH_SEED = 1729

    def __init__(self, root, embedder=None):
        self.tc = Timechain(root)
        self.dir = self.tc.dir / "hippocampus"
        self.postings_path = self.dir / "postings.json"
        self.offsets_path = self.dir / "offsets.json"
        self.lsh_path = self.dir / "lsh.json"
        self.meta_path = self.dir / "meta.json"
        self.embedder = embedder
        self._loaded = False
        self._postings = {}
        self._offsets = {}
        self._lsh = {}
        self._meta = {}
        self._planes = None
        self._end_offset = 0

    # ---- persistence ----
    def _load(self):
        if self._loaded:
            return
        self._meta = json.loads(self.meta_path.read_text()) if self.meta_path.exists() else {}
        self._postings = json.loads(self.postings_path.read_text()) if self.postings_path.exists() else {}
        self._offsets = json.loads(self.offsets_path.read_text()) if self.offsets_path.exists() else {}
        self._lsh = json.loads(self.lsh_path.read_text()) if self.lsh_path.exists() else {}
        self._loaded = True

    def _save(self):
        _atomic_write(self.postings_path, self._postings)
        _atomic_write(self.offsets_path, self._offsets)
        _atomic_write(self.lsh_path, self._lsh)
        _atomic_write(self.meta_path, self._meta)

    # ---- LSH (stdlib sign random projection; deterministic from a stored seed) ----
    def _hyperplanes(self, dim):
        if self._planes is None or len(self._planes[0]) != dim:
            rng = random.Random(self._meta.get("lsh_seed", self.LSH_SEED))
            bits = self._meta.get("lsh_bits", self.LSH_BITS)
            self._planes = [[rng.gauss(0, 1) for _ in range(dim)] for _ in range(bits)]
        return self._planes

    def _signature(self, vec):
        bits = 0
        for k, p in enumerate(self._hyperplanes(len(vec))):
            if sum(x * y for x, y in zip(vec, p)) >= 0:
                bits |= (1 << k)
        return bits

    # ---- scan with byte offsets (append-only => offsets are stable) ----
    def _scan(self, start_offset):
        with open(self.tc.rings_path, "rb") as f:
            f.seek(start_offset)
            while True:
                off = f.tell()
                raw = f.readline()
                if not raw:
                    break
                s = raw.strip()
                if not s:
                    continue
                try:
                    ring = json.loads(s)
                except Exception:
                    continue   # tolerate a torn line; verify() reports it
                yield off, ring
            self._end_offset = f.tell()

    def _index_ring(self, off, ring):
        idx = ring.get("index")
        if idx is None or idx == 0:        # genesis is identity, not a recall target
            return
        self._offsets[str(idx)] = off
        for t in _ring_terms(ring):
            self._postings.setdefault(t, []).append(idx)
        labels = ring.get("payload", {}).get("labels") or {}
        emb = labels.get("embedding")
        if emb:
            # ONE vector space per LSH bank: signatures over vectors from different
            # embedders/models/dims are meaningless neighbours. The bank adopts the
            # first fingerprint it sees (unstamped = legacy default) and foreign
            # vectors are counted but never bucketed.
            fp = labels.get("embedding_fingerprint") or embmod.LEGACY_FINGERPRINT
            bank = self._meta.get("embedding_fingerprint")
            if bank is None:
                self._meta["embedding_fingerprint"] = bank = fp
            if fp == bank:
                self._lsh.setdefault(str(self._signature(emb)), []).append(idx)
            else:
                self._meta["lsh_skipped_foreign"] = self._meta.get("lsh_skipped_foreign", 0) + 1

    # ---- build / update ----
    def build(self):
        """Full rebuild from the chain. The index is derived — safe to delete and
        regenerate at any time; the chain remains the only source of truth."""
        self.dir.mkdir(parents=True, exist_ok=True)
        self._postings, self._offsets, self._lsh = {}, {}, {}
        self._meta = {"lsh_seed": self.LSH_SEED, "lsh_bits": self.LSH_BITS,
                      "embedding_fingerprint": (embmod.fingerprint_of(self.embedder)
                                                if self.embedder is not None else None)}
        self._loaded = True
        self._planes = None                  # new bank, possibly new dim -> regrow planes
        self._end_offset = 0
        count = 0
        if self.tc.rings_path.exists():
            for off, ring in self._scan(0):
                self._index_ring(off, ring)
                count += 1
        head = self.tc._tail_ring()
        self._meta.update({"indexed_bytes": self._end_offset, "indexed_count": count,
                           "head_hash": head.get("ring_hash") if head else None,
                           "head_index": head.get("index") if head else None})
        self._save()
        return {"indexed": count, "terms": len(self._postings), "lsh_buckets": len(self._lsh)}

    def update(self):
        """Index only the rings appended since the last build — O(new). Self-heals
        the index to the current chain head with minimal work."""
        self._load()
        if not self._meta:
            return self.build()
        self._end_offset = self._meta.get("indexed_bytes", 0)
        added = 0
        for off, ring in self._scan(self._meta.get("indexed_bytes", 0)):
            self._index_ring(off, ring)
            added += 1
        if added:
            head = self.tc._tail_ring()
            self._meta.update({"indexed_bytes": self._end_offset,
                               "indexed_count": self._meta.get("indexed_count", 0) + added,
                               "head_hash": head.get("ring_hash") if head else None,
                               "head_index": head.get("index") if head else None})
            self._save()
        return {"added": added}

    def stale(self):
        self._load()
        head = self.tc._tail_ring()
        cur = head.get("ring_hash") if head else None
        return self._meta.get("head_hash") != cur

    def ensure_current(self):
        """Lazily bring the index to the chain head (build if absent, else incremental).
        A bank built for a different embedder's vector space is rebuilt, not patched —
        the index is derived, so a rebuild is always safe and always sound."""
        self._load()
        if not self._meta:
            return self.build()
        if self.embedder is not None:
            bank = self._meta.get("embedding_fingerprint")
            if bank is not None and bank != embmod.fingerprint_of(self.embedder):
                return self.build()
        if self.stale():
            return self.update()
        return {"added": 0}

    # ---- search (SUB-LINEAR: touches only query-term postings + LSH neighbours) ----
    def search(self, query_text, context="", query_embedding=None, limit=300,
               query_fingerprint=None):
        """Return a candidate list of ring indices — NOT ranked by relevance (that is
        recall.py's and the model's job). Sub-linear in chain height: it visits only
        the postings lists of the query's terms (skipping non-selective ones) and the
        LSH buckets near the query embedding, never all n rings."""
        self._load()
        scores = Counter()
        qtoks = set(_toks(query_text + " " + context))
        qtoks |= {fold(t) for t in qtoks}   # v3.15 query-side folding (verbatim kept too)
        for t in qtoks:
            posting = self._postings.get(t)
            if not posting or len(posting) > self.DF_CAP:   # missing or non-selective -> skip
                continue
            w = 1.0 + 1.0 / math.log(2 + len(posting))      # rarer term -> slightly higher weight
            for idx in posting:
                scores[idx] += w
        if query_embedding and query_fingerprint:
            bank = self._meta.get("embedding_fingerprint")
            if bank is not None and query_fingerprint != bank:
                query_embedding = None       # foreign space: LSH neighbours would be noise;
                #                              the lexical postings still serve the query
        if query_embedding:
            sig = self._signature(query_embedding)
            nbits = self._meta.get("lsh_bits", self.LSH_BITS)
            for b in [sig] + [sig ^ (1 << k) for k in range(nbits)]:   # exact + Hamming-1 buckets
                for idx in self._lsh.get(str(b), []):
                    scores[idx] += 0.5
        return [idx for idx, _ in scores.most_common(limit)]

    def fetch(self, indices):
        """Load specific rings by index via the offset map — O(k) seek-reads, never a
        full scan. Returns rings in chain order."""
        self._load()
        if not self.tc.rings_path.exists():
            return []
        out = []
        with open(self.tc.rings_path, "rb") as f:
            for idx in sorted(set(indices), key=lambda x: int(x)):
                off = self._offsets.get(str(idx))
                if off is None:
                    continue
                f.seek(off)
                raw = f.readline()
                try:
                    out.append(json.loads(raw))
                except Exception:
                    continue
        return out

    def candidates(self, query_text, context="", query_embedding=None, limit=300,
                   query_fingerprint=None):
        """Convenience: search + fetch -> the candidate rings recall.py will judge."""
        return self.fetch(self.search(query_text, context, query_embedding, limit,
                                      query_fingerprint=query_fingerprint))

    def status(self):
        self._load()
        head = self.tc._tail_ring()
        return {"indexed_count": self._meta.get("indexed_count"),
                "indexed_head": self._meta.get("head_index"),
                "chain_head": head.get("index") if head else None,
                "terms": len(self._postings or {}),
                "lsh_buckets": len(self._lsh or {}),
                "embedding_fingerprint": self._meta.get("embedding_fingerprint"),
                "lsh_skipped_foreign": self._meta.get("lsh_skipped_foreign", 0),
                "stale": self.stale(),
                "dir": str(self.dir)}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_build(args):
    r = Hippocampus(args.root).build()
    print(f"built hippocampal index: {r['indexed']} rings, {r['terms']} terms, {r['lsh_buckets']} lsh buckets")


def cmd_update(args):
    r = Hippocampus(args.root).update()
    print(f"index updated: +{r.get('added', 0)} rings (incremental)")


def cmd_search(args):
    h = Hippocampus(args.root)
    h.ensure_current()
    ids = h.search(args.query, args.context or "", limit=args.limit)
    print(f"{len(ids)} candidate ring(s) (sub-linear; model still judges relevance):")
    print("  " + ", ".join(f"#{i}" for i in ids[:40]) + (" …" if len(ids) > 40 else ""))


def cmd_status(args):
    st = Hippocampus(args.root).status()
    print(f"indexed_count: {st['indexed_count']}   indexed_head: {st['indexed_head']}   "
          f"chain_head: {st['chain_head']}   stale: {st['stale']}")
    print(f"terms: {st['terms']}   lsh_buckets: {st['lsh_buckets']}   "
          f"vector space: {st['embedding_fingerprint'] or '-'}"
          + (f"   (foreign vectors skipped: {st['lsh_skipped_foreign']})"
             if st['lsh_skipped_foreign'] else ""))
    print(f"dir: {st['dir']}")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    p = argparse.ArgumentParser(description="Hippocampus — persistent, rebuildable recall index over the Timechain.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pb = sub.add_parser("build", parents=[common], help="(re)build the index from the chain (derived; safe to delete)")
    pb.set_defaults(func=cmd_build)
    pu = sub.add_parser("update", parents=[common], help="incrementally index rings appended since last build — O(new)")
    pu.set_defaults(func=cmd_update)
    ps = sub.add_parser("search", parents=[common], help="sub-linear candidate shortlist for a query (ids only)")
    ps.add_argument("query")
    ps.add_argument("--context", default=None)
    ps.add_argument("--limit", type=int, default=300)
    ps.set_defaults(func=cmd_search)
    pst = sub.add_parser("status", parents=[common], help="index health: indexed height vs chain head, staleness, sizes")
    pst.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
