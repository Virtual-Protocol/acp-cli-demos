#!/usr/bin/env python3
"""
Embedding backends for semantic recall — pluggable, wired into recall's relevance_fn.

DEFAULT (stdlib, zero-dep): `HashingEmbedder` — hashed bag-of-(word + char n-gram)
vectors with cosine similarity. It represents the WHOLE chunk (not just its top
keywords) and sharpens FUZZY / MORPHOLOGICAL matching that raw token overlap misses:
'validate' ~ 'validation' ~ 'validating', shared identifier subwords, typos.

HONEST CEILING: this is NOT true semantic embedding. It cannot bridge synonymy or
meaning ('back up a claim' will not match 'ungrounded'). For genuine semantic recall,
plug in a real model with the SAME interface via `get_embedder('st'|'openai'|'voyage')`
— those adapters need a library and/or API key (not present here by default).

Interface: every embedder has `.embed(text) -> list[float]` (L2-normalized), a
`.fingerprint` identifying the vector space it produces, and there is a module-level
`cosine(a, b)`. Stdlib only for the default.

FINGERPRINTS (vector-space provenance): vectors from different embedders — or
different models, dims, or algorithm revisions of the same embedder — live in
DIFFERENT spaces; comparing across them silently produces garbage cosines. Every
embedder therefore exposes `.fingerprint` (e.g. "hashing:256:v1",
"openai:text-embedding-3-small"), recall seals it beside every vector it embeds,
and consumers (recall, hippocampus) refuse or re-embed on mismatch. Vectors sealed
before fingerprinting existed are treated as LEGACY_FINGERPRINT — the stdlib
default was the only embedder shipped, so that is the only sound assumption.
"""

from __future__ import annotations

import argparse
import hashlib
import math
import re
import sys

_WORD = re.compile(r"[a-z0-9_]+")


def _features(text, ngrams=(3, 4)):
    text = (text or "").lower()
    feats = []
    for w in _WORD.findall(text):
        feats.append("w:" + w)                       # whole-word feature
        s = "^" + w + "$"
        for k in ngrams:                             # char n-grams -> morphology / subword
            for i in range(len(s) - k + 1):
                feats.append("g:" + s[i:i + k])
    return feats


def _h(feat):
    return int.from_bytes(hashlib.blake2b(feat.encode(), digest_size=8).digest(), "big")


class HashingEmbedder:
    name = "hashing"
    ALGO_VERSION = "v1"     # bump if _features/_h/signing ever change: that is a NEW space
    window_chars = None     # no input window: the whole chunk reaches the vector

    def __init__(self, dim=256):
        self.dim = dim

    @property
    def fingerprint(self):
        return f"{self.name}:{self.dim}:{self.ALGO_VERSION}"

    def embed(self, text):
        v = [0.0] * self.dim
        for f in _features(text):
            h = _h(f)
            v[h % self.dim] += 1.0 if (h >> 12) & 1 else -1.0   # signed hashing cuts collisions
        norm = math.sqrt(sum(x * x for x in v)) or 1.0
        return [round(x / norm, 5) for x in v]


def cosine(a, b):
    if not a or not b or len(a) != len(b):
        return 0.0
    return max(0.0, sum(x * y for x, y in zip(a, b)))   # both L2-normed -> dot == cosine


# The space all pre-fingerprint sealed vectors belong to: the stdlib default was the
# only zero-dep embedder shipped, so unstamped == hashing:256:v1 is the sound reading.
LEGACY_FINGERPRINT = "hashing:256:v1"


def fingerprint_of(embedder):
    """Fingerprint of any embedder object; 'unknown' for foreign ones without the attr."""
    return getattr(embedder, "fingerprint", None) or "unknown"


def compatible(sealed_fp, current_fp):
    """May a SEALED vector (stamp `sealed_fp`, possibly None=pre-fingerprint legacy)
    be compared against vectors from the CURRENT embedder? Unstamped vectors are
    only sound under the legacy default space."""
    if sealed_fp is None:
        return current_fp == LEGACY_FINGERPRINT
    return sealed_fp == current_fp


# --- real-model adapters (same .embed interface); used only if the dep/key is present ---

class _STEmbedder:
    name = "sentence-transformers"

    def __init__(self, model="all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        self.m, self.model = SentenceTransformer(model), model
        # window-matched chunking: text past the model's input window is
        # silently invisible to the vector (a measured recall gap)
        self.window_chars = int(getattr(self.m, "max_seq_length", 256) or 256) * 4

    @property
    def fingerprint(self):
        return f"st:{self.model}"

    def embed(self, text):
        return [float(x) for x in self.m.encode(text, normalize_embeddings=True)]


class _OpenAIEmbedder:
    name = "openai"

    def __init__(self, model="text-embedding-3-small"):
        import openai
        self.c, self.model = openai.OpenAI(), model
        self.window_chars = 24000          # ~8k-token input window, conservative

    @property
    def fingerprint(self):
        return f"openai:{self.model}"

    def embed(self, text):
        v = self.c.embeddings.create(model=self.model, input=text).data[0].embedding
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]


class _VoyageEmbedder:
    name = "voyage"

    def __init__(self, model="voyage-3"):
        import voyageai
        self.c, self.model = voyageai.Client(), model
        self.window_chars = 24000          # ~8k-token input window, conservative

    @property
    def fingerprint(self):
        return f"voyage:{self.model}"

    def embed(self, text):
        v = self.c.embed([text], model=self.model).embeddings[0]
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]


def get_embedder(name="hashing", **kw):
    if name == "auto":
        # v3.15 TIER LOGIC: use the best embedder actually importable, falling
        # back cleanly — st (true semantics) > trained lens > hashing (stdlib).
        # The fingerprint seam makes tier switches SAFE: a bank built in another
        # vector space is rebuilt, never silently mixed.
        try:
            import sentence_transformers  # noqa: F401
            return _STEmbedder(**{k: v for k, v in kw.items() if k != "registry_root"})
        except Exception:
            pass
        try:
            import lens as lensmod
            e = lensmod.load_active(kw.get("registry_root"))
            if e is not None:
                return e
        except Exception:
            pass
        return HashingEmbedder()
    if name == "hashing":
        return HashingEmbedder(**kw)
    if name == "lens":
        import lens as lensmod                  # lazy: lens imports embed (one-way at runtime)
        e = lensmod.load_active(kw.get("registry_root"))
        if e is None:
            raise RuntimeError("provider 'lens' needs an ACTIVE trained lens — "
                               "run: python3 lens.py train --adopt (or python3 dream.py run)")
        return e
    if name in ("st", "sentence-transformers"):
        try:
            import sentence_transformers  # noqa: F401
        except ImportError:
            raise RuntimeError("provider 'st' needs: pip install sentence-transformers")
        return _STEmbedder(**kw)
    if name == "openai":
        try:
            import openai  # noqa: F401
        except ImportError:
            raise RuntimeError("provider 'openai' needs: pip install openai  + OPENAI_API_KEY")
        return _OpenAIEmbedder(**kw)
    if name == "voyage":
        try:
            import voyageai  # noqa: F401
        except ImportError:
            raise RuntimeError("provider 'voyage' needs: pip install voyageai  + VOYAGE_API_KEY")
        return _VoyageEmbedder(**kw)
    raise ValueError(f"unknown embedder provider: {name}")


def cmd_sim(args):
    e = get_embedder(args.provider)
    print(f"cosine[{e.name}]({args.a!r}, {args.b!r}) = {cosine(e.embed(args.a), e.embed(args.b)):.4f}")


def cmd_vec(args):
    e = get_embedder(args.provider)
    v = e.embed(args.text)
    print(f"{e.name} [{fingerprint_of(e)}]: dim={len(v)}  first8={[round(x,3) for x in v[:8]]}")


def build_parser():
    p = argparse.ArgumentParser(description="Embedding backends for semantic recall.")
    sub = p.add_subparsers(dest="cmd", required=True)
    ps = sub.add_parser("sim", help="cosine similarity between two strings")
    ps.add_argument("a"); ps.add_argument("b")
    ps.add_argument("--provider", default="hashing")
    ps.set_defaults(func=cmd_sim)
    pv = sub.add_parser("vec", help="embed a string (show dim + head)")
    pv.add_argument("text")
    pv.add_argument("--provider", default="hashing")
    pv.set_defaults(func=cmd_vec)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
