#!/usr/bin/env python3
"""
Recall — self-labeling + relevance-realization retrieval over the Timechain.

As the chain grows past the context window, the agent cannot reread everything.
Recall lets it (1) self-label each block's contents at seal time using its own
senses and modalities, and (2) retrieve only the blocks genuinely relevant to a
new prompt — enough to inform the answer, never enough to bloat.

SELF-LABELING (at seal time, sealed INTO the block, immutable):
  Run the content through the faculty registry; the senses and modalities that
  *fire* on it become its labels, alongside salient keywords, identifier-like
  entities, a salience score, and the content's dissonance. Labels are the
  block's own handles for future relevance.

RELEVANCE REALIZATION (at recall time) — the MODEL is the judge:
  This skill is ALWAYS attached to a model, so relevance is realized by that model
  reading the compact self-labels + summaries (`index`) and recognizing — by
  understanding, not string overlap — which past blocks relate to the new prompt.
  It then `fetch`es those blocks. The labels are the scannable map of memory; the
  model is the one who sees what relates (paraphrase and all). `retrieve` below is
  ONLY a cheap pre-filter for chains so large their index will not fit in context —
  it narrows the field; it is never the arbiter of relevance.

SMOOTH, ADAPTIVE DEPTH (no bloat):
  How many blocks to pull is governed by DISSONANCE (the need signal): low
  dissonance (the query is already well-covered) -> retrieve few or none; high
  dissonance -> retrieve more, up to a relevance threshold and a token budget.
  PoQ then validates downstream whether the retrieved context was sufficient.

Faculties are loaded from this script's own dir (the skill registry). The chain
to search is given by --root, so you can recall over any task/identity chain.

Stdlib only. Python 3.8+.  Builds on timechain.py, cambium.py, poq.py.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import random
import re
import sys
from collections import Counter
from pathlib import Path

from timechain import Timechain
from cambium import load_corpus, detect_gap
from poq import tokens, jaccard, clamp, gate_and_seal, POQ_WINDOW
import embed as embmod
import telemetry as telem
import policy as policymod
import learner as learnermod

ENTITY_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_.]*")
PATH_HINT_RE = re.compile(r"(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+\.[A-Za-z0-9]+")

# Identifier for the active decision-weight regime (the hand-tuned v2.1 constants).
# Telemetry stamps it on every offer so trained scorers (Phase B+) can be evaluated
# against — and rolled back to — exactly the regime that produced each event.
SCORER_VERSION = "hand-2.1"

# Cap on NON-CHOSEN candidates logged per offer event: enough hard negatives to
# train on, bounded so a 10k-ring retrieve can't bloat the log.
OFFER_LOG_CAP = 24


def _os_env_true(name, default=True):
    v = os.environ.get(name)
    if v is None:
        return default
    return v.lower() not in ("0", "false", "no", "off")


def approx_tokens(s: str) -> int:
    return max(1, len(s) // 4)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# Git provenance via DIRECT ref reads — stdlib file I/O only, no process spawning,
# no process spawning. Best-effort: any failure yields None fields. git_dirty
# is not computed without git, so it is reported as None (unknown) rather than
# shelling out — the cryptographic provenance is the commit SHA.
def _git_dir(path):
    p = Path(path).resolve()
    for d in [p, *p.parents]:
        g = d / ".git"
        try:
            if g.is_dir():
                return g, d
            if g.is_file():
                line = g.read_text(errors="ignore").strip()
                if line.startswith("gitdir:"):
                    gd = (d / line.split(":", 1)[1].strip()).resolve()
                    return (gd if gd.exists() else None), d
        except Exception:
            return None, None
    return None, None


def _read_ref(git_dir, ref):
    try:
        loose = git_dir / ref
        if loose.is_file():
            return loose.read_text(errors="ignore").strip() or None
    except Exception:
        pass
    try:
        packed = git_dir / "packed-refs"
        if packed.is_file():
            for line in packed.read_text(errors="ignore").splitlines():
                line = line.strip()
                if not line or line[0] in "#^":
                    continue
                sha, _, name = line.partition(" ")
                if name == ref:
                    return sha or None
    except Exception:
        pass
    return None


def _git_remote(git_dir):
    try:
        section = None
        for raw in (git_dir / "config").read_text(errors="ignore").splitlines():
            s = raw.strip()
            if s.startswith("[") and s.endswith("]"):
                section = s[1:-1].strip().lower()
            elif section == 'remote "origin"' and "=" in s:
                k, _, v = s.partition("=")
                if k.strip().lower() == "url":
                    return v.strip() or None
    except Exception:
        pass
    return None


def _git_info(path):
    info = {"git_commit": None, "git_branch": None, "git_dirty": None,
            "git_root": None, "git_remote": None}
    try:
        git_dir, root = _git_dir(path)
        if not git_dir:
            return info
        info["git_root"] = str(root) if root else None
        info["git_remote"] = _git_remote(git_dir)
        head = (git_dir / "HEAD").read_text(errors="ignore").strip()
        if head.startswith("ref:"):
            ref = head.split(":", 1)[1].strip()
            info["git_branch"] = ref.rsplit("/", 1)[-1]
            info["git_commit"] = _read_ref(git_dir, ref)
        elif head:
            info["git_branch"] = "HEAD"   # detached
            info["git_commit"] = head
    except Exception:
        pass
    return info


def current_git_info(path):
    return _git_info(path)


def _strings(obj):
    out = []
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            out += _strings(v)
    elif isinstance(obj, list):
        for v in obj:
            out += _strings(v)
    return out


def block_text(ring) -> str:
    # Score/label on the block's DISTINCTIVE content, not its labels or the rolling
    # task state (objective + findings repeat across continuum blocks and would
    # swamp the signal — that boilerplate must not pollute relevance). For
    # cartographic continuum blocks, source content is the text surface; path and
    # provenance metadata are scored separately by the retrieval cartography.
    payload = ring.get("payload", {})
    data = payload.get("data")
    if isinstance(data, dict) and "content" in data:
        return str(data.get("content") or "")
    payload = {k: v for k, v in payload.items() if k not in ("labels", "state", "poq_verdict")}
    return " ".join(_strings(payload))


def entities(text, cap=12):
    ents = set()
    for w in ENTITY_RE.findall(text):
        core = w.strip(".")
        if len(core) > 2 and (("_" in core) or any(c.isupper() for c in core[1:])
                              or ("." in core) or any(c.isdigit() for c in core)):
            ents.add(core)
    return sorted(ents)[:cap]


def keywords(text, k=10):
    return [w for w, _ in Counter(tokens(text)).most_common(k)]


QUANTITY_RE = re.compile(
    r"\$\s?\d[\d,]*(?:\.\d+)?"                  # money: $800, $ 1,200.50
    r"|\d[\d,]*(?:\.\d+)?\s?%"                   # percent: 40%, 12.5 %
    r"|\b\d[\d,]*(?:\.\d+)?[\s-]?[A-Za-z]+\b"  # number+unit: 5 miles, 3-mile, 4 days
)
QUANTITY_SEEKING = {"how", "much", "many", "far", "total", "percent", "percentage",
                    "cost", "spend", "spent", "price", "distance", "amount",
                    "count", "number", "sum", "average"}


def quantities(text, cap=10):
    """Number+unit pairs ('5 mile', '$800', '40%') — the passing-remark facts a
    block's topical keywords never carry. Field-driven: aggregate questions
    die when buried quantities are invisible to labels."""
    out = []
    for m in QUANTITY_RE.finditer(text or ""):
        q = re.sub(r"\s+", " ", m.group(0).lower().replace("-", " ")).strip()
        parts_q = q.split(" ")
        if len(parts_q) == 2 and parts_q[1].endswith("s") and len(parts_q[1]) > 3:
            parts_q[1] = parts_q[1][:-1]              # '5 miles' == '5-mile' == '5 mile'
            q = " ".join(parts_q)
        if q not in out:
            out.append(q)
        if len(out) >= cap:
            break
    return out


def value_sentences(text, cap=260):
    """The sentences that carry REAL quantities — a term-table row is only as
    good as its visible values (V4.1: the dominant aggregate failure mode is
    values hidden outside ~100-word topical snippets). Bare list numerals and
    numeric noise are skipped; a value sentence has a currency/percent/unit-
    shaped number inside actual prose."""
    out = []
    for s in re.split(r"(?<=[.!?])\s+|\n+", text or ""):
        s = s.strip()
        if len(s) < 12 or not re.search(r"\d", s):
            continue
        if re.fullmatch(r"[\d\s.,:;()*#-]+", s):          # list markers / numeric noise
            continue
        if not re.search(r"(\$\s?\d|\d+(\.\d+)?\s*%|\d[\d,]*(\.\d+)?[\s-]*[A-Za-z])", s):
            continue
        cand = " … ".join(out + [s[:180]])
        if len(cand) > cap:
            break
        out.append(s[:180])
    return " … ".join(out) or None


def excerpt_text(text, query="", words=60):
    parts = text.split()
    if not parts:
        return ""
    q_terms = sorted({t for t in tokens(query or "") if len(t) > 2}, key=lambda t: (-len(t), t))
    start = 0
    if q_terms:
        for term in q_terms:
            for i, part in enumerate(parts):
                normalized = re.sub(r"[^A-Za-z0-9_]+", "", part).lower()
                if normalized == term or (len(term) >= 8 and term in normalized):
                    start = max(0, i - 8)
                    return " ".join(parts[start:start + words])
    return " ".join(parts[start:start + words])


def normalize_path(value):
    if not value:
        return None
    value = str(value).strip().replace("\\", "/")
    while value.startswith("./"):
        value = value[2:]
    return value.strip("/")


def path_hints(text):
    return [normalize_path(m.group(0)) for m in PATH_HINT_RE.finditer(text or "") if normalize_path(m.group(0))]


def ring_data(ring):
    return ring.get("payload", {}).get("data") or {}


def ring_path(ring):
    data = ring_data(ring)
    return normalize_path(data.get("relative_path") or data.get("item"))


def ring_location(ring):
    data = ring_data(ring)
    return {
        "relative_path": ring_path(ring),
        "file_index": data.get("file_index"),
        "chunk_index": data.get("chunk_index"),
        "chunk_of": data.get("chunk_of"),
        "line_start": data.get("line_start"),
        "line_end": data.get("line_end"),
        "top_dir": data.get("top_dir"),
        "extension": data.get("extension"),
        "language": data.get("language"),
        "path_role": data.get("path_role"),
        "is_test": data.get("is_test"),
        "is_generated": data.get("is_generated"),
        "git_commit": data.get("git_commit"),
        "git_branch": data.get("git_branch"),
        "git_dirty": data.get("git_dirty"),
        "content_hash": data.get("content_hash"),
        "file_content_hash": data.get("file_content_hash"),
        "redacted": data.get("redacted"),
        "redaction_count": data.get("redaction_count", 0),
    }


def neighbor_group_key(ring):
    data = ring_data(ring)
    return (
        ring_path(ring),
        data.get("git_commit"),
        data.get("file_content_hash") or data.get("content_hash"),
    )


def _norm_date(value):
    """Loose date normalizer -> 'YYYY-MM-DD' or None. Accepts ISO timestamps and
    corpus session stamps like '2023/05/30 (Tue) 23:40' (prefix is what matters)."""
    if not value:
        return None
    s = str(value).strip()[:10].replace("/", "-")
    parts = s.split("-")
    if len(parts) == 3 and parts[0].isdigit() and len(parts[0]) == 4:
        try:
            return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
        except ValueError:
            return None
    return None


def ring_date(ring):
    """The block's WHEN. An explicit source date in the payload (ingested corpora
    carry their session's stamp) outranks the seal timestamp — a block sealed
    today may describe an event from years ago."""
    payload = ring.get("payload", {}) or {}
    for holder in (payload, ring_data(ring)):
        for key in ("date", "session_date", "source_date"):
            d = _norm_date(holder.get(key))
            if d:
                return d
    return _norm_date(ring.get("timestamp"))


def ring_group(ring):
    """Grouping handle for term tables: source session id, else the source file
    group, else the ring itself."""
    payload = ring.get("payload", {}) or {}
    sid = ring_data(ring).get("session_id") or payload.get("session_id")
    if sid:
        return str(sid)
    path = neighbor_group_key(ring)[0]
    return str(path) if path else f"ring-{ring.get('index')}"


# --------------------------------------------------------------------------- #
# V5 facets — WHO spoke, WHO asserted, WHICH sentences, WHICH event
# (field lessons, productized: long-horizon recall work did all of this by
# hand with regex scans; these helpers make the winning moves first-class.)
# --------------------------------------------------------------------------- #

ROLE_LINE_RE = re.compile(r"^[ \t]*(user|assistant|system)[ \t]*:", re.I | re.M)
FIRST_PERSON_RE = re.compile(r"\b(i|i'm|i've|i'd|i'll|my|me|mine|we're|we|our|us)\b", re.I)
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")


def split_turns(text):
    """Split conversational content into (role, text) turns on 'role:' line
    markers. Content without markers returns [(None, whole_text)] — speaker
    attribution is only claimed where the markers actually exist."""
    text = text or ""
    marks = list(ROLE_LINE_RE.finditer(text))
    if not marks:
        return [(None, text)]
    turns = []
    if marks[0].start() > 0:
        head = text[:marks[0].start()].strip()
        if head:
            turns.append((None, head))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[m.end():end].strip()
        if body:
            turns.append((m.group(1).lower(), body))
    return turns


def speaker_facets(text):
    """{'roles': [...], 'provenance': ...} — speaker + assertion-provenance facets.

    Provenance is a deliberately small, honest taxonomy (the model overrides it):
      self-report  user turns assert first-person facts ("I bought…", "my…")
      pasted       user turns carry a long document with almost no first person
                   (case summaries, articles — content the user QUOTED, not said)
      dialogue     user turns exist but are short non-assertive questions
      assistant    only assistant turns carry content
      unknown      no conversational markers at all
    Run-4 scar: a pasted court case and a pasted press release both read as
    'user said' to provenance-blind retrieval; first-person density is the
    cheap separator between a life and a clipboard."""
    turns = split_turns(text)
    roles = sorted({r for r, _ in turns if r})
    if not roles:
        return {"roles": [], "provenance": "unknown"}
    user_text = " ".join(t for r, t in turns if r == "user")
    if not user_text:
        return {"roles": roles, "provenance": "assistant"}
    words = max(1, len(user_text.split()))
    fp_per_100 = 100.0 * len(FIRST_PERSON_RE.findall(user_text)) / words
    if fp_per_100 >= 1.0:
        prov = "self-report"
    elif words >= 80:
        prov = "pasted"
    else:
        prov = "dialogue"
    return {"roles": roles, "provenance": prov}


def mention_sentences(text, terms, need=1, cap=2, width=400):
    """The full sentence(s) where the terms actually live — generalizes track's
    mention extractor to every gather row (V4.1's named bottleneck, confirmed by
    Run 4: ~100-word topical snippets drop the value clause; the winning scans
    always read whole sentences around the hit)."""
    terms = [t.lower() for t in terms if t and len(t) > 2]
    if not terms:
        return None
    keep = []
    for s in SENT_SPLIT_RE.split(text or ""):
        s = s.strip()
        if not s:
            continue
        low = s.lower()
        n = sum(1 for t in terms
                if t in low or (t.endswith("s") and t[:-1] in low)
                or (not t.endswith("s") and t + "s" in low))
        if n >= need:
            keep.append(s[:220])
            if len(keep) >= cap:
                break
    return " … ".join(keep)[:width] or None


def annotate_deixis(row_text, row_date):
    """Resolve relative expressions INSIDE a row against the row's OWN date —
    'yesterday' in a 2023-05-20 session means 2023-05-19, mechanically, on
    every row (Run 4 resolved these by hand hundreds of times; pure win)."""
    if not (row_text and row_date):
        return None
    import almanac
    hits = almanac.find_in_text(row_text, row_date)
    return [{"expr": h["expr"], "from": h["from"], "to": h["to"]}
            for h in hits[:3]] or None


def cluster_events(rows, text_key="mention", fallback_key="snippet"):
    """Event-identity clustering: group rows that re-mention the SAME underlying
    event with drifting deixis ('last Saturday' said on three different days).
    Heuristic signature — shared normalized quantity value plus content-token
    overlap (or strong overlap alone when no quantities) — marked, never merged:
    the table keeps every row; the cluster tells the model 'these N rows are one
    event' and flags date conflicts so the mention nearest the event wins."""
    def _containment(a, b):
        # overlap relative to the SMALLER mention — re-mentions drift in length
        # (a passing allusion vs the full story), which jaccard over-punishes
        if not a or not b:
            return 0.0
        return len(a & b) / min(len(a), len(b))

    clusters = []
    for row in rows:
        text = row.get(text_key) or row.get(fallback_key) or ""
        toks = {t for t in tokens(text) if len(t) > 3}
        qset = {q for q in (row.get("quantities") or row.get("values") or [])}
        placed = None
        for c in clusters:
            ov = _containment(toks, c["toks"])
            if (qset and c["qset"] and (qset & c["qset"]) and ov >= 0.34) \
                    or (not qset and not c["qset"] and ov >= 0.65):
                placed = c
                break
        if placed is None:
            placed = {"id": f"e{len(clusters) + 1}", "toks": set(), "qset": set(),
                      "rows": [], "dates": set()}
            clusters.append(placed)
        placed["toks"] |= toks
        placed["qset"] |= qset
        placed["rows"].append(row.get("index"))
        if row.get("date"):
            placed["dates"].add(row["date"])
        row["event"] = placed["id"]
    return [{"event": c["id"], "n_mentions": len(c["rows"]), "rows": c["rows"],
             "dates": sorted(c["dates"]),
             "date_conflict": len(c["dates"]) > 1}
            for c in clusters if len(c["rows"]) > 1]


def path_matches(ring, path_filter=None, dir_filter=None):
    rel = ring_path(ring)
    if not rel:
        return path_filter is None and dir_filter is None
    if path_filter:
        pf = normalize_path(path_filter)
        if rel != pf and not rel.startswith(pf.rstrip("/") + "/"):
            return False
    if dir_filter:
        df = normalize_path(dir_filter).rstrip("/")
        if rel != df and not rel.startswith(df + "/"):
            return False
    return True


def metadata_matches(ring, language=None, extension=None, role=None, top_dir=None,
                     exclude_path=None, exclude_dir=None, source_only=False):
    data = ring_data(ring)
    rel = ring_path(ring)
    if exclude_path:
        excluded = [normalize_path(x) for x in exclude_path if x]
        if rel and any(rel == x or rel.startswith(x.rstrip("/") + "/") for x in excluded):
            return False
    if exclude_dir:
        excluded_dirs = [normalize_path(x).rstrip("/") for x in exclude_dir if x]
        if rel and any(rel == x or rel.startswith(x + "/") for x in excluded_dirs):
            return False
    if language and (data.get("language") or "").lower() != language.lower():
        return False
    if extension:
        wanted = extension if str(extension).startswith(".") else "." + str(extension)
        if (data.get("extension") or "").lower() != wanted.lower():
            return False
    if top_dir and normalize_path(data.get("top_dir")) != normalize_path(top_dir):
        return False
    wanted_role = "source" if source_only and not role else role
    if wanted_role and (data.get("path_role") or "").lower() != wanted_role.lower():
        return False
    return True


def common_prefix_score(a, b):
    a, b = normalize_path(a), normalize_path(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ap, bp = a.split("/"), b.split("/")
    shared = 0
    for x, y in zip(ap, bp):
        if x != y:
            break
        shared += 1
    if shared == 0:
        return 0.0
    return shared / max(len(ap), len(bp))


def path_proximity(ring, filters, hints):
    rel = ring_path(ring)
    if not rel:
        return 0.0
    candidates = [p for p in (filters or []) if p] + list(hints or [])
    if not candidates:
        return 0.0
    return max(common_prefix_score(rel, p) for p in candidates)


def brief_block(ring, score=None, lab=None, words=60, query=""):
    lab = lab or ring.get("payload", {}).get("labels") or {}
    excerpt = excerpt_text(block_text(ring), query=query, words=words)
    out = {
        "index": ring["index"],
        "type": ring["ring_type"],
        "location": ring_location(ring),
        "labels": {
            "senses": [s["name"] for s in lab.get("senses", [])[:3]],
            "modalities": [m["name"] for m in lab.get("modalities", [])[:3]],
            "keywords": lab.get("keywords", [])[:6],
        },
        "excerpt": excerpt[:260],
    }
    if score is not None:
        out["score"] = round(score, 3)
    return out


def render_evidence(question, asked_on, shapes, sections, budget_chars=30000):
    """The evidence package as model-facing text — dated, chronological, with
    the deixis note and section headers naming each instrument."""
    lines = [f"Q: {question}",
             f"asked_on: {asked_on or 'unknown'}",
             f"shapes: {', '.join(shapes)}",
             "NOTE: deixis inside an excerpt ('yesterday', 'today') resolves against "
             "THAT excerpt's session date, never the asking date."]
    for s in sections:
        if s["kind"] == "narrow":
            lines.append("== EVIDENCE (chronological; top-ranked group shipped in FULL) ==")
            for b in s["blocks"]:
                tag = " [FULL SESSION]" if b.get("full") else ""
                lines.append(f"--- session {b['date'] or '????-??-??'} (id {b['group']}){tag} ---")
                lines.append(b["text"])
        elif s["kind"] == "day-digest":
            lines.append(f"== DAY DIGEST: '{s['expr']}' -> {s['window'][0]}..{s['window'][1]} "
                         f"(every session in the window has a row) ==")
            for x in s["rows"]:
                kw = f" kw={', '.join(x['keywords'])}" if x.get("keywords") else ""
                lines.append(f"[{x['date']} | {x['group']}]{kw} {x['snippet']}")
        elif s["kind"] == "term-table":
            lines.append(f"== TERM TABLE (aggregate; entities: {', '.join(s['entities'])}; "
                         f"sum/count FROM these rows — a missing term means partial coverage, say so) ==")
            for x in s["rows"]:
                qty = f" qty={', '.join(x['quantities'][:8])}" if x["quantities"] else ""
                ev = f" event={x['event']}" if x.get("event") else ""
                body = x.get("mention") or x["snippet"]
                lines.append(f"[{x['date'] or '????'} | {x['group']}]{qty}{ev} {body}")
                if x.get("deixis"):
                    lines.append("    DEIXIS: " + "; ".join(
                        f"'{d['expr']}' -> {d['from']}" + ("" if d["from"] == d["to"] else f"..{d['to']}")
                        for d in x["deixis"]))
                if x.get("quote"):
                    lines.append(f"    VALUES VERBATIM: “{x['quote']}”")
            for ev in (s.get("events") or []):
                if ev["date_conflict"]:
                    lines.append(f"    EVENT {ev['event']}: {ev['n_mentions']} re-mentions of ONE event "
                                 f"with CONFLICTING dates {'/'.join(ev['dates'])} — count once; "
                                 f"prefer the mention nearest the event")
        elif s["kind"] == "timeline":
            lines.append("== TIMELINE (chronological events) ==")
            for x in s["rows"]:
                lines.append(f"[{x['date'] or '????'} | {x['group']}] {x['snippet']}")
        elif s["kind"] == "lineage":
            lines.append(f"== LINEAGE of '{s['entity']}' (PREVIOUS = second-to-last strong row, "
                         f"CURRENT = last) ==")
            for x in s["rows"]:
                tag = (" <- CURRENT" if s["current"] and x["index"] == s["current"]["index"]
                       else " <- PREVIOUS" if s["previous"] and x["index"] == s["previous"]["index"]
                       else "")
                vals = f" values={', '.join(x['values'][:4])}" if x["values"] else ""
                ev = f" event={x['event']}" if x.get("event") else ""
                lines.append(f"[{x['date']} | {x['group']}]{vals}{ev}{tag} {x['mention'][:300]}")
                if x.get("deixis"):
                    lines.append("    DEIXIS: " + "; ".join(
                        f"'{d['expr']}' -> {d['from']}" + ("" if d["from"] == d["to"] else f"..{d['to']}")
                        for d in x["deixis"]))
            for ev in (s.get("events") or []):
                if ev["date_conflict"]:
                    lines.append(f"    EVENT {ev['event']}: {ev['n_mentions']} re-mentions of ONE event "
                                 f"with CONFLICTING dates {'/'.join(ev['dates'])} — one lineage step, "
                                 f"not {ev['n_mentions']}")
    text = "\n".join(lines)
    if len(text) > budget_chars:
        text = text[:budget_chars] + "\n[evidence truncated at budget]"
    return text


class Recall:
    def __init__(self, chain_root, registry_root=None, embedder=None):
        self.tc = Timechain(chain_root)
        self._registry_root = registry_root or Path(__file__).resolve().parent
        self._grown_ops = None        # lazy: local executable ops for Cambium-grown faculties
        self.corpus = load_corpus(registry_root or Path(__file__).resolve().parent)
        self.telemetry = telem.Telemetry(chain_root)
        self.policy = policymod.load_policy(registry_root)
        self.trained_scorer = learnermod.load_scorer(registry_root)
        self.scorer_version = (self.trained_scorer["scorer_version"]
                               if self.trained_scorer else SCORER_VERSION)
        import extractor as extractormod
        self._extractor = extractormod
        self.labeler = extractormod.load_labeler(registry_root)
        self.embedder = embedder
        if isinstance(self.embedder, str):
            self.embedder = embmod.get_embedder(self.embedder)

    def _emit(self, event_type, data):
        """Record a loop side-effect. Best-effort: telemetry must never break
        the cognition it observes."""
        try:
            self.telemetry.emit(
                event_type, data,
                embedder_fingerprint=(embmod.fingerprint_of(self.embedder)
                                      if self.embedder is not None else None),
                scorer_version=self.scorer_version)
        except Exception:
            pass

    def label(self, content, context=""):
        """Self-label content: which senses/modalities fire, plus keywords,
        entities, salience, and dissonance."""
        gap = detect_gap(self.corpus, content, context)
        acts = gap["_acts"]
        senses = [{"id": f["id"], "name": f["name"]} for n, f in acts if f["kind"] == "sense"][:5]
        mods = [{"id": f["id"], "name": f["name"]} for n, f in acts if f["kind"] == "modality"][:5]
        distilled_version = None
        if self.labeler is not None:
            # The distilled labeler fires faculties the lexical matcher cannot
            # see (no shared tokens needed) — model-taught associations augment,
            # never replace, the cheap activations. Stamped for provenance.
            base = embmod.get_embedder("hashing")
            if embmod.compatible(self.labeler.get("base_fingerprint"), base.fingerprint):
                for x in self._extractor.predict_with(self.labeler, base.embed(content)):
                    target = senses if x["kind"] == "sense" else mods
                    if not any(e["id"] == x["id"] for e in target):
                        # model-taught associations outrank weak lexical hits:
                        # lead the list, and the cap trims the lexical tail
                        target.insert(0, {"id": x["id"], "name": x["name"], "distilled": x["p"]})
                        del target[6:]
                distilled_version = self.labeler["labeler_version"]
        # v3.16 DORMANT RETRIEVAL: hibernated faculties are out of the working
        # set, but content that genuinely matches one retrieves it for THIS
        # turn — the same relevance-first contract as recalling rings from
        # blockspace. Retrieved names join the fired lists, so their ops run
        # and their frames inject below.
        retrieved = []
        try:
            import cambium as _cammod
            _home = _cammod.registry_home(self._registry_root, self._registry_root)
            for kind, f, score in _cammod.retrieve_dormant(_home, content, context):
                target = senses if kind == "sense" else mods
                if not any(e["name"] == f["name"] for e in target):
                    target.insert(5, {"id": f.get("id"), "name": f["name"],
                                      "retrieved": score})
                    del target[6:]
                retrieved.append(f["name"])
        except Exception:
            pass
        ents = entities(content)
        kws = keywords(content)
        salience = clamp(50 + 9 * len(ents) + min(120, 3 * len(set(tokens(content)))))
        lab = {"senses": senses, "modalities": mods, "keywords": kws,
               "entities": ents, "salience": salience, "dissonance": gap["dissonance"]}
        if retrieved:
            lab["retrieved"] = retrieved
        quants = quantities(content)
        if quants:
            lab["quantities"] = quants
        # v3.15 BEHAVIORAL FRAMES: a fired Cambium-grown faculty whose effect is a
        # reasoning FRAME injects its directive into the loop output — growth now
        # changes how the next thought is reasoned, not just how the ring is labeled.
        try:
            import cambium as _cammod
            _grown = _cammod.load_grown(_cammod.registry_home(self._registry_root,
                                                              self._registry_root))
            _fired_names = {f["name"] for f in senses} | {m["name"] for m in mods}
            frames = [f["effect"]["text"] for k in ("senses", "modalities")
                      for f in _grown.get(k, [])
                      if f.get("name") in _fired_names
                      and isinstance(f.get("effect"), dict)
                      and f["effect"].get("type") == "frame"
                      and f["effect"].get("text")][:4]
            if frames:
                lab["frames"] = frames
        except Exception:
            pass
        # V5 facets: speaker roles + assertion provenance, only where the
        # conversational markers actually exist (code/corpora stay unfaceted)
        fac = speaker_facets(content)
        if fac["roles"]:
            lab["roles"] = fac["roles"]
            lab["provenance"] = fac["provenance"]
        if distilled_version:
            lab["labeler_version"] = distilled_version
        # Frames -> mechanisms: every FIRED faculty (sense or modality) that has an
        # executable op actually RUNS, attaching a computed result to the ring (e.g.
        # Richness Scoring -> a depth score, Bad-Idea Alarm -> risk markers). The op
        # performs the mechanical extract/measure/detect; the model reasons over it.
        try:
            import modality_ops
            if self._grown_ops is None:    # Cambium-grown faculties carry local coded ops too
                self._grown_ops = modality_ops.load_grown_ops(self._registry_root)
            fired = [f["name"] for f in senses] + [m["name"] for m in mods]
            computed = modality_ops.run_all(fired, content, context, extra_ops=self._grown_ops)
            if computed:
                lab["computed"] = computed
        except Exception:
            pass            # an executable op must never break labeling
        if self.embedder is not None:          # self-embed at ingest -> instant cosine recall later
            lab["embedding"] = self.embedder.embed(content)
            # Stamp the vector space: a sealed vector is only comparable to vectors
            # from the SAME embedder/model/dim/algorithm (see embed.compatible).
            lab["embedding_fingerprint"] = embmod.fingerprint_of(self.embedder)
        return lab

    def block_labels(self, ring):
        return ring.get("payload", {}).get("labels") or self.label(block_text(ring))

    def grep(self, pattern, role=None, provenance=None, group=None, between=None,
             ignore_case=True, literal=False, max_rows=80, max_per_block=4,
             context_sentences=1):
        """Lexical scan — the FIRST rung of the recall ladder (V5).

        Field lesson, stated plainly: when you can NAME the thing, exact match
        over the chain's content beats semantic packaging — in practice targeted
        scans win constantly and the embedding path is the fallback. grep is
        that move as a first-class organ: regex (or literal) over block CONTENT,
        speaker-attributed (each hit reports the conversational role that spoke
        the matching line), date-annotated, returning the full sentence(s)
        around every hit. Filters: role (user/assistant), provenance facet,
        group (session/source id regex), between (date window). Semantic
        retrieve/gather remain the fallback for when you can only DESCRIBE."""
        flags = re.IGNORECASE if ignore_case else 0
        rx = re.compile(re.escape(pattern) if literal else pattern, flags)
        grx = re.compile(group, re.IGNORECASE) if group else None
        lo = hi = None
        if between:
            lo, hi = _norm_date(between[0]), _norm_date(between[1])
        rows, considered, matched_blocks = [], 0, 0
        for r in self.tc.load():
            if r["index"] == 0:
                continue
            considered += 1
            date = ring_date(r)
            if lo and hi and date and not (lo <= date <= hi):
                continue
            g = ring_group(r)
            if grx and not grx.search(g):
                continue
            text = block_text(r)
            if not rx.search(text):
                continue
            if provenance:
                fac = speaker_facets(text)
                if fac["provenance"] != provenance:
                    continue
            block_hits = 0
            for turn_role, turn_text in split_turns(text):
                if role and turn_role != role:
                    continue
                sents = [s.strip() for s in SENT_SPLIT_RE.split(turn_text) if s.strip()]
                for i, s in enumerate(sents):
                    m = rx.search(s)
                    if not m:
                        continue
                    a = max(0, i - context_sentences)
                    b = min(len(sents), i + context_sentences + 1)
                    ctx = " ".join(sents[a:b])[:420]
                    rows.append({"index": r["index"], "date": date, "group": g,
                                 "role": turn_role, "match": m.group(0)[:80],
                                 "context": ctx,
                                 "deixis": annotate_deixis(ctx, date)})
                    block_hits += 1
                    if block_hits >= max_per_block:
                        break
                if block_hits >= max_per_block:
                    break
            if block_hits:
                matched_blocks += 1
            if len(rows) >= max_rows:
                break
        rows.sort(key=lambda x: (x["date"] or "9999-99-99", x["index"]))
        self._emit("offer", {
            "query_hash": telem.query_hash(pattern, ""),
            "query_keywords": telem.redact_terms(keywords(pattern)[:6]),
            "query_entities": [], "dissonance": None, "appetite": max_rows,
            "threshold": None, "considered": considered, "returned": len(rows),
            "embed": False, "scorer": "grep:" + SCORER_VERSION, "policy": "grep",
            "filters_active": bool(role or provenance or group or (lo and hi)),
            "candidates": [{"i": x["index"], "rank": k, "score": 1.0,
                            "parts": {"lexical": 1.0}, "salience": None,
                            "chosen": True}
                           for k, x in enumerate(rows[:OFFER_LOG_CAP])],
        })
        return {"pattern": pattern, "considered": considered,
                "matched_blocks": matched_blocks, "returned": len(rows),
                "rows": rows}

    def retrieve(self, query, context="", budget_tokens=1000, max_blocks=8,
                 relevance_fn=None, embed=False, path=None, dir=None, neighbors=1,
                 semantic_weight=0.70, path_weight=0.20, chronological_weight=0.10,
                 language=None, extension=None, role=None, top_dir=None,
                 exclude_path=None, exclude_dir=None, source_only=False,
                 scan_window=None, use_index=False, index_limit=300, scorer="auto",
                 on=None, between=None, relative=None, asked_on=None,
                 _fanout=None, no_overlay=False):
        if embed and self.embedder is None:           # default to the stdlib embedder
            self.embedder = embmod.get_embedder("hashing")
        # TIME-INDEXED RECALL (V4 P2): cosine cannot retrieve by WHEN — "who did
        # I meet last Tuesday" shares no semantics with the lunch it names. A
        # date window (explicit --on/--between, or --relative resolved by the
        # almanac against --asked-on) hard-filters candidates BEFORE ranking.
        # Precision semantics: with a window active, undated blocks are dropped
        # (gather keeps them — completeness; retrieve targets).
        date_lo = date_hi = None
        if on:
            date_lo = date_hi = _norm_date(on)
        elif between:
            date_lo, date_hi = _norm_date(between[0]), _norm_date(between[1])
        elif relative and asked_on:
            import almanac
            win = almanac.resolve(relative, asked_on)
            if win:
                date_lo, date_hi = win
        q = self.label(query, context)                # also embeds the query if embedder is set
        # Candidate source: the persistent Hippocampus (sub-linear shortlist) when use_index,
        # a bounded recent tail when scan_window, else the whole chain. The path/metadata
        # filters and scorer below still judge — the index only narrows the field.
        if use_index:
            from hippocampus import Hippocampus
            hippo = Hippocampus(self.tc.root, embedder=self.embedder)
            hippo.ensure_current()
            hippo_vec = q.get("embedding") if embed else None
            hippo_fp = (embmod.fingerprint_of(self.embedder)
                        if (embed and self.embedder is not None) else None)
            if embed and hasattr(self.embedder, "base"):
                # The LSH bank lives in the BASE space (sealed vectors are base);
                # query it there — the lens re-ranks afterwards in its own space.
                hippo_vec = self.embedder.base.embed(query)
                hippo_fp = embmod.fingerprint_of(self.embedder.base)
            rings = hippo.candidates(query, context,
                                     query_embedding=hippo_vec,
                                     limit=index_limit,
                                     query_fingerprint=hippo_fp)
        elif scan_window:
            rings = self.tc.tail_rings(scan_window)
        else:
            rings = self.tc.load()
        qS = {s["id"] for s in q["senses"]}
        qM = {m["id"] for m in q["modalities"]}
        qK, qE = set(q["keywords"]), set(q["entities"])
        qtok = set(tokens(query + " " + context))
        quantity_seeking = bool(QUANTITY_SEEKING & qtok)
        dissonance = q["dissonance"]
        qv = q.get("embedding") if embed else None
        _cos = None
        cur_fp = embmod.fingerprint_of(self.embedder) if self.embedder is not None else None
        if qv is not None:
            _cos = embmod.cosine
        filters = [normalize_path(path), normalize_path(dir)]
        hints = path_hints(query + " " + context)

        raw = []
        for r in rings:
            if r["index"] == 0:                       # skip the genesis/identity block
                continue
            if not path_matches(r, path_filter=path, dir_filter=dir):
                continue
            if not metadata_matches(r, language=language, extension=extension, role=role,
                                    top_dir=top_dir, exclude_path=exclude_path,
                                    exclude_dir=exclude_dir, source_only=source_only):
                continue
            if date_lo is not None:
                d = ring_date(r)
                if d is None or not (date_lo <= d <= date_hi):
                    continue
            lab = self.block_labels(r)
            # CONTENT signal is the discriminator, in priority order:
            if relevance_fn is not None:              #  (1) explicit model/embedding judge
                content = 9.0 * float(relevance_fn(query, block_text(r), lab))
            elif qv is not None:                      #  (2) EMBEDDING cosine (sealed vector, else on the fly)
                bvec = lab.get("embedding")
                # A sealed vector is only sound in the CURRENT embedder's space;
                # cross-space cosines are garbage. A lens can LIFT sealed BASE
                # vectors into its space (one sparse matvec — no re-embedding);
                # anything else mismatched re-embeds on the fly.
                if bvec is not None and not embmod.compatible(
                        lab.get("embedding_fingerprint"), cur_fp):
                    bvec = (self.embedder.lift(bvec, lab.get("embedding_fingerprint"))
                            if hasattr(self.embedder, "lift") else None)
                if bvec is None:
                    bvec = self.embedder.embed(block_text(r))
                content = 9.0 * _cos(qv, bvec)
            else:                                     #  (3) lexical fallback (literal overlap only)
                bK, bE = set(lab.get("keywords", [])), set(lab.get("entities", []))
                btok = set(tokens(block_text(r)))
                label_tokens = (bK | bE) if r.get("payload", {}).get("labels") else btok
                content = (
                    5.0 * jaccard(qE, bE)
                    + 3.0 * jaccard(qK, bK)
                    + 4.0 * jaccard(qtok, label_tokens)
                    + 3.0 * jaccard(qtok, btok)
                )
            if content <= 0.0:                        # no relatedness -> skip (prevents bloat)
                continue
            bS = {s["id"] for s in lab.get("senses", [])}
            bM = {m["id"] for m in lab.get("modalities", [])}
            faculty = 0.7 * len(qS & bS) + 0.7 * len(qM & bM)   # shared lenses: secondary booster
            semantic = min(1.0, content / 9.0)
            path_score = path_proximity(r, filters, hints)
            role_name = ring_data(r).get("path_role") or ""
            noise_penalty = {
                "source": 0.0,
                "config": 0.01,
                "docs": 0.03,
                "test": 0.035,
                "vendor": 0.06,
                "generated": 0.08,
            }.get(role_name, 0.02)
            raw.append({"ring": r, "lab": lab, "content": content, "semantic": semantic,
                        "path": path_score, "faculty": faculty, "noise_penalty": noise_penalty})

        anchors = sorted(raw, key=lambda x: x["semantic"], reverse=True)[:3]
        anchor_indices = [x["ring"]["index"] for x in anchors]
        # The TRAINED scorer (an adopted operator) replaces the hand blend when
        # active — unless the caller forces `scorer="hand"` or passes explicit
        # weight overrides (a co-evolver override always wins over a learner).
        hand_weights_default = (semantic_weight, path_weight, chronological_weight) == (0.70, 0.20, 0.10)
        use_trained = (scorer == "auto" and self.trained_scorer is not None
                       and hand_weights_default)
        scored = []
        for item in raw:
            r, lab = item["ring"], item["lab"]
            chronological = 0.0
            if anchor_indices:
                chronological = max(max(0.0, 1.0 - abs(r["index"] - idx) / 4.0) for idx in anchor_indices)
            parts = {
                "semantic": round(item["semantic"], 3),
                "path": round(item["path"], 3),
                "chronological": round(chronological, 3),
                "faculty": round(min(1.0, item["faculty"] / 4.0), 3),
                "noise_penalty": round(item["noise_penalty"], 3),
                # quantity-bearing blocks matter to quantity-seeking queries —
                # the buried passing-remark number a topic label never shows
                "quantity": 1.0 if (quantity_seeking and lab.get("quantities")) else 0.0,
            }
            if use_trained:
                score = learnermod.apply_scorer(self.trained_scorer, parts,
                                                lab.get("salience", 0))
            else:
                score = (
                    semantic_weight * item["semantic"]
                    + path_weight * item["path"]
                    + chronological_weight * chronological
                    + 0.05 * parts["faculty"]
                    + 0.06 * parts["quantity"]
                    + 0.03 * (lab.get("salience", 0) / 255)
                    - item["noise_penalty"]   # no recency term: relevance/path/anchors decide
                    #                            selection; time is orientation only (below)
                )
            scored.append((score, r, lab, parts))
        scored.sort(key=lambda x: x[0], reverse=True)

        # Local overlay seam: an optional recall_overlay.py beside this file may
        # re-rank the scored candidates (bounded, audit-stamped in score_parts).
        # The module is a LOCAL organ — absent from the published bundles — and
        # the seam is neutral: no overlay, no effect; a broken overlay must
        # never break recall. no_overlay=True recovers ground-truth ranking.
        if scored and not no_overlay:
            try:
                import recall_overlay
                scored = recall_overlay.rerank(self.tc.root, scored) or scored
            except ImportError:
                pass
            except Exception:
                pass

        # appetite: dissonance is the need signal. Low need -> pull little/none.
        # When the learner has CALIBRATED the curve (P(blocks fetched | dissonance)
        # from real fetch behaviour, adopted under policy guards), it replaces the
        # hand formula; otherwise the formula stands.
        appetite_curve = (self.policy.get("appetite") or {}).get("calibrated")
        bucket = None
        if appetite_curve:
            bucket = next((b for b in appetite_curve.get("curve", [])
                           if b["lo"] <= dissonance <= b["hi"]), None)
        if bucket is not None:
            # CEILING, not round: appetite is a CAP, not a quota. A bucket mean
            # of 0.25 means "one block every four turns of demand" — rounding it
            # to a permanent per-turn cap of 0 starves retrieval forever (the
            # second face of the v3.21 starvation incident). Any nonzero
            # historical demand permits at least one block; the score threshold
            # still decides whether anything actually returns.
            import math as _math
            appetite = min(max_blocks, max(0, _math.ceil(bucket["mean_fetched"])))
        elif dissonance < 50:
            appetite = 0
        else:
            appetite = max(1, round(max_blocks * dissonance / 255))
        has_hard_filter = any([path, dir, language, extension, role, top_dir, source_only,
                               exclude_path, exclude_dir, date_lo])
        if has_hard_filter and scored:
            appetite = max(1, appetite)
        top = scored[0][0] if scored else 0.0
        if use_trained:
            threshold = 0.5 * top    # trained scores are probability-shaped: the hand
            #                          absolute floor doesn't translate; relative cut only
        else:
            floor = 0.08 if has_hard_filter else 0.18
            threshold = max(floor, 0.5 * top)         # absolute floor + relative: no junk, no bloat

        chosen, used, chosen_indices = [], 0, set()
        rings_by_index = {r["index"]: r for r in rings}
        chunks_by_group = {}
        for r in rings:
            group = neighbor_group_key(r)
            ci = ring_data(r).get("chunk_index")
            if group[0] and ci is not None:
                chunks_by_group.setdefault(group, {})[ci] = r

        for score, r, lab, parts in scored:
            if len(chosen) >= appetite or score < threshold:
                break
            excerpt = excerpt_text(block_text(r), query=query, words=60)
            cost = approx_tokens(excerpt)
            if used + cost > budget_tokens:
                break
            block = brief_block(r, score=score, lab=lab, query=query)
            block["score_parts"] = parts
            block["neighbors"] = []
            chosen.append(block)
            chosen_indices.add(r["index"])
            used += cost
        if neighbors > 0 and chosen:
            for block in chosen:
                r = rings_by_index[block["index"]]
                group = neighbor_group_key(r)
                ci = ring_data(r).get("chunk_index")
                neighbor_rings = []
                if group[0] and ci is not None:
                    for offset in range(-neighbors, neighbors + 1):
                        if offset == 0:
                            continue
                        nr = chunks_by_group.get(group, {}).get(ci + offset)
                        if nr is not None:
                            neighbor_rings.append(nr)
                else:
                    for offset in range(-neighbors, neighbors + 1):
                        if offset == 0:
                            continue
                        nr = rings_by_index.get(r["index"] + offset)
                        if nr is not None and nr["index"] != 0:
                            neighbor_rings.append(nr)
                for nr in sorted(neighbor_rings, key=lambda x: x["index"]):
                    if nr["index"] in chosen_indices:
                        continue
                    excerpt = excerpt_text(block_text(nr), query=query, words=60)
                    cost = approx_tokens(excerpt)
                    if used + cost > budget_tokens:
                        break
                    block["neighbors"].append(brief_block(nr, words=45, query=query))
                    used += cost
        # ε-EXPLORATION (counterfactuals for the learner): with probability ε, ADD one
        # below-top-k candidate to the offered set. Strictly additive — it never displaces
        # a top hit and never exceeds the budget, so retrieval quality cannot degrade.
        # Its inclusion propensity is logged so training importance-weights the update
        # (IPS) instead of mistaking exploration luck for relevance.
        explore_info = {}
        eps = float((self.policy.get("exploration") or {}).get("epsilon", 0.0))
        ewin = int((self.policy.get("exploration") or {}).get("window", 20))
        if eps > 0 and scored and random.random() < eps:
            pool = [(s, r, lab, parts) for (s, r, lab, parts)
                    in scored[len(chosen):len(chosen) + ewin]
                    if r["index"] not in chosen_indices]
            if pool:
                s, r, lab, parts = random.choice(pool)
                excerpt = excerpt_text(block_text(r), query=query, words=60)
                cost = approx_tokens(excerpt)
                if used + cost <= budget_tokens:
                    block = brief_block(r, score=s, lab=lab, query=query)
                    block["score_parts"] = parts
                    block["neighbors"] = []
                    block["explore"] = True
                    propensity = round(eps / len(pool), 6)
                    block["propensity"] = propensity
                    chosen.append(block)
                    chosen_indices.add(r["index"])
                    used += cost
                    explore_info[r["index"]] = propensity

        # ORIENTATION: relevance + path/anchor proximity selected WHICH blocks; present the
        # top-level hits in chain order (the arrow of time) so the model reads them in sequence.
        chosen.sort(key=lambda b: b["index"])

        # TELEMETRY (offer): the choice set this retrieval produced — every chosen
        # candidate plus the top non-chosen ones (the informative near-misses), each
        # with the features the scorer saw. This is the raw material learner three
        # trains on ("was this ring later fetched and used?"); the query itself is
        # never logged, only its hash and redacted label terms.
        cand_log, logged_neg = [], 0
        for rank, (score, r, lab, parts) in enumerate(scored):
            is_chosen = r["index"] in chosen_indices
            if not is_chosen and logged_neg >= OFFER_LOG_CAP:
                continue
            if not is_chosen:
                logged_neg += 1
            entry = {"i": r["index"], "rank": rank, "score": round(score, 4),
                     "parts": parts, "salience": lab.get("salience"),
                     "chosen": is_chosen}
            if r["index"] in explore_info:
                entry["explore"] = True
                entry["propensity"] = explore_info[r["index"]]
            cand_log.append(entry)
        self._emit("offer", {
            "query_hash": telem.query_hash(query, context),
            "query_keywords": telem.redact_terms(q["keywords"][:8]),
            "query_entities": telem.redact_terms(q["entities"][:6]),
            "dissonance": dissonance, "appetite": appetite,
            "threshold": round(threshold, 3), "considered": len(scored),
            "returned": len(chosen), "embed": bool(qv is not None),
            "use_index": bool(use_index), "scan_window": scan_window,
            "scorer": ("trained" if use_trained else "hand"),
            "weights": ({"semantic": semantic_weight, "path": path_weight,
                         "chronological": chronological_weight} if not use_trained
                        else self.trained_scorer["weights"]),
            "policy": ("topk+epsilon" if explore_info else "topk-deterministic"),
            "epsilon": eps,
            "fanout": _fanout,
            "filters_active": has_hard_filter,
            "date_window": ([date_lo, date_hi] if date_lo else None),
            "candidates": cand_log,
        })
        return {"query_labels": q, "dissonance": dissonance, "appetite": appetite,
                "threshold": round(threshold, 2), "considered": len(scored),
                "returned": len(chosen), "budget": budget_tokens, "tokens_used": used,
                "filters": {"path": normalize_path(path), "dir": normalize_path(dir), "hints": hints},
                "metadata_filters": {"language": language, "extension": extension, "role": role,
                                     "top_dir": top_dir, "exclude_path": exclude_path or [],
                                     "exclude_dir": exclude_dir or [],
                                     "source_only": source_only},
                "weights": {"semantic": semantic_weight, "path": path_weight,
                            "chronological": chronological_weight},
                "scorer": ("trained:" + self.scorer_version if use_trained else "hand:" + SCORER_VERSION),
                "explored": bool(explore_info),
                "date_window": ([date_lo, date_hi] if date_lo else None),
                "neighbors": neighbors, "blocks": chosen}

    def retrieve_multi(self, queries, context="", **kw):
        """Fan-out retrieval: one retrieve per decomposed sub-query, results
        unioned with max-score-wins per ring. Decomposition is the MODEL's job —
        aggregate and paraphrase questions are exactly where a single query loses
        to keyword noise ('total hike distance' loses to a homophone; 'Red
        Rock' + '5-mile hike' + 'weekend trail' would not have).
        Each sub-query emits its own offer event stamped with a shared fanout id,
        so per-query credit attribution survives into the learners."""
        queries = [q for q in (queries or []) if q and q.strip()]
        if not queries:
            return {"queries": [], "fanout_id": None, "returned": 0, "blocks": []}
        fanout_id = telem.query_hash(" | ".join(queries), context)[:16]
        merged, reports = {}, []
        for k, sub in enumerate(queries, start=1):
            r = self.retrieve(sub, context,
                              _fanout={"id": fanout_id, "k": k, "of": len(queries)}, **kw)
            reports.append({"query": sub, "returned": r["returned"],
                            "dissonance": r["dissonance"]})
            for b in r["blocks"]:
                cur = merged.get(b["index"])
                if cur is None or (b.get("score") or 0) > (cur.get("score") or 0):
                    b = dict(b)
                    b["matched_query"] = sub
                    merged[b["index"]] = b
        blocks = sorted(merged.values(), key=lambda b: b["index"])   # chain order
        return {"queries": reports, "fanout_id": fanout_id,
                "returned": len(blocks), "blocks": blocks}

    def gather(self, topic, entities=None, context="", quantities=False,
               floor=0.15, per_group_best=2, max_blocks=60, embed=False,
               between=None, snippet_words=80, speaker=None, provenance=None):
        """Exhaustive entity-scoped sweep — the AGGREGATE tool (V4 P1).

        retrieve() answers "what relates most?" under an appetite cap; gather()
        answers "put EVERY block that touches this topic/these entities on the
        table" — because a sum, count, ordering, or lineage is only correct if
        every term is present (multi-session aggregates fail precisely when
        one-shot top-k drops terms). Union inclusion, recall over parsimony:
            semantic >= floor  OR  an entity/label hit  OR
            (a quantity-bearing block at floor/2 when `quantities` is set).
        No appetite, no relative cut; bounded only by max_blocks (best groups
        first, per_group_best rows each). Output is a chronological TERM TABLE —
        (date, group, quantities, matched, snippet, ring) — the model sums/orders
        FROM the table and cites the rows via seal --used-rings, where the PoQ
        coverage gate audits that an aggregate cites >= aggregate_min_terms rings.
        `between=(lo, hi)` drops blocks whose KNOWN date falls outside the window;
        undated blocks stay on the table for the model to judge."""
        queries = [q.strip() for q in ([topic] + list(entities or [])) if q and q.strip()]
        if embed and self.embedder is None:
            self.embedder = embmod.get_embedder("hashing")
        cur_fp = embmod.fingerprint_of(self.embedder) if self.embedder is not None else None
        qlabs = [self.label(q, context) for q in queries]
        qvecs = ([ql.get("embedding") for ql in qlabs] if embed
                 else [None] * len(queries))
        qsets = [set(tokens(q)) for q in queries]
        ent_terms = [e.strip().lower() for e in (entities or []) if e and e.strip()]
        lo = hi = None
        if between:
            lo, hi = _norm_date(between[0]), _norm_date(between[1])
        fanout_id = telem.query_hash(" | ".join(queries), context)[:16]

        rows, considered = [], 0
        for r in self.tc.load():
            if r["index"] == 0:
                continue
            considered += 1
            date = ring_date(r)
            if lo and hi and date and not (lo <= date <= hi):
                continue
            lab = self.block_labels(r)
            text = block_text(r)
            btok = set(tokens(text))
            best_sem, matched = 0.0, None
            for q, qv, qs in zip(queries, qvecs, qsets):
                if qv is not None:
                    bvec = lab.get("embedding")
                    if bvec is not None and not embmod.compatible(
                            lab.get("embedding_fingerprint"), cur_fp):
                        bvec = (self.embedder.lift(bvec, lab.get("embedding_fingerprint"))
                                if hasattr(self.embedder, "lift") else None)
                    if bvec is None:
                        bvec = self.embedder.embed(text)
                    sem = embmod.cosine(qv, bvec)
                else:
                    bK, bE = set(lab.get("keywords", [])), set(lab.get("entities", []))
                    sem = (0.55 * jaccard(qs, (bK | bE) or btok)
                           + 0.45 * jaccard(qs, btok))
                if sem > best_sem:
                    best_sem, matched = sem, q
            # entity/label hit: the term literally present in the block's own
            # handles or text — reachable even where cosine runs cold
            label_blob = " ".join(lab.get("entities", []) + lab.get("keywords", [])).lower()
            ent_hit = None
            for e in ent_terms:
                if e in label_blob or (e in btok if " " not in e else e in text.lower()):
                    ent_hit = e
                    break
            quants = lab.get("quantities") or []
            if not (best_sem >= floor or ent_hit is not None
                    or (quantities and quants and best_sem >= floor * 0.5)):
                continue
            # V5 facet filter: WHO spoke / WHO asserted — sealed facets when
            # present, computed on the fly for pre-V5 blocks
            if speaker or provenance:
                fr, fp = lab.get("roles"), lab.get("provenance")
                if fr is None and fp is None:
                    fac = speaker_facets(text)
                    fr, fp = fac["roles"], fac["provenance"]
                if speaker and speaker not in (fr or []):
                    continue
                if provenance and provenance != fp:
                    continue
            # V5 mention grain: the full sentence(s) where the matched terms
            # live — values read in place, not through a topical keyhole
            m_terms = ([ent_hit] if ent_hit
                       else [t for t in tokens(topic) if len(t) > 2][:6])
            m_need = 1 if ent_hit else max(1, (len(m_terms) + 1) // 2)
            mention = mention_sentences(text, m_terms, need=m_need)
            rows.append({
                "index": r["index"], "ring_hash": r["ring_hash"][:12],
                "date": date, "group": ring_group(r),
                "score": round(best_sem, 3),
                "matched": (f"label:{ent_hit}" if (ent_hit and best_sem < floor) else matched),
                "quantities": quants,
                "keywords": (lab.get("keywords") or [])[:6],
                # the value clauses VERBATIM — topical snippets drop the numbers;
                # quote from CONTENT only (block_text concatenates payload
                # metadata, which must never masquerade as a value)
                "quote": (value_sentences((r.get("payload") or {}).get("content") or text)
                          if quants else None),
                "mention": mention,
                "deixis": annotate_deixis(mention or "", date),
                "snippet": excerpt_text(text, query=topic, words=snippet_words),
            })

        by_group = {}
        for row in rows:
            by_group.setdefault(row["group"], []).append(row)
        kept = []
        for items in by_group.values():
            # within a group, a quantity-bearing row outranks a slightly-better
            # topical one when the question is an aggregate — the number IS the term
            items.sort(key=lambda x: ((1 if (quantities and x["quantities"]) else 0),
                                      x["score"]), reverse=True)
            kept.append(items[:max(1, per_group_best)])
        kept.sort(key=lambda items: max(x["score"] for x in items), reverse=True)
        table, total = [], 0
        for items in kept:
            if total >= max_blocks:
                break
            take = items[:max(0, max_blocks - total)]
            table.extend(take)
            total += len(take)
        table.sort(key=lambda x: (x["date"] or "9999-99-99", x["index"]))

        # TELEMETRY (offer): a gather is an offer set like any retrieval — every
        # row is `chosen` (exhaustive semantics), so fetch/use credit flows to
        # the same learners. policy field marks the regime for the analysts.
        self._emit("offer", {
            "query_hash": telem.query_hash(topic, context),
            "query_keywords": telem.redact_terms((qlabs[0].get("keywords") or [])[:8]),
            "query_entities": telem.redact_terms((qlabs[0].get("entities") or [])[:6]),
            "dissonance": qlabs[0].get("dissonance"), "appetite": max_blocks,
            "threshold": floor, "considered": considered, "returned": len(table),
            "embed": bool(embed), "scorer": "gather:" + SCORER_VERSION,
            "policy": "gather-exhaustive",
            "fanout": {"id": fanout_id, "k": 1, "of": len(queries)},
            "filters_active": bool(lo and hi),
            "candidates": [{"i": x["index"], "rank": k, "score": x["score"],
                            "parts": {"semantic": x["score"],
                                      "quantity": 1.0 if x["quantities"] else 0.0},
                            "salience": None, "chosen": True}
                           for k, x in enumerate(table[:OFFER_LOG_CAP])],
        })
        # V5 event-identity clustering: same event, N drifting re-mentions —
        # marked on the rows, conflicts surfaced (quantities mode only: the
        # signature heuristic needs values to anchor on)
        events = cluster_events(table) if quantities else []
        return {"topic": topic, "queries": queries, "fanout_id": fanout_id,
                "considered": considered, "included": len(rows),
                "returned": len(table), "groups": len(by_group),
                "between": ([lo, hi] if (lo and hi) else None), "floor": floor,
                "rows": table, "events": events}

    def track(self, entity, context="", embed=False, floor=0.12, max_rows=24,
              between=None, snippet_words=60):
        """Update lineage (V4 P3): every mention of ONE entity, in time order,
        each row carrying its MENTION sentences and any values found in them —
        because "what is X now?" and "what was X before?" are the same question
        read at different rows of one table (a common failure mode: knowledge-update
        misses picked the wrong mention, or answered the current value when asked
        for the previous). Latest-wins is read OFF the table: CURRENT = the last
        dated row, PREVIOUS = the row before it. Undated mentions are listed
        separately and never annotated — a lineage is only as honest as its
        timestamps. The model verifies values; cite rows via seal --used-rings."""
        terms = list(tokens(entity)) or [entity.lower()]
        need = max(1, (len(terms) + 1) // 2)

        def mention_of(text):
            sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]
            keep = []
            for s in sents:
                low = s.lower()
                n = sum(1 for t in terms
                        if t in low or (t.endswith("s") and t[:-1] in low)
                        or (not t.endswith("s") and t + "s" in low))
                if n >= need:
                    keep.append(s)
            return " … ".join(keep[:2])[:400] or None

        def values_of(text):
            # looser than the quantities LABEL (number+unit): a lineage value may
            # put the unit first ("level 150") or stand bare ("100") — the label
            # extractor stays strict (it feeds sealed labels), this stays local
            vals = list(quantities(text))
            for m in re.finditer(r"(?:([A-Za-z]{2,})\s+)?(\$?\d[\d,]*(?:\.\d+)?%?)", text or ""):
                unit, num = m.group(1), m.group(2)
                v = f"{unit.lower()} {num}" if unit else num
                if not any(num in x for x in vals) and v not in vals:
                    vals.append(v)
            return vals[:8]

        g = self.gather(entity, entities=[entity], context=context, quantities=True,
                        floor=floor, per_group_best=2, max_blocks=max_rows,
                        embed=embed, between=between, snippet_words=snippet_words)
        by_idx = {r["index"]: r for r in self.tc.load()}
        dated, undated = [], []
        for row in g["rows"]:
            ring = by_idx.get(row["index"])
            text = block_text(ring) if ring else row["snippet"]
            m = mention_of(text)
            entry = {"index": row["index"], "date": row["date"], "group": row["group"],
                     "score": row["score"],
                     "mention": m or row["snippet"][:200],
                     "weak": m is None,                       # no literal mention sentence
                     "values": values_of(m) if m else (row["quantities"] or []),
                     # V5: deixis inside the mention resolved against ITS row's date
                     "deixis": annotate_deixis(m or "", row["date"])}
            (dated if row["date"] else undated).append(entry)
        dated.sort(key=lambda x: (x["date"], x["index"]))
        # Annotation trusts only LITERAL mentions: a weak row (entity tokens
        # scattered, no mention sentence) stays on the table for the model to
        # judge but never becomes CURRENT/PREVIOUS — a later passing allusion
        # must not outrank the real latest value.
        strong = [x for x in dated if not x["weak"]]
        basis = strong if strong else dated
        current = basis[-1] if basis else None
        previous = basis[-2] if len(basis) > 1 else None
        # V5: cluster re-mentions of the same underlying event so a thrice-told
        # story doesn't masquerade as three lineage steps
        events = cluster_events(dated, text_key="mention")
        return {"entity": entity, "rows": dated, "undated": undated,
                "current": current, "previous": previous, "events": events}

    def endpoints(self, a, b, context="", top=3, embed=False, **kw):
        """Dual-endpoint retrieval for interval questions (V4 P2): "how many days
        between A and B" / "how long since A when B" needs BOTH anchors — the
        official run's temporal misses were mostly one endpoint never retrieved,
        and one wrong number is worse than none. Each endpoint gets its own
        targeted retrieval (top hits only); the candidate interval is computed
        from the two top hits' block dates as a STARTING POINT the model must
        verify — when the mention is deictic ('yesterday I went…'), resolve it
        against the MENTION's own session date (almanac.resolve(expr,
        session_date)), never the asking date."""
        result = {}
        by_idx = {ring["index"]: ring for ring in self.tc.load()}
        for key, qtext in (("a", a), ("b", b)):
            r = self.retrieve(qtext, context, max_blocks=top, neighbors=0,
                              embed=embed, **kw)
            hits = []
            for blk in r["blocks"]:
                ring = by_idx.get(blk["index"])
                hits.append({"index": blk["index"], "score": blk.get("score"),
                             "date": ring_date(ring) if ring else None,
                             "group": ring_group(ring) if ring else None,
                             "excerpt": blk.get("excerpt")})
            hits.sort(key=lambda h: -(h["score"] or 0))
            result[key] = {"query": qtext, "hits": hits}
        interval = None
        da = next((h["date"] for h in result["a"]["hits"] if h["date"]), None)
        db = next((h["date"] for h in result["b"]["hits"] if h["date"]), None)
        if da and db:
            import almanac
            iv = almanac.days_between(da, db)
            if iv:
                interval = {"a_date": da, "b_date": db,
                            "days": iv[0], "days_inclusive": iv[1],
                            "note": "candidate only — verify each anchor's EVENT "
                                    "date against its mention (deixis resolves to "
                                    "the mention's session date)"}
        result["interval"] = interval
        return result

    # ------------------------------------------------------------------ #
    # Evidence assembly (V4 P5): one call -> a model-ready package
    # ------------------------------------------------------------------ #

    QUESTION_WORDS = {"how", "many", "much", "often", "what", "where", "when", "who",
                      "which", "did", "do", "does", "have", "had", "was", "were", "is",
                      "are", "currently", "current", "previous", "previously", "long",
                      "ago", "before", "now", "first", "last", "get", "go", "new",
                      "initially", "total", "number", "time", "times", "day", "days"}

    def question_entities(self, question, cap=4):
        """Mechanical fallback for entity decomposition — named entities first,
        then question-word-filtered keywords. YOU (the model) override this by
        passing explicit entities; the heuristic exists so headless callers get
        something sane (lesson: 'how many' is not an entity)."""
        ents = entities(question)
        if ents:
            return ents[:cap]
        return [t for t in tokens(question) if t not in self.QUESTION_WORDS][:cap]

    def classify_question(self, question, asked_on=None):
        """Heuristic question shapes — the routing fallback. Multiple shapes may
        apply; the FIRST is primary. The model's own judgment outranks this."""
        import almanac
        ql = question.lower()
        shapes = []
        if asked_on and almanac.find_in_text(question, asked_on):
            shapes.append("relative")
        if (re.search(r"\b(days|weeks|months|years|hours)\b.*\b(passed|between)\b", ql)
                or re.search(r"\bhow long (had|have|did|was)\b", ql)
                or re.search(r"\bhow (old|many (days|weeks|months|years))\b", ql)):
            shapes.append("interval")
        if (re.search(r"\b(order|sequence)\b", ql)
                or re.search(r"\b(first to last|earliest to latest)\b", ql)
                or re.search(r"which .* (first|last)", ql)):
            shapes.append("ordering")
        if re.search(r"\bhow (many|much)\b|\b(total|percentage|percent|average|combined|"
                     r"altogether|in all)\b", ql):
            shapes.append("aggregate")
        if re.search(r"\b(currently|current|now|previous|previously|initially|"
                     r"most recent|latest|still)\b", ql):
            shapes.append("update")
        if not shapes:
            shapes.append("narrow")
        return shapes

    def _rank_groups(self, query, context="", embed=False):
        """Deterministic group ranking by best-block relevance — the proven
        packaging path. No appetite, no relative cut: evidence
        assembly wants the top groups, period (appetite is for conversation)."""
        if embed and self.embedder is None:
            self.embedder = embmod.get_embedder("hashing")
        q = self.label(query, context)
        qv = q.get("embedding") if embed else None
        cur_fp = embmod.fingerprint_of(self.embedder) if self.embedder is not None else None
        qtok = set(tokens(query + " " + context))
        scored = []
        for r in self.tc.load():
            if r["index"] == 0:
                continue
            lab = self.block_labels(r)
            if qv is not None:
                bvec = lab.get("embedding")
                if bvec is not None and not embmod.compatible(
                        lab.get("embedding_fingerprint"), cur_fp):
                    bvec = (self.embedder.lift(bvec, lab.get("embedding_fingerprint"))
                            if hasattr(self.embedder, "lift") else None)
                if bvec is None:
                    bvec = self.embedder.embed(block_text(r))
                s = embmod.cosine(qv, bvec)
            else:
                bK, bE = set(lab.get("keywords", [])), set(lab.get("entities", []))
                btok = set(tokens(block_text(r)))
                s = 0.55 * jaccard(qtok, (bK | bE) or btok) + 0.45 * jaccard(qtok, btok)
            scored.append((s, r))
        scored.sort(key=lambda x: -x[0])
        groups, order = {}, []
        for s, r in scored:
            g = ring_group(r)
            if g not in groups:
                groups[g] = []
                order.append(g)
            groups[g].append((s, r))
        return order, groups

    @staticmethod
    def _chunk_ix(ring):
        ci = ring_data(ring).get("chunk_index")
        if ci is None:
            ci = (ring.get("payload") or {}).get("chunk")
        return ci

    def evidence(self, question, context="", asked_on=None, embed=False,
                 budget_chars=30000, shapes=None, top_sessions=5):
        """One call -> a model-ready evidence package (V4 P5) — long-horizon
        recall packaging lessons, productized:
          - NARROW BASE always: the top-ranked group ships its FULL text (a
            passing remark hides anywhere; windows can't be trusted — Ring 45),
            ranks 2..top_sessions ship the best chunk ±1 neighbor, every excerpt
            dated, chronological.
          - Shape add-ons by classification (heuristic, overridable via
            `shapes`): relative -> day-digest (gather --between resolved
            window); aggregate -> quantity term table; interval/ordering ->
            timeline; update -> lineage with PREVIOUS/CURRENT.
        Telemetry: each internal sweep logs its own offers; an `evidence` event
        records shapes and emptiness (the abstain-on-answerable signal feed)."""
        import almanac
        shapes = list(shapes) if shapes else self.classify_question(question, asked_on)
        ents = self.question_entities(question)
        out = []

        def emit_block(ring, score=None, cap=2800, full=False, group=None):
            date = ring_date(ring) or "????-??-??"
            text = block_text(ring)[:cap]
            return {"index": ring["index"], "date": date,
                    "group": group or ring_group(ring), "text": text}

        # --- narrow base ---
        order, groups = self._rank_groups(question, context, embed=embed)
        # V5 entity-overlap gate: the group shipped in FULL must actually
        # mention the question's anchors (Run-4 scar: the cuisines question
        # shipped a wedding-gifts session as its full top group). Anchors are
        # the question's PROPER NOUNS when it has any (discriminative — generic
        # tokens like 'restaurant' saturate wrong groups), else its entities.
        # If the top group has zero anchor hits and a nearby group has them,
        # promote that group. Mechanical floor only — the model out-ranks it
        # by passing explicit shapes/entities.
        gate_promoted = False
        proper = []
        for sent in SENT_SPLIT_RE.split(question or ""):
            for w in sent.split()[1:]:                  # skip sentence-initial caps
                core = re.sub(r"[^A-Za-z']", "", w)
                if len(core) > 2 and core[0].isupper():
                    proper.append(core.lower())
        anchors = proper or [e.lower() for e in ents if len(e) > 2]

        def _group_anchor_hits(g):
            txt = " ".join(block_text(r) for _, r in groups[g][:6]).lower()
            return sum(1 for e in anchors if e in txt)

        if anchors and order and _group_anchor_hits(order[0]) == 0:
            for i in range(1, min(8, len(order))):
                if _group_anchor_hits(order[i]) > 0:
                    order.insert(0, order.pop(i))
                    gate_promoted = True
                    break
        base_blocks = []
        for rank, g in enumerate(order[:top_sessions]):
            items = groups[g]
            if rank == 0:
                rings = sorted((r for _, r in items),
                               key=lambda x: (self._chunk_ix(x) is None,
                                              self._chunk_ix(x) or 0, x["index"]))
                full_text = "".join(block_text(r) for r in rings)[:14000]
                base_blocks.append({"index": rings[0]["index"], "date": ring_date(rings[0]),
                                    "group": g, "text": full_text, "full": True})
            else:
                best = items[0][1]
                ci = self._chunk_ix(best)
                text = block_text(best)
                if ci is not None:
                    sibs = {self._chunk_ix(r): r for _, r in items}
                    parts = [block_text(sibs[i]) for i in (ci - 1, ci, ci + 1) if i in sibs]
                    text = "".join(parts)
                base_blocks.append({"index": best["index"], "date": ring_date(best),
                                    "group": g, "text": text[:2800], "full": False})
        base_blocks.sort(key=lambda b: (b["date"] or "9999", b["index"]))
        out.append({"kind": "narrow", "blocks": base_blocks})

        # --- shape add-ons ---
        if "relative" in shapes and asked_on:
            hit = almanac.find_in_text(question, asked_on)
            if hit:
                win = (hit[0]["from"], hit[0]["to"])
                g = self.gather(question, context=context, between=win, embed=embed,
                                floor=0.0, per_group_best=2, max_blocks=40,
                                snippet_words=90)
                out.append({"kind": "day-digest", "expr": hit[0]["expr"],
                            "window": list(win), "rows": g["rows"]})
        if "aggregate" in shapes:
            g = self.gather(question, entities=ents, context=context, quantities=True,
                            embed=embed, floor=0.18 if embed else 0.15,
                            per_group_best=2, max_blocks=60, snippet_words=100)
            out.append({"kind": "term-table", "entities": ents, "rows": g["rows"],
                        "events": g.get("events")})
        if ("interval" in shapes or "ordering" in shapes) and "relative" not in shapes:
            g = self.gather(question, entities=ents, context=context, quantities=False,
                            embed=embed, floor=0.2 if embed else 0.15,
                            per_group_best=1, max_blocks=30, snippet_words=70)
            out.append({"kind": "timeline", "rows": g["rows"]})
        if "update" in shapes:
            tr = self.track(" ".join(ents[:3]) or question, context=context, embed=embed,
                            max_rows=20)
            out.append({"kind": "lineage", "entity": tr["entity"], "rows": tr["rows"],
                        "current": tr["current"], "previous": tr["previous"],
                        "events": tr.get("events")})

        empty = all(not (s.get("blocks") or s.get("rows")) for s in out)
        self._emit("evidence", {"shapes": shapes, "sections": [s["kind"] for s in out],
                                "empty": empty, "gate_promoted": gate_promoted})
        return {"question": question, "asked_on": asked_on, "shapes": shapes,
                "sections": out, "empty": empty, "gate_promoted": gate_promoted,
                "text": render_evidence(question, asked_on, shapes, out, budget_chars)}

    def verify_source(self, repo_path, ring_index):
        rings = {r["index"]: r for r in self.tc.load()}
        ring = rings.get(ring_index)
        if not ring:
            return {"ring_index": ring_index, "verdict": "missing-ring", "ok": False}
        data = ring_data(ring)
        rel = ring_path(ring)
        loc = ring_location(ring)
        if not rel:
            return {"ring_index": ring_index, "verdict": "no-source-path", "ok": False,
                    "location": loc}

        repo = Path(repo_path)
        file_path = repo / rel
        result = {
            "ring_index": ring_index,
            "location": loc,
            "repo_path": str(repo),
            "file_path": str(file_path),
            "path_exists": file_path.exists(),
            "expected": {
                "git_commit": data.get("git_commit"),
                "git_branch": data.get("git_branch"),
                "git_dirty": data.get("git_dirty"),
                "file_content_hash": data.get("file_content_hash"),
                "content_hash": data.get("content_hash"),
            },
            "current": current_git_info(repo),
        }
        if not file_path.exists():
            result.update({"verdict": "missing-source-file", "ok": False})
            self._emit("falsify", {"ring_index": ring_index, "verdict": "missing-source-file"})
            return result

        text = file_path.read_text(errors="replace")
        file_hash = sha256_text(text)
        result["current"]["file_content_hash"] = file_hash
        result["file_hash_match"] = bool(data.get("file_content_hash") and data.get("file_content_hash") == file_hash)

        line_start, line_end = data.get("line_start"), data.get("line_end")
        chunk_hash_match = None
        if line_start is not None and line_end is not None and not data.get("redacted"):
            lines = text.splitlines(keepends=True)
            chunk_text = "".join(lines[max(0, int(line_start) - 1):int(line_end)])
            chunk_hash = sha256_text(chunk_text)
            result["current"]["content_hash"] = chunk_hash
            chunk_hash_match = bool(data.get("content_hash") and data.get("content_hash") == chunk_hash)
        result["chunk_hash_match"] = chunk_hash_match

        expected_commit = data.get("git_commit")
        current_commit = result["current"].get("git_commit")
        revision_match = bool(expected_commit and current_commit and expected_commit == current_commit)
        result["revision_match"] = revision_match if expected_commit and current_commit else None

        source_ok = result["file_hash_match"] and (chunk_hash_match is not False)
        if not source_ok:
            verdict = "source-mismatch"
        elif result["revision_match"] is False:
            verdict = "revision-drift"
        elif result["current"].get("git_dirty"):
            verdict = "dirty-worktree"
        else:
            verdict = "verified"
        result["verdict"] = verdict
        result["ok"] = verdict == "verified"
        if not result["ok"]:
            # TELEMETRY (falsify): a sealed memory failed against live source —
            # negative resonance. Severity is in the verdict: 'source-mismatch'
            # is a hard falsification; drift/dirty are softer staleness signals.
            self._emit("falsify", {"ring_index": ring_index, "verdict": verdict,
                                   "file_hash_match": result.get("file_hash_match"),
                                   "chunk_hash_match": result.get("chunk_hash_match"),
                                   "revision_match": result.get("revision_match")})
        return result

    def answer(self, question, answer_text, used_rings, context="", embed=False):
        """Cited-answers mode (V5): no span, no assertion.

        Run 4's biggest discipline win was a verbatim cite on every answer —
        this is that protocol as an organ. Every clause of `answer_text` is
        grounded by the span guard against the DECLARED evidence rings; an
        unsupported span is an uncited claim that must be revised, hedged, or
        dropped before the answer ships. The guard names spans for the model
        (the final judge) — it never silently rejects; the model decides whether
        an 'unsupported' span is a paraphrase of real support or a fabrication."""
        import guard as guardmod
        by_idx = {r["index"]: r for r in self.tc.load()}
        rings = [by_idx[i] for i in (used_rings or []) if i in by_idx]
        rep = guardmod.guard_report(answer_text, rings,
                                    context=(question + " " + (context or "")).strip(),
                                    embedder=self.embedder if embed else None)
        cited = bool(rings) and rep["n_unsupported"] == 0
        self._emit("answer", {
            "cited": cited, "n_spans": rep["n_spans"],
            "n_unsupported": rep["n_unsupported"],
            "span_grounding": rep["span_grounding"],
            "used_rings": list(used_rings or []),
            "computed_credit": rep["credit"],
        })
        return {"cited": cited, "report": rep,
                "rings": [r["index"] for r in rings]}

    def seal(self, ring_type, summary, context="", external_scores=None, difficulty=0, files=None,
             window=POQ_WINDOW, relevant_rings=None, use_index=False, used_rings=None,
             at_risk=None, frame=None):
        """`used_rings` is the model's DECLARED credit assignment: the ring indices
        whose content actually grounded this thought. Declaring them (a) fills the
        PoQ relevance window with exactly that evidence, so the conscience audits
        the claim against what the model says it relied on, and (b) logs the `use`
        telemetry that turns this turn into a training example.

        `at_risk` (V5) is the structured claims register: the specific claims in
        this thought the model judges most likely to be wrong. Run-4 evidence:
        uncertainty-led seals that NAMED their risky claims pre-registered the
        actual misses — making that a structured field turns conscience output
        into calibration data (telemetry logs the count; the ring carries the
        claims; a later falsify against this ring scores the register)."""
        labels = self.label(summary, context)
        if used_rings and not relevant_rings:
            by_idx = {r["index"]: r for r in self.tc.load()}
            relevant_rings = [by_idx[i] for i in used_rings if i in by_idx]
        extra = {"labels": labels}
        if at_risk:
            extra["at_risk"] = [str(c)[:300] for c in at_risk][:12]
        # v3.12 auto-registration (self-audit: 1 of 1,413 rings carried an
        # at-risk register — opt-in calibration never happens). High-assert
        # spans with weak/no support are auto-registered as at-risk when the
        # model didn't register anything itself. Opt-out: CT_AUTO_ATRISK=0.
        elif _os_env_true("CT_AUTO_ATRISK", default=True):
            try:
                import guard as _guardmod
                _rings = relevant_rings or []
                if _rings:
                    _rep = _guardmod.guard_report(summary, _rings, context or "")
                    risky = [s["text"][:300] for s in _rep.get("spans", [])
                             if s.get("status") == "unsupported"][:6]
                    if risky:
                        extra["at_risk"] = risky
                        extra["at_risk_auto"] = True
            except Exception:
                pass
        verdict, ring = gate_and_seal(self.tc, summary, context, ring_type=ring_type,
                                      difficulty=difficulty, external_scores=external_scores,
                                      files=files, extra_payload=extra,
                                      window=window, relevant_rings=relevant_rings, use_index=use_index,
                                      # the coverage gate audits aggregates against the
                                      # DECLARED evidence count (None = nothing declared)
                                      declared_evidence=(len(used_rings)
                                                         if used_rings is not None else None),
                                      frame=frame)   # declared content provenance (topological)
        # TELEMETRY (use): the turn's outcome — every gate decision is a labeled
        # event (a REVISE/FORCE_UNCERTAINTY is signal too, not just a SEAL).
        self._emit("use", {
            "decision": verdict["decision"],
            "sealed_ring": ring["index"] if ring else None,
            "used_rings": list(used_rings or []),
            "cited_rings": [c["index"] for c in verdict.get("cited_rings", [])
                            if isinstance(c, dict)],
            # computed_credit: which rings the TEXT actually leaned on, span by
            # span (the guard's map) — alongside what the model DECLARED it used.
            "computed_credit": (verdict.get("span_grounding") or {}).get("credit"),
            "span_unsupported": (verdict.get("span_grounding") or {}).get("n_unsupported"),
            "grounding": verdict.get("grounding"),
            "assertiveness": verdict.get("assertiveness"),
            "brightness": verdict.get("brightness"),
            "external_scores": bool(external_scores),
            # V5 calibration feed: how many claims this seal pre-registers as
            # at risk (the claims themselves live in the ring, not the log)
            "at_risk_n": len(at_risk or []),
        })
        return verdict, ring, labels



# --------------------------------------------------------------------------- #
# CLI — physically split into recall_cli.py (v3.15). recall.py stays the
# engine; the command surface below is a thin delegation so every existing
# invocation (python3 recall.py turn/seal/retrieve/...) works unchanged.
# --------------------------------------------------------------------------- #

def main(argv=None):
    import recall_cli
    return recall_cli.main(argv)


def __getattr__(name):
    """Back-compat seam: pre-split callers imported cmd_* / build_parser /
    _loop_seal from recall directly. Delegate lazily to recall_cli (PEP 562)
    so the physical split breaks no one."""
    import recall_cli
    try:
        return vars(recall_cli)[name]
    except KeyError:
        raise AttributeError(f"module 'recall' has no attribute {name!r}") from None


if __name__ == "__main__":
    raise SystemExit(main())
