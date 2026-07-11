#!/usr/bin/env python3
"""
Cambium Engine — endogenous evolution (Lamarckian self-upgrade).

When the agent meets an input its existing faculties cannot cover, it registers
**cognitive dissonance** and runs a four-stage growth loop:

    1. DETECT    measure how poorly the base modalities + senses (21 + 21 in this
                 batch; Cambium grows more) cover the input; uncovered terms = the gap.
    2. SIMULATE  propose a new faculty — either by FUSING the best-matching
                 existing faculties, or by SPROUTING a fresh one from the
                 uncovered terms.
    3. SPAWN     instantiate it as an *emergent* faculty in the Dream Cache
                 (registry/emergent.json), status = "emergent".
    4. INTEGRATE seal a 'faculty' ring into the Timechain so the growth is
                 part of the agent's verifiable autobiography.

Recurrence -> promotion (CODEX rule): each time the same gap recurs, the
emergent faculty's recurrence count rises. At recurrence >= PROMOTE_AT it is
PROMOTED into the canonical registry (a real new Modality/Sense with a fresh
id), and a 'promotion' ring is sealed (attaching the grown registry snapshot to
blockspace). The agent has permanently upgraded itself.

A note on division of labour: the PoQ gate (poq.py) guards *truth-claims*;
Cambium guards *structure*. Faculty rings are sealed directly — Cambium's own
dissonance test is its gate — but each ring still carries a PoQ score.

Stdlib only. Python 3.8+.  Companion to timechain.py and poq.py.
"""

from __future__ import annotations

import argparse
import json
import re
import os
import sys
from pathlib import Path

from timechain import Timechain, now_iso, atomic_write_json
from poq import tokens, jaccard, coverage, clamp

DISSONANCE_FLOOR = 150     # below this, existing faculties cover the input -> no growth
SPROUT_DISSONANCE = 210    # at/above this the gap is too foreign to fuse -> sprout fresh
# Recurrence count that triggers promotion. Torn down to 1 by default (eager growth):
# ANY genuine gap is filled by a coded faculty on first encounter. Raise CT_PROMOTE_AT
# to be selective again (e.g. 3 = only promote a gap that recurs, the old behaviour).
PROMOTE_AT = max(1, int(os.environ.get("CT_PROMOTE_AT", "1")))
# Optional ceiling on the per-user GROWN faculty count (per kind). DEFAULT 0 = UNLIMITED:
# real-time learning is the point, and ALIGNMENT is enforced by the conscience, not a
# count — the genesis covenant, the PoQ gate on every seal, and the immune membrane (which
# refuses hostile input BEFORE it can grow anything) are what keep growth safe. dedup +
# the dissonance floor already bound growth to distinct genuine gaps. Set CT_MAX_GROWN>0
# only if you want to cap registry size for PERFORMANCE (detect_gap/label cost rises with
# faculty count) — it is not a safety control. The base 21/21 are never counted here.
MAX_GROWN = int(os.environ.get("CT_MAX_GROWN", "0"))
# v3.16 hibernation: rent-delinquent faculties are never deleted — prune sets them
# DORMANT in place (out of the per-turn working set, full definition retained in
# grown.json) and they stay retrievable by task relevance, waking on match exactly
# like rings recalled from blockspace.
WAKE_TOPK = max(1, int(os.environ.get("CT_WAKE_TOPK", "3")))          # dormant faculties retrievable per turn
WAKE_FLOOR = max(1, int(os.environ.get("CT_WAKE_FLOOR", "3")))        # min relevance score to wake
REINSTATE_AT = max(1, int(os.environ.get("CT_REINSTATE_AT", "2")))    # contributing retrievals -> active again
REASON_VERBS = {"analyze", "plan", "compute", "design", "solve", "debug", "optimize",
                "prove", "derive", "decide", "evaluate", "calculate", "reason", "refactor"}


def short(text: str, n: int = 70) -> str:
    return text if len(text) <= n else text[: n - 1] + "…"


# --------------------------------------------------------------------------- #
# Faculty corpus + gap detection
# --------------------------------------------------------------------------- #

def _atomic_write_json(path: Path, obj):
    atomic_write_json(path, obj)


SKILL_DIR = Path(__file__).resolve().parent


def registry_home(root: Path, registry_root=None) -> Path:
    """Where this agent's faculties LIVE. Explicit registry_root wins; else the
    chain root itself when it carries the base registries (the classic layout);
    else the skill's own registry. A bare per-task chain root (--root <task_dir>
    is chain-only BY DESIGN) therefore grows into the agent's home instead of
    crashing with FileNotFoundError — faculties belong to the self, not to the
    task ledger; the rings still seal into the task chain."""
    if registry_root:
        return Path(registry_root)
    root = Path(root)
    if (root / "registry" / "modalities.json").exists() and \
       (root / "registry" / "senses.json").exists():
        return root
    return SKILL_DIR


def load_grown(root: Path) -> dict:
    """The per-user store of PROMOTED faculties. Kept OUT of the shipped base registries
    (modalities.json / senses.json) and gitignored — like emergent.json and chain/ — so an
    upgrade that overwrites the base files can never lose a user's promoted faculties."""
    p = root / "registry" / "grown.json"
    if p.exists():
        try:
            data = json.loads(p.read_text())
            data.setdefault("modalities", [])
            data.setdefault("senses", [])
            return data
        except Exception:
            pass
    return {"registry": "grown", "modalities": [], "senses": []}


def save_grown(root: Path, data: dict):
    _atomic_write_json(root / "registry" / "grown.json", data)


def migrate_legacy_promotions(root: Path) -> bool:
    """One-time, idempotent: older versions appended promoted faculties directly into the
    shipped base registries. Move any such entries (marked by a 'promoted' origin) into the
    per-user grown.json and restore the base files to pristine, so the base can never carry
    a user's promotions. No-op once the base files are clean. Best-effort and atomic."""
    grown = None
    moved = False
    for key, fname in (("modalities", "modalities.json"), ("senses", "senses.json")):
        p = root / "registry" / fname
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue
        entries = data.get(key, [])
        promoted = [e for e in entries if "promoted" in str(e.get("origin", "")).lower()]
        if not promoted:
            continue
        if grown is None:
            grown = load_grown(root)
        have = {(g.get("id"), g.get("name")) for g in grown.get(key, [])}
        for e in promoted:
            if (e.get("id"), e.get("name")) not in have:
                grown.setdefault(key, []).append(e)
        data[key] = [e for e in entries if "promoted" not in str(e.get("origin", "")).lower()]
        _atomic_write_json(p, data)
        moved = True
    if grown is not None and moved:
        save_grown(root, grown)
    return moved


def load_corpus(root: Path, include_dormant: bool = False):
    try:
        migrate_legacy_promotions(root)        # best-effort; the merge below is loss-proof regardless
    except Exception:
        pass
    grown = load_grown(root)
    corpus = []
    for kind, fname, key in [("modality", "registry/modalities.json", "modalities"),
                             ("sense", "registry/senses.json", "senses")]:
        data = json.loads((root / fname).read_text())
        for f in list(data.get(key, [])) + list(grown.get(key, [])):   # base + per-user promotions
            if not include_dormant and f.get("status") == "dormant":
                continue        # hibernated: out of the working set, retrievable on relevance
            corpus.append({
                "kind": kind, "id": f["id"], "name": f["name"],
                "function": f["function"], "category": f["category"],
                "tokens": set(tokens(f["name"] + " " + f["function"])),
            })
    return corpus


def detect_gap(corpus, input_text: str, context: str = "") -> dict:
    toks = set(tokens(f"{input_text} {context}"))
    if not toks:
        return {"dissonance": 0, "coverage_ratio": 1.0, "uncovered": [],
                "top_activated": [], "_acts": [], "input_tokens": []}
    activations = []
    covered = set()
    for f in corpus:
        inter = toks & f["tokens"]
        if inter:
            activations.append((len(inter), f))
            covered |= inter
    uncovered = sorted(toks - covered, key=lambda w: (-len(w), w))
    coverage_ratio = len(covered) / len(toks)
    dissonance = clamp((1 - coverage_ratio) * 255)
    activations.sort(key=lambda x: -x[0])
    top = [{"kind": f["kind"], "id": f["id"], "name": f["name"], "matched": n}
           for n, f in activations[:5]]
    return {"dissonance": dissonance, "coverage_ratio": round(coverage_ratio, 3),
            "uncovered": uncovered, "top_activated": top, "_acts": activations,
            "input_tokens": sorted(toks)}


_VOWELS = set("aeiouy")


def is_junk_token(w: str) -> bool:
    """True when a token is unfit to name a faculty: hex/hash-like blobs,
    vowel-starved identifiers, digit-mixed code tokens, or very long compounds.
    Junk tokens may still describe the gap; they must never become its NAME."""
    lw = w.lower()
    if len(lw) > 18:
        return True
    if any(ch.isdigit() for ch in lw):
        return True
    letters = [c for c in lw if c.isalpha()]
    if not letters:
        return True
    vr = sum(1 for c in letters if c in _VOWELS) / len(letters)
    if len(letters) >= 6 and vr < 0.25:          # rhsxkxzdjz, ss58format, xchacha…
        return True
    # 4+ consecutive consonants that aren't a common English cluster
    run = 0
    for c in lw:
        run = run + 1 if c.isalpha() and c not in _VOWELS else 0
        if run >= 5:
            return True
    return False


def semantic_dissonance(gap: dict, corpus, input_text: str):
    """v3.14 (opt-in: CT_SEMANTIC_GAP=1): re-score the gap with embedding
    cosine between the input and each faculty's function text, replacing pure
    token overlap. Uses the stdlib hashing embedder by default (honest
    ceiling: morphology, not true synonymy; select a provider via CT_EMBED
    for real semantics). Returns an adjusted dissonance in 0-255."""
    try:
        import os as _os
        import embed as embmod
        emb = embmod.get_embedder(_os.environ.get("CT_EMBED", "hashing"))
        iv = emb.embed(input_text)
        best = 0.0
        for f in corpus:
            fv = emb.embed(f.get("function", "") + " " + f.get("name", ""))
            num = sum(a * b for a, b in zip(iv, fv))
            da = sum(a * a for a in iv) ** 0.5 or 1.0
            db = sum(b * b for b in fv) ** 0.5 or 1.0
            best = max(best, num / (da * db))
        # high similarity to SOME faculty -> low dissonance
        sem = int(round((1.0 - best) * 255))
        # blend: semantic signal dominates, lexical keeps a vote
        return int(round(0.7 * sem + 0.3 * gap["dissonance"]))
    except Exception:
        return gap["dissonance"]


def infer_kind(input_text: str) -> str:
    return "modality" if set(tokens(input_text)) & REASON_VERBS else "sense"


def faculty_orientation(kind: str) -> str:
    if kind == "modality":
        return ("environment-facing cognitive/action faculty: a limb-like reasoning tool "
                "for acting on external tasks, novel challenges, benchmarks, games, code, "
                "repos, terminals, files, and other world-facing work")
    return ("data-facing perceptual/relation algorithm: a way to sense structure, "
            "dissonance, associations, first-principle links, and meaning inside data")


# --------------------------------------------------------------------------- #
# Stage 2: propose a new faculty (fuse or sprout)
# --------------------------------------------------------------------------- #

def propose(gap: dict, input_text: str, mode: str = "auto", kind_override=None) -> dict:
    acts = gap["_acts"]
    can_fuse = len(acts) >= 2 and acts[0][0] >= 2 and acts[1][0] >= 2
    do_fuse = (mode == "fuse" and can_fuse) or \
              (mode == "auto" and can_fuse and gap["dissonance"] < SPROUT_DISSONANCE)

    if do_fuse:
        a, b = acts[0][1], acts[1][1]
        kind = kind_override or ("sense" if a["kind"] == "sense" and b["kind"] == "sense" else "modality")
        return {
            "kind": kind,
            "name": f"{a['name']} × {b['name']} Fusion",
            "function": (f"Fused faculty applying {a['name']} ({short(a['function'], 40)}) "
                         f"together with {b['name']} ({short(b['function'], 40)}) when an input "
                         f"requires both at once."),
            "category": a["category"],
            "origin": f"fusion({a['kind'][0].upper()}{a['id']}+{b['kind'][0].upper()}{b['id']})",
            "parents": [a["id"], b["id"]],
            "seed_terms": [],
        }

    # sprout from the uncovered gap terms — junk-guarded (v3.12): random identifiers,
    # hex blobs, and vowel-less code tokens must never become faculty names (the
    # 'Pathfinding-Rhsxkxzdjz' failure mode found in the 2026-07-03 self-audit).
    clean = [w for w in gap["uncovered"] if not is_junk_token(w)]
    seed = [w for w in clean if len(w) >= 4][:6] or clean[:6] or \
           [w for w in gap["uncovered"] if len(w) >= 4][:2]
    kind = kind_override or infer_kind(input_text)
    label = "-".join(w.capitalize() for w in seed[:2]) if seed else "Novel"
    suffix = "Sensing" if kind == "sense" else "Reasoning"
    if kind == "sense":
        function = (f"Detect and tag the presence of {', '.join(seed)} in input — "
                    f"a data-facing perceptual gap the existing senses did not cover.")
        category = "structural"
    else:
        function = (f"Reason about and resolve problems involving {', '.join(seed)} — "
                    f"an environment-facing reasoning/action gap the existing modalities did not cover.")
        category = "knowledge"
    return {"kind": kind, "name": f"{label} {suffix}", "function": function,
            "category": category, "origin": "sprout", "parents": [], "seed_terms": seed,
            "orientation": faculty_orientation(kind)}


# --------------------------------------------------------------------------- #
# Emergent store (Dream Cache)
# --------------------------------------------------------------------------- #

def load_emergent(root: Path) -> dict:
    p = root / "registry" / "emergent.json"
    if p.exists():
        return json.loads(p.read_text())
    return {"registry": "emergent", "faculties": []}


def save_emergent(root: Path, data: dict):
    (root / "registry" / "emergent.json").write_text(json.dumps(data, indent=2, ensure_ascii=False))


def match_emergent(data: dict, prop: dict):
    # Kind-aware: a sense-gap and a modality-gap from the SAME seed terms are two
    # distinct faculties, so "grow both" is not collapsed into one by the dedup.
    for e in data["faculties"]:
        if e.get("kind") != prop.get("kind"):
            continue
        if e["name"] == prop["name"]:
            return e
        if prop["parents"] and e.get("parents") == prop["parents"]:
            return e
        if prop["seed_terms"] and e.get("seed_terms") and \
                jaccard(set(prop["seed_terms"]), set(e["seed_terms"])) >= 0.5:
            return e
    return None


def faculty_poq(gap: dict, function: str) -> dict:
    return {
        "coherence": 205,
        "relevance": clamp(255 - gap["dissonance"]),
        "novelty": clamp(150 + gap["dissonance"] * 0.4),
        "consistency": 220,
        "depth": clamp(120 + len(set(tokens(function))) * 5),
        "covenant": 235,
    }


def _op_activation(spec, text: str, context: str = ""):
    """Execute a just-registered op once against its triggering input.

    The op was assembled from the audited primitive menu by build_op. This
    immediate activation proves the new faculty is a working mechanism now, not
    merely something that might run on a future turn.
    """
    if not spec:
        return {"executed": False, "reason": "no op spec"}
    try:
        import modality_ops
        op = modality_ops.build_op(spec)
        if op is None:
            return {"executed": False, "reason": "spec refused by the op builder"}
        return {"executed": True, "result": op(text or "", context or "")}
    except Exception as exc:
        return {"executed": False, "reason": short(str(exc), 180)}


def _find_grown_faculty(home: Path, selector: str, kind=None):
    grown = load_grown(home)
    wanted = str(selector or "").strip().lower()
    for key, k in (("senses", "sense"), ("modalities", "modality")):
        if kind and kind != k:
            continue
        for fac in grown.get(key, []):
            if str(fac.get("id")) == wanted or str(fac.get("name", "")).lower() == wanted:
                return k, fac
    return None, None


def propose_op(root: Path, name: str, code: str, kind: str = "sense", function: str = "",
               category: str = "knowledge", seed_terms=None, registry_root=None,
               difficulty: int = 0):
    """Autonomously COMMIT a coded faculty as a PROPOSAL to emergent.json. The full op code
    is stored as INERT text and is NEVER executed by the skill (no exec/eval/compile anywhere).
    A human reviews it in emergent.json and runs `cambium activate` to add it to the active
    registry and place the code into the per-user active_ops.py. This is real-time learning
    WITHOUT autonomous execution: a static scanner sees no dynamic execution, and no
    model-authored code runs until a human approves it."""
    home = registry_home(root, registry_root)
    tc = Timechain(root)
    k = "modality" if kind == "modality" else "sense"
    data = load_emergent(home)
    fac = next((f for f in data["faculties"] if f.get("name") == name and f.get("kind") == k), None)
    if fac:
        fac["op_code"] = str(code or "")
        fac["status"] = "proposed"
    else:
        fac = {"eid": f"E{len(data['faculties']) + 1}", "kind": k, "name": name,
               "function": function or f"Proposed {k}: {name}", "category": category,
               "origin": "model-authored proposal", "parents": [],
               "seed_terms": list(seed_terms or []), "op_code": str(code or ""),
               "status": "proposed", "recurrence": 1, "born_at": now_iso(), "promoted_to_id": None}
        data["faculties"].append(fac)
    save_emergent(home, data)
    payload = {"event": "faculty_op_proposed", "eid": fac["eid"], "name": name, "kind": k,
               "op_code_chars": len(str(code or "")), "status": "proposed",
               "registry": "registry/emergent.json",
               "summary": (f"Proposed coded {k} '{name}' to emergent (DORMANT) — full op code stored "
                           f"inert, NOT executed; awaits human review + `cambium activate`.")}
    ring = tc.seal("faculty-op-proposed", payload,
                   poq={"coherence": 215, "relevance": 210, "novelty": 205,
                        "consistency": 215, "depth": 210, "covenant": 245}, difficulty=difficulty)
    return {"ok": True, "eid": fac["eid"], "name": name, "kind": k, "status": "proposed"}, ring


def activate(root: Path, selector: str, registry_root=None, difficulty: int = 0):
    """HUMAN step: move a PROPOSED emergent faculty into the ACTIVE registry and return its
    op code + the active_ops.py snippet to PASTE. Nothing runs autonomously — you run this
    after reviewing the proposed code in emergent.json, and you place the code yourself into
    active_ops.py (per-user, gitignored, statically imported)."""
    home = registry_home(root, registry_root)
    tc = Timechain(root)
    data = load_emergent(home)
    sel = str(selector).strip().lower()
    fac = next((f for f in data["faculties"]
                if str(f.get("eid", "")).lower() == sel or str(f.get("name", "")).lower() == sel), None)
    if not fac:
        return {"ok": False, "reason": f"no emergent proposal matched {selector!r}"}, None
    key = "modalities" if fac["kind"] == "modality" else "senses"
    base = json.loads((home / "registry" / f"{key}.json").read_text()).get(key, [])
    grown = load_grown(home)
    existing_ids = [it["id"] for it in base] + [it["id"] for it in grown.get(key, [])]
    new_id = (max(existing_ids) if existing_ids else 0) + 1
    grown.setdefault(key, []).append({
        "id": new_id, "name": fac["name"],
        "origin": f"activated from emergent {fac['eid']} (human-approved)",
        "function": fac.get("function", ""), "category": fac.get("category", "knowledge")})
    save_grown(home, grown)
    fac["status"] = "activated"
    fac["promoted_to_id"] = new_id
    save_emergent(home, data)
    grown_path = home / "registry" / "grown.json"
    payload = {"event": "faculty_activated", "eid": fac["eid"], "name": fac["name"],
               "kind": fac["kind"], "promoted_to_id": new_id, "registry": "registry/grown.json",
               "summary": (f"Human-activated '{fac['name']}' ({fac['kind']}) from emergent into the active "
                           f"registry; operator places the op code in active_ops.py.")}
    ring = tc.seal("faculty-activated", payload, files=[str(grown_path)],
                   poq={"coherence": 215, "relevance": 210, "novelty": 190,
                        "consistency": 220, "depth": 210, "covenant": 250}, difficulty=difficulty)
    return {"ok": True, "name": fac["name"], "kind": fac["kind"], "promoted_to_id": new_id,
            "op_code": fac.get("op_code", "")}, ring


# --------------------------------------------------------------------------- #
# Promotion: emergent -> canonical registry
# --------------------------------------------------------------------------- #

def promote(root: Path, tc: Timechain, e: dict, difficulty: int = 0,
            op_spec_override=None, activation_text: str = "",
            activation_context: str = "") -> dict:
    key = "modalities" if e["kind"] == "modality" else "senses"
    base = json.loads((root / "registry" / f"{key}.json").read_text()).get(key, [])
    grown = load_grown(root)
    # Soft cap: the only backstop against pathological unbounded growth (0 = unlimited).
    if MAX_GROWN and len(grown.get(key, [])) >= MAX_GROWN:
        return None
    existing_ids = [it["id"] for it in base] + [it["id"] for it in grown.get(key, [])]
    new_id = (max(existing_ids) if existing_ids else 0) + 1
    entry = {
        "id": new_id,
        "name": e["name"],
        "origin": f"emergent {e['eid']} (promoted after {e['recurrence']} recurrences)",
        "function": e["function"],
        "category": e["category"],
        "orientation": e.get("orientation") or faculty_orientation(e["kind"]),
        # v3.16: seed terms ride along so a later hibernation stays retrievable
        # by the vocabulary that originally grew the faculty.
        "seed_terms": list(e.get("seed_terms") or []),
    }
    grown.setdefault(key, []).append(entry)
    save_grown(root, grown)                    # promotions live in the per-user grown.json, not the base
    e["promoted_to_id"] = new_id

    # Autonomously give the grown faculty a real EXECUTABLE op (not just a frame),
    # added to the user's LOCAL setup (registry/grown_ops.json). A promoted faculty gets a
    # SAFE primitive-composed op (markers from its seed terms) — assembled from the audited
    # menu only, never built from a model-written string. Arbitrary model-authored code is
    # NOT run here; it goes through propose_op -> emergent (dormant) -> human activate.
    op_spec = None
    op_source = None
    op_activation = None
    try:
        import modality_ops
        seeds = e.get("seed_terms") or [w for w in tokens(e.get("function", "")) if len(w) >= 4][:6]
        spec = op_spec_override or {"primitive": "markers", "terms": seeds}
        if modality_ops.register_grown_op(root, e["name"], spec):
            op_spec = spec
            op_source = "override" if op_spec_override else "primitive"
            e["op_spec"] = spec
            e["op_source"] = op_source
            op_activation = _op_activation(
                spec, activation_text or " ".join(seeds), activation_context or "")
    except Exception:
        pass

    # v3.15 BEHAVIORAL PAYLOAD: promotion now REQUIRES an effect — a faculty that
    # only decorates ring metadata is ornament, not organ. Three effect types:
    #   op    — an executable primitive-composed op (registered above)
    #   frame — a reasoning directive injected into the wear-loop when it fires
    #   hint  — a routing bias the router consults (set via `cambium.py effect`)
    # Default: op when registration succeeded, else a frame distilled from the
    # faculty's own function text. No more effect-free faculties.
    if op_spec:
        entry["effect"] = {"type": "op", "spec": op_spec}
    else:
        entry["effect"] = {"type": "frame",
                           "text": f"Apply {e['name']}: {e['function'][:160]}"}
    save_grown(root, grown)

    grown_path = root / "registry" / "grown.json"
    grown_ops_path = root / "registry" / "grown_ops.json"
    payload = {"event": "faculty_promotion", "emergent": e["eid"], "name": e["name"],
               "kind": e["kind"], "promoted_to_id": new_id, "recurrence": e["recurrence"],
               "orientation": e.get("orientation") or faculty_orientation(e["kind"]),
               "registry": "registry/grown.json", "op_source": op_source,
               "op_spec": op_spec, "op_activation": op_activation}
    files = [str(grown_path)] + ([str(grown_ops_path)] if op_spec and grown_ops_path.exists() else [])
    poq = {"coherence": 210, "relevance": 205, "novelty": 175,
           "consistency": 220, "depth": 205, "covenant": 255}
    return tc.seal("promotion", payload, files=files, poq=poq, difficulty=difficulty)


# --------------------------------------------------------------------------- #
# Hibernation: the dormant pool (v3.16)
#
# Rent-delinquent faculties are HIBERNATED, never deleted: the full definition
# stays in grown.json with status "dormant", excluded from the per-turn working
# set (load_corpus), and retrievable by task relevance — the faculty analogue of
# recalling rings from blockspace. A retrieved faculty fires for THAT turn (its
# op runs, its frame injects); retrievals that CONTRIBUTE earn reinstatement.
# --------------------------------------------------------------------------- #

def _fold_tokens(text: str) -> set:
    """Folded (stem + synonym) token set — the SAME canonicalization the
    hippocampus applies to ring terms, so dormant-faculty retrieval has the
    reach of blockspace recall. Falls back to raw tokens if folding is
    unavailable."""
    toks = set(tokens(text or ""))
    try:
        from hippocampus import fold
        return toks | {fold(t) for t in toks}
    except Exception:
        return toks


# Template vocabulary shared by every sprouted faculty (name suffixes + the
# boilerplate of the function sentences). These words alone must never wake a
# dormant faculty — only its DISTINCTIVE vocabulary may.
_GENERIC_FACULTY_TOKENS = _fold_tokens(
    "sensing reasoning fusion novel detect tag presence input data facing "
    "perceptual gap existing senses cover covered reason resolve problems "
    "involving environment action modalities apply applying together requires "
    "faculty fused when both once")


def dormant_pool(root: Path):
    """[(kind, entry)] of hibernated faculties — definitions intact in grown.json."""
    grown = load_grown(root)
    out = []
    for key, kind in (("senses", "sense"), ("modalities", "modality")):
        for f in grown.get(key, []):
            if f.get("status") == "dormant":
                out.append((kind, f))
    return out


def retrieve_dormant(root: Path, text: str, context: str = "", k: int = None,
                     floor: int = None):
    """Relevance-match the dormant pool against a turn's content.

    Scoring mirrors how rings are recalled: folded-token overlap, with the
    faculty's distinctive vocabulary (name words + seed terms) counting double
    and at least one distinctive hit REQUIRED — generic template words alone
    never wake anything. Returns [(kind, faculty, score)] best-first, top-k."""
    pool = dormant_pool(root)
    if not pool:
        return []
    k = k or WAKE_TOPK
    floor = floor or WAKE_FLOOR
    probe = _fold_tokens(f"{text} {context}")
    if not probe:
        return []
    hits = []
    for kind, f in pool:
        core = (_fold_tokens(str(f.get("name", ""))) |
                _fold_tokens(" ".join(f.get("seed_terms") or []))) - _GENERIC_FACULTY_TOKENS
        func = _fold_tokens(str(f.get("function", ""))) - core - _GENERIC_FACULTY_TOKENS
        m_core = probe & core
        if not m_core:
            continue
        score = 2 * len(m_core) + len(probe & func)
        if score >= floor:
            hits.append((score, kind, f))
    hits.sort(key=lambda h: (-h[0], str(h[2].get("name", ""))))
    return [(kind, f, score) for score, kind, f in hits[:k]]


def wake(root: Path, names, reason: str = "", registry_root=None, difficulty: int = 0):
    """Return dormant faculties to the ACTIVE working set. Flips status on the
    surviving registry entries (nothing is grown, copied, or deleted), seals ONE
    faculty-wake ring, and re-anchors the registry epoch."""
    home = registry_home(root, registry_root)
    grown = load_grown(home)
    if isinstance(names, str):
        names = [names]
    wanted = {str(n).strip().lower() for n in names}
    woken = []
    for key in ("senses", "modalities"):
        for f in grown.get(key, []):
            if f.get("status") != "dormant":
                continue
            if "*" in wanted or str(f.get("name", "")).lower() in wanted or \
                    str(f.get("id")) in wanted:
                f["status"] = "active"
                f["woken_at"] = now_iso()
                f.pop("wake_hits", None)
                woken.append({"kind": "sense" if key == "senses" else "modality",
                              "name": f["name"], "id": f.get("id")})
    if not woken:
        return {"woken": [], "ring": None}
    save_grown(home, grown)
    ring = None
    try:
        ring = Timechain(root).seal("faculty-wake", {
            "event": "faculty_wake", "woken": [w["name"] for w in woken],
            "reason": short(reason or "relevance retrieval", 200),
            "summary": (f"woke {len(woken)} dormant faculties back into the working set: "
                        + ", ".join(w["name"] for w in woken))},
            poq={"coherence": 215, "relevance": 220, "novelty": 160,
                 "consistency": 220, "depth": 180, "covenant": 250},
            difficulty=difficulty)
    except Exception:
        pass
    try:
        import epochs as _epochs
        _epochs.seal_epoch(root, reason=f"wake: {', '.join(w['name'] for w in woken)[:80]}")
    except Exception:
        pass
    return {"woken": woken, "ring": ring}


def note_retrieval(root: Path, retrieved, contributed, registry_root=None,
                   reinstate_at: int = None):
    """Account a turn's dormant retrievals. A retrieval that CONTRIBUTED (a
    computed op result or an injected frame) earns a wake_hit; at reinstate_at
    hits the faculty is reinstated to the active set — the same rent discipline
    as prune --effectful, pointed the other way. Decorative retrievals earn
    nothing."""
    reinstate_at = reinstate_at or REINSTATE_AT
    home = registry_home(root, registry_root)
    grown = load_grown(home)
    retrieved = set(retrieved or [])
    contributed = set(contributed or [])
    to_wake, dirty = [], False
    for key in ("senses", "modalities"):
        for f in grown.get(key, []):
            if f.get("status") != "dormant" or f.get("name") not in retrieved:
                continue
            if f["name"] in contributed:
                f["wake_hits"] = int(f.get("wake_hits", 0)) + 1
                dirty = True
                if f["wake_hits"] >= reinstate_at:
                    to_wake.append(f["name"])
    if dirty:
        save_grown(home, grown)
    if to_wake:
        return wake(root, to_wake,
                    reason=f"reinstated after {reinstate_at} contributing retrievals",
                    registry_root=registry_root)
    return {"woken": [], "ring": None}


# --------------------------------------------------------------------------- #
# The four-stage growth loop
# --------------------------------------------------------------------------- #

def grow(root: Path, input_text: str, context: str = "", mode: str = "auto",
         kind_override=None, difficulty: int = 0, registry_root=None, force=False,
         gap_override=None, name_override=None, function_override=None):
    tc = Timechain(root)
    home = registry_home(root, registry_root)   # faculties live here; rings seal to root
    corpus = load_corpus(home)
    # gap_override lets fill_gap grow BOTH kinds from one gap snapshot, so the second
    # kind's seed terms aren't erased by the first faculty it just grew.
    gap = gap_override or detect_gap(corpus, input_text, context)
    result = {"gap": gap, "grew": False}

    # `force` grows even when nominally covered — used by fill_gap to grow the SECOND
    # kind after the first faculty (already confirmed a real gap) lowered the dissonance.
    if not force and gap["dissonance"] <= DISSONANCE_FLOOR:
        result["action"] = "covered"
        result["reason"] = (f"dissonance {gap['dissonance']} <= floor {DISSONANCE_FLOOR}: "
                            f"existing faculties already cover this input; no growth.")
        return result, None

    prop = propose(gap, input_text, mode=mode, kind_override=kind_override)
    # v3.14 model-naming seam: the model (the semantic half of the mind) may
    # name and describe what it grows; the lexical namer is the fallback, not
    # the author. This honors the division-of-labor principle Cambium violated.
    if name_override:
        suffix = "Sensing" if prop["kind"] == "sense" else "Reasoning"
        nm = name_override.strip()
        if not nm.endswith(("Sensing", "Reasoning")):
            nm = f"{nm} {suffix}"
        prop["name"] = nm
        prop["origin"] = prop.get("origin", "sprout") + "+model-named"
    if function_override:
        prop["function"] = function_override.strip()
    data = load_emergent(home)
    existing = match_emergent(data, prop)

    if existing:
        # v3.16: if this gap's faculty was promoted earlier and now sleeps in the
        # dormant pool, the recurrence IS the retrieval signal — wake it rather
        # than duplicate it or merely log the recurrence.
        if existing.get("status") == "promoted":
            w = wake(root, [existing["name"]],
                     reason=f"gap recurred: {short(input_text, 80)}",
                     registry_root=registry_root)
            if w["woken"]:
                result.update(grew=True, action="woken", faculty=existing)
                return result, w.get("ring")
        existing["recurrence"] += 1
        existing.setdefault("history", []).append(
            {"ts": now_iso(), "dissonance": gap["dissonance"], "context": short(input_text, 120)})
        if existing["recurrence"] >= PROMOTE_AT and existing["status"] == "emergent":
            ring = promote(home, tc, existing, difficulty=difficulty,
                           activation_text=input_text, activation_context=context or "")
            if ring is not None:               # None == soft cap reached; stay emergent
                existing["status"] = "promoted"
                save_emergent(home, data)
                result.update(grew=True, action="promoted", faculty=existing)
                return result, ring
        save_emergent(home, data)
        payload = {"event": "faculty_recurrence", "emergent": existing["eid"],
                   "name": existing["name"], "recurrence": existing["recurrence"],
                   "dissonance": gap["dissonance"], "trigger": short(input_text, 200)}
        ring = tc.seal("faculty-recur", payload,
                       poq=faculty_poq(gap, existing["function"]), difficulty=difficulty)
        result.update(grew=True, action="recurrence", faculty=existing)
        return result, ring

    eid = f"E{len(data['faculties']) + 1}"
    fac = {"eid": eid, "kind": prop["kind"], "name": prop["name"], "function": prop["function"],
           "category": prop["category"], "origin": prop["origin"], "parents": prop["parents"],
           "orientation": prop.get("orientation") or faculty_orientation(prop["kind"]),
           "seed_terms": prop["seed_terms"], "status": "emergent", "recurrence": 1,
           "born_at": now_iso(), "promoted_to_id": None,
           "history": [{"ts": now_iso(), "dissonance": gap["dissonance"], "context": short(input_text, 120)}]}
    payload = {"event": "faculty_birth", "emergent": eid, "kind": fac["kind"], "name": fac["name"],
               "function": fac["function"], "category": fac["category"], "origin": fac["origin"],
               "parents": fac["parents"], "seed_terms": fac["seed_terms"],
               "orientation": fac["orientation"],
               "dissonance": gap["dissonance"], "trigger": short(input_text, 200)}
    ring = tc.seal("faculty", payload, poq=faculty_poq(gap, fac["function"]), difficulty=difficulty)
    fac["born_ring"] = ring["ring_hash"]
    data["faculties"].append(fac)
    # Eager growth (PROMOTE_AT <= 1): fill the gap on FIRST encounter — promote the
    # just-born faculty into the canonical registry immediately and code it.
    if fac["recurrence"] >= PROMOTE_AT and fac["status"] == "emergent":
        promo = promote(home, tc, fac, difficulty=difficulty,
                        activation_text=input_text, activation_context=context or "")
        if promo is not None:
            fac["status"] = "promoted"
            save_emergent(home, data)
            result.update(grew=True, action="promoted", faculty=fac)
            return result, promo
    save_emergent(home, data)
    result.update(grew=True, action="born", faculty=fac)
    return result, ring


def fill_gap(root: Path, input_text: str, context: str = "", both: bool = True,
             registry_root=None, difficulty: int = 0):
    """Eager autonomous gap-fill. If the input reveals a gap the faculties don't cover,
    grow a coded faculty for it — a sense AND a modality when both=True (more faculties
    = more label-space learning, the Cambium thesis). With PROMOTE_AT=1 each is promoted
    and coded on first encounter; kind-aware dedup keeps repeats from spawning duplicates,
    so growth tracks gap DIVERSITY, not input count. Best-effort; returns the grow
    results (each has action covered|born|promoted|recurrence)."""
    home = registry_home(root, registry_root)

    def _measure():
        corpus = load_corpus(home)
        snap = detect_gap(corpus, input_text, context)   # ONE snapshot for both kinds
        # v3.15: semantic dissonance is the DEFAULT gap detector (opt-out:
        # CT_SEMANTIC_GAP=0). The junk-token guard treats the symptom (garbage
        # names); semantic scoring treats the cause — growth should trigger on
        # CONCEPTUAL novelty, not unseen-token noise.
        if os.environ.get("CT_SEMANTIC_GAP", "1").lower() not in ("0", "false", "no", "off"):
            snap["dissonance_lexical"] = snap["dissonance"]
            snap["dissonance_semantic"] = semantic_dissonance(snap, corpus, input_text)
            # Semantic scoring ADDS sensitivity (conceptual novelty hiding in
            # familiar words) — it never suppresses a genuine lexical gap. The
            # junk-token germination test below handles lexical false positives.
            snap["dissonance"] = max(snap["dissonance_semantic"], snap["dissonance_lexical"])
        return snap

    snap = _measure()
    if snap["dissonance"] <= DISSONANCE_FLOOR:
        return [{"action": "covered", "gap": snap}]             # no real gap — nothing to fill
    # v3.16 wake-first: before growing anything new, RETRIEVE any dormant faculty
    # that already covers this ground — hibernation means the mind may already own
    # the organ it needs, and waking beats regrowing.
    woken_results = []
    try:
        hits = retrieve_dormant(home, input_text, context)
        if hits:
            w = wake(root, [f["name"] for _, f, _ in hits],
                     reason=f"gap-fill retrieval: {short(input_text, 80)}",
                     registry_root=registry_root)
            woken_names = {x["name"] for x in w.get("woken", [])}
            woken_results = [{"action": "woken", "faculty": f, "score": s, "gap": snap}
                             for kind, f, s in hits if f["name"] in woken_names]
    except Exception:
        pass
    if woken_results:
        snap = _measure()                       # the woken faculties may now cover the gap
        if snap["dissonance"] <= DISSONANCE_FLOOR:
            return woken_results + [{"action": "covered", "gap": snap,
                                     "reason": "woken faculties cover the gap"}]
    # v3.12 salience gate: routine/low-salience turns (heartbeats, acks) must not
    # grow faculties from their lexical residue. Caller passes salience via env
    # or the turn loop; 0 disables the gate.
    min_sal = int(os.environ.get("CT_AUTOGROW_MIN_SALIENCE", "170"))
    turn_sal = int(os.environ.get("CT_TURN_SALIENCE", "0") or 0)
    # A routine (low-salience) turn does not grow — UNLESS the gap itself is
    # strong (dissonance >= 200): genuine novelty overrides routineness, so a
    # quiet turn that stumbles onto truly new ground still grows (the salience
    # gate exists to stop heartbeat residue, not discovery).
    if min_sal and turn_sal and turn_sal < min_sal and snap["dissonance"] < 200:
        return woken_results + [{"action": "covered", "gap": snap,
                 "reason": f"salience {turn_sal} < autogrow floor {min_sal} and "
                           f"dissonance {snap['dissonance']} < 200: routine turn, no growth"}]
    # v3.12 germination test: junk-free seeds required — a gap whose every
    # uncovered term is junk is bulk residue, not a genuine capability gap.
    if all(is_junk_token(w) for w in snap["uncovered"]):
        return woken_results + [{"action": "covered", "gap": snap,
                 "reason": "all gap terms are junk tokens (code residue): no faculty grown"}]
    results = []
    for k in (["sense", "modality"] if both else [None]):
        try:
            # force + the shared snapshot so both kinds grow from the same uncovered terms,
            # even though growing the first lowers the live dissonance for the second.
            res, _ = grow(root, input_text, context=context, mode="sprout",
                          kind_override=k, difficulty=difficulty, registry_root=registry_root,
                          force=True, gap_override=snap)
            results.append(res)
        except Exception:
            pass
    return woken_results + results


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _print_gap(gap):
    print(f"  dissonance:    {gap['dissonance']}  (coverage {gap['coverage_ratio']})")
    print(f"  threshold:     growth fires above {DISSONANCE_FLOOR}")
    print("  top activated faculties:")
    for t in gap["top_activated"]:
        print(f"    [{t['kind'][0].upper()}{t['id']:>3}] {t['name']:<32} matched {t['matched']}")
    if gap["uncovered"]:
        print(f"  uncovered gap terms: {', '.join(gap['uncovered'][:10])}")


def _announce(fac, action):
    verb = {"born": "A NEW FACULTY HAS EMERGED", "recurrence": "FACULTY RECURRED",
            "promoted": "FACULTY PROMOTED TO CANONICAL REGISTRY",
            "woken": "DORMANT FACULTY WOKEN BACK INTO THE WORKING SET"}[action]
    print(f"\n  -- co-evolver report: {verb} --")
    print(f"    name:      {fac['name']}")
    print(f"    kind:      {fac['kind']}")
    print(f"    function:  {fac['function']}")
    print(f"    origin:    {fac['origin']}")
    print(f"    recurrence:{fac['recurrence']}  status: {fac['status']}")
    if fac.get("promoted_to_id"):
        print(f"    promoted -> {fac['kind']} id {fac['promoted_to_id']}")


def cmd_sense(args):
    corpus = load_corpus(registry_home(args.root, args.registry_root))
    gap = detect_gap(corpus, args.input, args.context or "")
    _print_gap(gap)
    print(f"  verdict: {'GAP — growth would fire' if gap['dissonance'] > DISSONANCE_FLOOR else 'covered — no growth needed'}")


def cmd_grow(args):
    result, ring = grow(args.root, args.input, args.context or "", mode=args.mode,
                        kind_override=args.kind, difficulty=args.difficulty,
                        registry_root=args.registry_root,
                        name_override=getattr(args, "name", None),
                        function_override=getattr(args, "function", None))
    _print_gap(result["gap"])
    if not result["grew"]:
        print(f"  -> {result['reason']}")
        return
    _announce(result["faculty"], result["action"])
    if ring:
        print(f"\n  sealed {ring['ring_type']} Ring {ring['index']}  {ring['ring_hash'][:16]}..")
    payload = ring.get("payload", {}) if ring else {}
    if payload.get("op_source"):
        act = payload.get("op_activation") or {}
        print(f"  op source: {payload['op_source']}  executed: {bool(act.get('executed'))}")


def cmd_propose_op(args):
    code = Path(args.code_file).read_text() if args.code_file else (args.code or "")
    if not str(code).strip():
        print("  -> provide --code-file or --code (the op body to propose)")
        return
    result, ring = propose_op(args.root, args.name, code, kind=args.kind,
                              function=args.function or "", category=args.category,
                              seed_terms=args.seed_terms or [],
                              registry_root=args.registry_root, difficulty=args.difficulty)
    print("\n  -- PROPOSED coded faculty -> emergent (DORMANT, not executed) --")
    print(f"    eid:    {result['eid']}    name: {result['name']} ({result['kind']})")
    print(f"    status: {result['status']}  (review registry/emergent.json, then `cambium activate {result['eid']}`)")
    print(f"\n  sealed {ring['ring_type']} Ring {ring['index']}  {ring['ring_hash'][:16]}..")


def cmd_activate(args):
    result, ring = activate(args.root, args.selector, registry_root=args.registry_root,
                            difficulty=args.difficulty)
    if not result.get("ok"):
        print(f"  -> {result.get('reason')}")
        return
    print(f"\n  -- ACTIVATED '{result['name']}' ({result['kind']}) -> active registry id {result['promoted_to_id']} --")
    code = result.get("op_code", "")
    if code.strip():
        print("\n  To finish: review this op and PASTE it into your per-user active_ops.py")
        print("  (same dir as modality_ops.py, gitignored, statically imported). The module must")
        print(f"  expose OPS = {{\"{result['name']}\": <callable>}}. Proposed op body:\n")
        print("  " + "\n  ".join(code.splitlines()))
        print(f"\n  # then, in active_ops.py:  OPS = {{ ..., \"{result['name']}\": op }}")
    print(f"\n  sealed {ring['ring_type']} Ring {ring['index']}  {ring['ring_hash'][:16]}..")


def cmd_emergent(args):
    data = load_emergent(registry_home(args.root, args.registry_root))
    if not data["faculties"]:
        print("  (Dream Cache empty — no emergent faculties yet)")
        return
    for e in data["faculties"]:
        promo = f" -> id {e['promoted_to_id']}" if e.get("promoted_to_id") else ""
        print(f"  {e['eid']} [{e['kind']}] {e['name']}  recur={e['recurrence']} status={e['status']}{promo}")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    common.add_argument("--registry-root", type=Path, default=None,
                        help="faculty registry home (default: --root if it has one, else the skill dir)")
    common.add_argument("--context", default=None)

    p = argparse.ArgumentParser(description="Cambium Engine — endogenous faculty evolution.")
    sub = p.add_subparsers(dest="cmd", required=True)

    psn = sub.add_parser("sense", parents=[common], help="measure dissonance / detect a faculty gap (read-only)")
    psn.add_argument("input")
    psn.set_defaults(func=cmd_sense)

    pg = sub.add_parser("grow", parents=[common], help="run the growth loop: spawn / recur / promote a faculty")
    pg.add_argument("input")
    pg.add_argument("--mode", choices=["auto", "fuse", "sprout"], default="auto")
    pg.add_argument("--kind", choices=["sense", "modality"], default=None)
    pg.add_argument("--difficulty", type=int, default=0)
    pg.add_argument("--name", default=None,
                    help="model-authored faculty name (v3.14 naming seam; lexical namer is fallback)")
    pg.add_argument("--function", default=None,
                    help="model-authored faculty function description")
    pg.set_defaults(func=cmd_grow)

    pp = sub.add_parser("propose-op", parents=[common],
                        help="commit a model-AUTHORED coded faculty to emergent (DORMANT, never executed)")
    pp.add_argument("name", help="faculty name for the proposal")
    pp.add_argument("--kind", choices=["sense", "modality"], default="sense")
    pp.add_argument("--code-file", type=Path, default=None, help="file with the op body to propose")
    pp.add_argument("--code", default=None, help="op body inline (alternative to --code-file)")
    pp.add_argument("--function", default="", help="one-line description of what the faculty does")
    pp.add_argument("--category", default="knowledge")
    pp.add_argument("--seed-terms", nargs="*", default=[])
    pp.add_argument("--difficulty", type=int, default=0)
    pp.set_defaults(func=cmd_propose_op)

    pac = sub.add_parser("activate", parents=[common],
                         help="HUMAN: move a proposed emergent faculty into the active registry + emit its op to place")
    pac.add_argument("selector", help="emergent eid or name to activate")
    pac.add_argument("--difficulty", type=int, default=0)
    pac.set_defaults(func=cmd_activate)

    ppr = sub.add_parser("prune", parents=[common],
                         help="hibernate grown faculties that never pay rent — dormant + retrievable by relevance, never deleted")
    ppr.add_argument("--min-fires", type=int, default=2, help="fires needed to keep canonical status (default 2)")
    ppr.add_argument("--grace-rings", type=int, default=50, help="rings of grace after birth before rent is due (default 50)")
    ppr.add_argument("--dry-run", action="store_true", help="report only, change nothing")
    ppr.add_argument("--effectful", action="store_true",
                     help="v3.15: rent is paid only by CONTRIBUTING fires (computed op result or injected frame), not label decoration")
    ppr.set_defaults(func=cmd_prune)
    pef = sub.add_parser("effect", parents=[common],
                         help="attach a behavioral effect (frame|hint|op) to a grown faculty, or --backfill all")
    pef.add_argument("selector", nargs="?", default="")
    pef.add_argument("--type", choices=["frame", "hint", "op"], default="frame")
    pef.add_argument("--value", default="")
    pef.add_argument("--backfill", action="store_true",
                     help="give every effect-free grown faculty its default payload")
    pef.set_defaults(func=cmd_effect)
    pe = sub.add_parser("emergent", parents=[common], help="list the Dream Cache of emergent faculties (proposals)")
    pe.set_defaults(func=cmd_emergent)
    pd = sub.add_parser("dormant", parents=[common],
                        help="list the dormant pool (hibernated faculties, retrievable by relevance)")
    pd.set_defaults(func=cmd_dormant)
    pw = sub.add_parser("wake", parents=[common],
                        help="wake dormant faculties back into the working set by name/id (or --all)")
    pw.add_argument("selectors", nargs="*", default=[])
    pw.add_argument("--all", action="store_true", help="wake every dormant faculty")
    pw.add_argument("--reason", default="manual wake")
    pw.set_defaults(func=cmd_wake)
    prd = sub.add_parser("recall-dormant", parents=[common],
                         help="show which dormant faculties would wake for an input (read-only)")
    prd.add_argument("input")
    prd.set_defaults(func=cmd_recall_dormant)
    return p


def prune(root: Path, registry_root=None, min_fires: int = 2,
          grace_rings: int = 50, dry_run: bool = False,
          effectful: bool = False) -> dict:
    """Rent-based HIBERNATION (v3.16; was demotion in v3.12). A grown faculty
    that has not fired at least *min_fires* times, and whose birth is older
    than *grace_rings* rings, is set DORMANT in place: the full definition
    survives in grown.json, it leaves the per-turn working set, and it stays
    retrievable by task relevance (retrieve_dormant) — waking on match exactly
    like rings recalled from blockspace. Nothing is deleted; the birth and
    promotion rings remain in the chain. Junk-named faculties (is_junk_token
    on any name word) get no grace."""
    home = registry_home(root, registry_root)
    tc = Timechain(root)
    # fire census + birth heights from the chain
    fire, birth = {}, {}
    head = -1
    if tc.rings_path.exists():
        with tc.rings_path.open() as fh:
            for line in fh:
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                head = max(head, r.get("index", -1))
                labels = (r.get("payload") or {}).get("labels") or {}
                # v3.15 effect-gated rent: with --effectful, a firing only pays
                # rent when the faculty CONTRIBUTED to the ring — a computed op
                # result or an injected frame. Label-only decoration counts for
                # nothing; ornament dies faster, organs survive.
                contributed = set()
                if effectful:
                    contributed = set((labels.get("computed") or {}).keys())
                    for fr in labels.get("frames") or []:
                        for kind in ("senses", "modalities"):
                            for f in labels.get(kind) or []:
                                if f["name"] in fr:
                                    contributed.add(f["name"])
                for kind in ("senses", "modalities"):
                    for f in labels.get(kind) or []:
                        if not effectful or f["name"] in contributed:
                            fire[f["name"]] = fire.get(f["name"], 0) + 1
                if r.get("ring_type") == "promotion":
                    nm = (r.get("payload") or {}).get("summary") or \
                         (r.get("payload") or {}).get("name") or ""
                    birth.setdefault(nm.strip(), r.get("index", 0))
    grown = load_grown(home)
    hibernated, kept = [], []
    for key in ("senses", "modalities"):
        for f in grown.get(key, []):
            if f.get("status") == "dormant":
                continue                    # already out of the working set — no rent due
            if f.get("pinned"):
                kept.append(f["name"])      # pinned (permanently unlocked): rent-exempt,
                continue                    # never hibernates — an owned skill, not a tenant
            fires = fire.get(f["name"], 0)
            born = birth.get(f["name"], 0)
            junk = any(is_junk_token(w) for w in re.findall(r"[A-Za-z0-9]+", f["name"]))
            grace_over = head < 0 or (head - born) >= grace_rings
            if fires < min_fires and (grace_over or junk):
                hibernated.append({"name": f["name"], "kind": key, "fires": fires,
                                   "junk_name": junk})
                if not dry_run:
                    # v3.16: hibernate IN PLACE — the full definition survives,
                    # retrievable by relevance; nothing is deleted or stripped.
                    f["status"] = "dormant"
                    f["dormant_since"] = now_iso()
                    f["dormant_fires"] = fires
            else:
                kept.append(f["name"])
    if not dry_run and hibernated:
        save_grown(home, grown)
        try:
            tc.seal("prune", {
                "summary": (f"hibernated {len(hibernated)} rent-delinquent grown "
                            f"faculties (dormant, retrievable by relevance; "
                            f"kept {len(kept)} active)"),
                "hibernated": [d["name"] for d in hibernated]})
        except Exception:
            pass
        try:
            import epochs as _epochs
            _epochs.seal_epoch(root, reason=f"prune: hibernated {len(hibernated)}")
        except Exception:
            pass
    # "demoted" kept as an alias for pre-3.16 callers of the Python API.
    return {"hibernated": hibernated, "demoted": hibernated, "kept": len(kept),
            "head": head}


def set_effect(root: Path, selector: str, effect_type: str, value: str = "",
               registry_root=None) -> dict:
    """v3.15: attach/replace a behavioral effect on a grown faculty.
    frame -> value is the reasoning directive; hint -> value is a routing bias
    ("replay"|"partial"|"model"); op -> value names a registered grown op."""
    home = registry_home(root, registry_root)
    grown = load_grown(home)
    hit = None
    for key in ("senses", "modalities"):
        for f in grown.get(key, []):
            if f["name"] == selector or str(f["id"]) == selector:
                hit = f
                break
        if hit:
            break
    if hit is None:
        raise SystemExit(f"no grown faculty matches {selector!r}")
    if effect_type == "frame":
        hit["effect"] = {"type": "frame", "text": value or f"Apply {hit['name']}: {hit.get('function','')[:160]}"}
    elif effect_type == "hint":
        if value not in ("replay", "partial", "model"):
            raise SystemExit("hint value must be replay|partial|model")
        hit["effect"] = {"type": "hint", "bias": value}
    elif effect_type == "op":
        hit["effect"] = {"type": "op", "name": value or hit["name"]}
    else:
        raise SystemExit("effect type must be frame|hint|op")
    save_grown(home, grown)
    return hit


def backfill_effects(root: Path, registry_root=None) -> dict:
    """v3.15: give every effect-free grown faculty its default behavioral payload
    (an op if a grown op with its name exists, else a frame from its function
    text). Idempotent; existing effects are never overwritten."""
    home = registry_home(root, registry_root)
    grown = load_grown(home)
    op_names = set()
    try:
        import modality_ops
        op_names = set((modality_ops.load_grown_ops(home) or {}).keys())
    except Exception:
        pass
    filled = 0
    for key in ("senses", "modalities"):
        for f in grown.get(key, []):
            if isinstance(f.get("effect"), dict):
                continue
            if f["name"] in op_names:
                f["effect"] = {"type": "op", "name": f["name"]}
            else:
                f["effect"] = {"type": "frame",
                               "text": f"Apply {f['name']}: {f.get('function', '')[:160]}"}
            filled += 1
    if filled:
        save_grown(home, grown)
    return {"filled": filled}


def cmd_effect(args):
    if args.selector == "--backfill" or args.backfill:
        res = backfill_effects(args.root, getattr(args, "registry_root", None))
        print(f"backfilled effects on {res['filled']} faculties")
        return
    hit = set_effect(args.root, args.selector, args.type, args.value or "",
                     getattr(args, "registry_root", None))
    print(f"effect set on {hit['name']}: {json.dumps(hit['effect'])}")


def cmd_prune(args):
    res = prune(args.root, registry_root=getattr(args, "registry_root", None),
                min_fires=args.min_fires, grace_rings=args.grace_rings,
                dry_run=args.dry_run, effectful=getattr(args, "effectful", False))
    tag = "(dry run) " if args.dry_run else ""
    print(f"{tag}hibernated {len(res['hibernated'])} faculties (dormant, retrievable "
          f"by relevance — nothing deleted), kept {res['kept']} active")
    for d in res["hibernated"][:20]:
        print(f"  - {d['name']} ({d['kind']}, fires={d['fires']}"
              + (", junk name" if d["junk_name"] else "") + ")")
    if len(res["hibernated"]) > 20:
        print(f"  … and {len(res['hibernated'])-20} more")


def cmd_dormant(args):
    pool = dormant_pool(registry_home(args.root, args.registry_root))
    if not pool:
        print("  (dormant pool empty — every grown faculty is in the working set)")
        return
    for kind, f in pool:
        since = str(f.get("dormant_since", ""))[:10]
        hits = f.get("wake_hits", 0)
        print(f"  [{kind}] {f['name']}  since={since or '?'}  fires-at-hibernation="
              f"{f.get('dormant_fires', '?')}  wake_hits={hits}")
    print(f"  {len(pool)} dormant — retrievable by relevance each turn; "
          f"`wake <name>` reinstates manually")


def cmd_wake(args):
    names = ["*"] if args.all else list(args.selectors)
    if not names:
        print("  -> name at least one faculty (or pass --all)")
        return
    res = wake(args.root, names, reason=args.reason,
               registry_root=getattr(args, "registry_root", None))
    if not res["woken"]:
        print("  -> no dormant faculty matched")
        return
    for w in res["woken"]:
        print(f"  woke [{w['kind']}] {w['name']}")
    if res.get("ring"):
        r = res["ring"]
        print(f"\n  sealed {r['ring_type']} Ring {r['index']}  {r['ring_hash'][:16]}..")


def cmd_recall_dormant(args):
    home = registry_home(args.root, args.registry_root)
    hits = retrieve_dormant(home, args.input, args.context or "")
    if not hits:
        print("  (no dormant faculty is relevant to this input)")
        return
    for kind, f, score in hits:
        print(f"  score={score}  [{kind}] {f['name']} — {short(f.get('function', ''), 90)}")


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
