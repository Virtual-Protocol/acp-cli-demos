#!/usr/bin/env python3
"""
Chronosynaptic Tree — single-pass parallel-self MCTS, sealed into the Timechain.

NOT a subagent fan-out. This is one in-process reasoning pass in which the agent
forks many *perspectives of itself* — each a lens drawn from its own faculty
registry (modalities + senses) — and runs a Monte Carlo Tree Search over them:

    SELECT      descend the tree of perspective-paths by UCT.
    EXPAND      adopt an untried perspective -> a new candidate stance.
    SIMULATE    roll out that perspective's FUTURE (greedy continuations) to
                estimate the highest truth reachable from it.
    BACKPROP    flow the value up the path.

Every node is scored by the PoQ gate (poq.py) against UNIFIED data:
    - PAST      : grounding/relevance against the rings already in the Timechain.
    - TRAINING  : the model's own knowledge — the `external_scores` seam; in this
                  deterministic harness it defaults to neutral, in deployment the
                  model fills it within the same pass.
    - FUTURE    : the MCTS rollout values (simulated futures of each fork).

COLLAPSE: after the search, the single highest-truth path is sealed into the
Timechain as one `synthesis` ring; the rejected forks are recorded in its
payload (so the chain witnesses the collapse) but are NOT sealed — they fall
away. This is "collapse the wave function to seal only the highest-truth path."

v3.22 — THE CHRONOSYNAPTIC TREE, reborn phases ("shatter the timeline"):
    SELECT      UQC (Upper Qualia Confidence) replaces plain UCT: exploitation +
                exploration + a SYMBOLIC GRAVITY term S(v) — the lens's
                query-affinity acting as an attention-multiplier so structurally
                charged paths draw the search first.
    EXPAND      dimensional fractalization: every fork carries its own QUALIA
                PROFILE — a deterministic per-faculty weighting of the six PoQ
                dimensions — so siloed perspectives genuinely DISAGREE about
                which futures are bright (a spatial lens is not a narrative
                lens). This un-flattens fork values; v3.15 contrastive alone
                left a 0.5/255 spread on real queries.
    SIMULATE    rollouts score per-profile, and ECONOMIC APOPTOSIS starves
                branches that stay dim after enough visits: their compute flows
                to bright branches (the local analog of the $CPHY mempool
                doctrine — delusional futures are priced out, never subsidized).
    COLLAPSE    early wave-function collapse when one branch's integrated value
                crosses --collapse-poq (default 243 ≈ 95%); the sealed ring is
                announced as a GENESIS-EPOCH banner built ONLY from real ring
                fields (prev hash, mined nonce, brightness — ceremony never
                invents); the brightest DISCARDED branches are flushed into the
                Cambium Dream Cache as metaphor seeds (capped, junk-guarded)
                instead of vanishing.
    WORKSHEET   `think --worksheet FILE` emits the ranked fork skeleton as JSON
                for the model to fill with real semantic content and collapse
                via collapse-notes — the division-of-labor bridge: script
                values are PRIORS, the model is the judge.

EXPLICIT NOTES MODE: for serious audits, the model can do the valuable semantic
work itself — write perspective summaries, findings, evidence, and scores — then
ask this tool to collapse those notes. The winner is sealed, and every rejected
perspective is preserved in the same ring payload for auditability.

Why this is a *natural feature of the chain as a self-model*: the forks are the
self refracted through its own organs, the valuation is the self's conscience,
the grounding and the sealing are the self's memory. The whole search happens in
one process — no Agent tool, no spawned subagents.

Stdlib only. Python 3.8+.  Companion to timechain.py, poq.py, cambium.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

from timechain import Timechain, POQ_DIMENSIONS
from poq import PoQGate, tokens, jaccard, ring_text, POQ_WINDOW
from cambium import load_corpus, registry_home, load_emergent, save_emergent, is_junk_token


def short(s: str, n: int = 48) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def load_faculties(root: Path):
    # base modalities/senses + the user's promoted faculties (grown.json), with one-time
    # migration of any legacy in-base promotions. Shares cambium's loader so the merge
    # logic lives in one place (v2.1); registry_home falls back to the skill registry
    # when the chain root is a bare per-task ledger (v2.7.1).
    return load_corpus(registry_home(root))


def frame(perspective: dict, query: str) -> str:
    """The stance contributed by adopting one perspective (a faculty-lens).

    v3.22: the lens's OWN vocabulary rides along, so distinct perspectives
    compose distinct readings — the fractalization is textual, not just
    nominal (identical template readings were why fork values saturated)."""
    foc = ", ".join(sorted(set(tokens(query)) & perspective["tokens"])[:4]) or perspective["category"]
    own = [t for t in sorted(perspective["tokens"] - set(tokens(query)))
           if len(t) > 3 and t.isalpha()][:5]
    lens = f" through its own terms [{', '.join(own)}]" if own else ""
    return (f"[{perspective['name']}] {perspective['category']} reading focusing on "
            f"{foc}{lens} via {short(perspective['function'])}")


PRESERVED_NOTE_FIELDS = {
    "assumptions",
    "confidence",
    "evidence",
    "findings",
    "notes",
    "open_questions",
    "recommendations",
    "risks",
    "severity",
    "verdict",
}
KNOWN_NOTE_FIELDS = PRESERVED_NOTE_FIELDS | {
    "brightness",
    "chosen",
    "kind",
    "name",
    "score",
    "scores",
    "selected",
    "summary",
    "synthesis",
    "value",
}


def score_number(value, field):
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a number from 0 to 255")
    if not 0 <= n <= 255:
        raise ValueError(f"{field} must be in range 0..255")
    return int(round(n))


def note_scores(note, index):
    raw = note.get("scores") or {}
    if raw and not isinstance(raw, dict):
        raise ValueError(f"perspective {index}: scores must be an object")
    scores = {}
    for dim in POQ_DIMENSIONS:
        if dim in raw and raw[dim] is not None:
            scores[dim] = score_number(raw[dim], f"perspective {index}: scores.{dim}")

    scalar = note.get("score", note.get("value", note.get("brightness")))
    if scalar is not None:
        fill = score_number(scalar, f"perspective {index}: score")
        for dim in POQ_DIMENSIONS:
            scores.setdefault(dim, fill)

    if not scores:
        raise ValueError(f"perspective {index}: provide score/value/brightness or a scores object")
    missing = [dim for dim in POQ_DIMENSIONS if dim not in scores]
    if missing:
        raise ValueError(f"perspective {index}: missing scores for {', '.join(missing)}")
    return scores


def normalize_perspective_note(note, index):
    if not isinstance(note, dict):
        raise ValueError(f"perspective {index}: expected an object")
    summary = (note.get("summary") or note.get("synthesis") or "").strip()
    if not summary:
        raise ValueError(f"perspective {index}: summary is required")

    scores = note_scores(note, index)
    value = round(sum(scores.values()) / len(scores), 3)
    out = {
        "index": index,
        "name": str(note.get("name") or f"Perspective {index}"),
        "kind": str(note.get("kind") or "explicit"),
        "summary": summary,
        "scores": scores,
        "value": value,
        "chosen_hint": bool(note.get("chosen") or note.get("selected")),
    }
    for field in sorted(PRESERVED_NOTE_FIELDS):
        if field in note:
            out[field] = note[field]
    details = {k: v for k, v in note.items() if k not in KNOWN_NOTE_FIELDS}
    if details:
        out["details"] = details
    return out


def load_notes_file(path):
    if str(path) == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path).read_text())


def public_perspective(perspective, decision=None):
    out = {k: v for k, v in perspective.items() if k != "chosen_hint"}
    if decision:
        out["decision"] = decision
    return out


def choose_explicit_perspective(perspectives, winner=None):
    if winner:
        winner_s = str(winner).strip()
        matches = []
        if winner_s.isdigit():
            wanted = int(winner_s)
            matches = [p for p in perspectives if p["index"] == wanted]
        if not matches:
            wanted = winner_s.lower()
            matches = [p for p in perspectives if p["name"].lower() == wanted]
        if len(matches) != 1:
            raise ValueError(f"winner {winner!r} did not match exactly one perspective")
        return matches[0]

    hinted = [p for p in perspectives if p.get("chosen_hint")]
    if len(hinted) > 1:
        raise ValueError("multiple perspectives were marked chosen/selected; pass --winner to disambiguate")
    if hinted:
        return hinted[0]
    return max(perspectives, key=lambda p: (p["value"], -p["index"]))


class Node:
    __slots__ = ("parent", "depth", "perspective", "path", "children", "untried", "N", "W", "poq")

    def __init__(self, parent, depth, perspective, path, untried):
        self.parent = parent
        self.depth = depth
        self.perspective = perspective   # the faculty-lens adopted at this node (None at root)
        self.path = path                 # list of perspectives root..this
        self.children = []
        self.untried = untried           # perspectives not yet expanded here
        self.N = 0
        self.W = 0.0
        self.poq = None                  # immediate PoQ verdict at this node

    def q(self) -> float:
        return self.W / self.N if self.N else 0.0


class ChronosynapticTree:
    def __init__(self, root_path, iterations=16, forks=4, max_depth=2, c=1.2, window=POQ_WINDOW,
                 contrastive=True, gravity=0.35, apoptosis=True, collapse_poq=243):
        self.root_path = Path(root_path)
        self.tc = Timechain(self.root_path)
        # Bounded relevance window (O(window) tail read): ground the search against recent
        # memory, not the whole chain.
        self.chain = self.tc.tail_rings(window) if (window and window > 0) else self.tc.load()
        # Tokenize the window ONCE and reuse for every PoQ evaluation in the search; otherwise
        # the MCTS re-tokenizes the whole window iterations x depth x forks times.
        self._ring_token_sets = [set(tokens(ring_text(r))) for r in self.chain]
        self.gate = PoQGate()
        self.faculties = load_faculties(self.root_path)
        self.iterations = iterations
        self.forks = forks
        self.max_depth = max_depth
        self.c = c
        # v3.15 contrastive valuation: absolute brightness SATURATES (the fourth
        # self-audit measured every fork landing 179-185/255 — near-coin-flip
        # selection). Contrastive mode scores a perspective by the INFORMATION it
        # adds over its siblings: brightness is blended with the reading's
        # distinctiveness (token novelty vs. the sibling consensus), so the
        # collapse favours surprise that survives verification, not eloquence.
        self.contrastive = contrastive
        self._sibling_tokens = {}   # depth -> accumulated token multiset of evaluated readings
        # v3.22 UQC + apoptosis + early collapse
        self.gravity = gravity            # symbolic-gravity weight in UQC (0 = plain UCT)
        self.apoptosis = apoptosis        # starve dim branches, reroute their compute
        self.apoptosis_visits = 3         # visits before a branch may be starved
        self.apoptosis_ratio = 0.8        # starved below this fraction of the best sibling
        self.apoptosis_floor = 90 / 255   # ...or below this absolute value, regardless
        self.collapse_poq = collapse_poq  # early wave-collapse threshold on 0-255 (None/0 = off)
        self.collapsed_at = None          # iteration at which the wave collapsed early
        self.iterations_run = 0
        self._gravity_map = {}            # (kind, id) -> S(v) in 0..1, set at rank time
        self._profile_cache = {}          # (kind, id) -> qualia dim-weight profile
        self._distinct_cache = {}         # path signature -> distinctiveness (computed once)

    # ---- perspective selection (relevance to the query, exploration via UQC) ----
    def rank(self, query, context, k, exclude_ids=()):
        q = set(tokens(f"{query} {context}"))
        pool = [f for f in self.faculties if (f["kind"], f["id"]) not in exclude_ids]
        scored = sorted(((len(q & f["tokens"]) + jaccard(q, f["tokens"]), f) for f in pool),
                        key=lambda x: x[0], reverse=True)[:k]
        # v3.22 Symbolic Gravity: each ranked lens's query-affinity, normalized
        # to 0..1 within this pool — the UQC attention-multiplier. Stored in a
        # side map, never mutating the shared registry dicts.
        if scored:
            hi = scored[0][0] or 1.0
            for s, f in scored:
                self._gravity_map[(f["kind"], f["id"])] = round(s / hi, 4)
        return [f for _, f in scored]

    def _used(self, path):
        return {(p["kind"], p["id"]) for p in path}

    # ---- v3.22 qualia profiles: dimensional fractalization ----
    # Each faculty-lens weighs the six PoQ dimensions in its own signature,
    # derived deterministically from kind/category/name (stable across runs, no
    # randomness): a structural sense prizes consistency and novelty where a
    # knowledge modality prizes coherence and depth. Parallel perspectives thus
    # genuinely disagree about which futures are bright — the manifold the
    # Chronosynaptic doctrine calls dimensional fractalization.
    _PROFILE_BASES = {
        ("modality", "knowledge"):  {"coherence": 1.30, "depth": 1.25, "relevance": 1.10},
        ("modality", "structural"): {"consistency": 1.30, "coherence": 1.20, "depth": 1.10},
        ("sense",    "structural"): {"consistency": 1.25, "novelty": 1.20, "depth": 1.10},
        ("sense",    "knowledge"):  {"relevance": 1.25, "novelty": 1.20, "coherence": 1.10},
    }

    def profile_for(self, perspective):
        key = (perspective["kind"], perspective["id"])
        prof = self._profile_cache.get(key)
        if prof is None:
            base = dict.fromkeys(POQ_DIMENSIONS, 1.0)
            base.update(self._PROFILE_BASES.get(
                (perspective["kind"], perspective.get("category", "knowledge")), {}))
            # stable per-name emphasis so two same-category lenses still differ
            h = int(hashlib.md5(perspective["name"].encode()).hexdigest(), 16)
            base[POQ_DIMENSIONS[h % len(POQ_DIMENSIONS)]] += 0.15
            total = sum(base.values())
            prof = {d: w / total for d, w in base.items()}
            self._profile_cache[key] = prof
        return prof

    # ---- PoQ valuation against unified data (past chain + training seam) ----
    def value(self, path, query, context, external=None):
        text = self.compose(path, query)
        verdict = self.gate.evaluate(text, self.chain, context, external,
                                     ring_token_sets=self._ring_token_sets)
        if not path:
            return verdict, text
        absolute = verdict["brightness"]
        # the ROOT fork's qualia profile re-weighs the six dims: the branch is a
        # SILOED perspective, so its lens colors every future simulated beneath
        # it (dimensional fractalization — a spatial silo values a deep future
        # differently than a narrative silo values the same future).
        prof = self.profile_for(path[0])
        profiled = round(sum(verdict["scores"][d] * prof[d] for d in POQ_DIMENSIONS), 3)
        distinct = 0.0
        if self.contrastive:
            # distinctiveness is a property of the READING, not of how often the
            # search revisits it: computed ONCE per unique path and cached.
            # (v3.15 recomputed per visit, so every re-evaluation re-fed the
            # sibling pool and eroded the value of exactly the nodes the search
            # liked — a bias against explored branches.)
            sig = tuple((p["kind"], p["id"]) for p in path)
            cached = self._distinct_cache.get(sig)
            if cached is None:
                depth = len(path)
                toks = set(tokens(frame(path[-1], query)))
                seen = self._sibling_tokens.setdefault(depth, {})
                if toks:
                    novel = sum(1 for t in toks if t not in seen)
                    cached = novel / len(toks)    # 1.0 = says something no sibling said
                else:
                    cached = 0.0
                for t in toks:
                    seen[t] = seen.get(t, 0) + 1
                self._distinct_cache[sig] = cached
            distinct = cached
        # blend: verification dominates (0.5 absolute), the lens's own qualia
        # weighting fractures the manifold (0.3), distinctiveness breaks the
        # saturation tie (0.2) — every component recorded for audit.
        verdict = dict(verdict)
        verdict["brightness_absolute"] = absolute
        verdict["brightness_profiled"] = profiled
        verdict["distinctiveness"] = round(distinct, 3)
        verdict["brightness"] = round(0.5 * absolute + 0.3 * profiled + 0.2 * distinct * 255, 3)
        return verdict, text

    def compose(self, path, query):
        return "Synthesis of self-perspectives — " + " ; ".join(frame(p, query) for p in path)

    # ---- MCTS phases ----
    def _live_children(self, node):
        """v3.22 economic apoptosis: a branch visited at least apoptosis_visits
        times that still shines below apoptosis_ratio of its brightest sibling
        (or below the absolute floor) is STARVED — excluded from selection so
        its remaining compute flows to bright branches. Delusional futures are
        priced out, never subsidized. The last live branch is never starved."""
        kids = node.children
        if not self.apoptosis or len(kids) < 2:
            return kids
        vmax = max(ch.q() for ch in kids)
        live = [ch for ch in kids
                if ch.N < self.apoptosis_visits
                or (ch.q() >= self.apoptosis_ratio * vmax
                    and ch.q() >= self.apoptosis_floor)]
        return live or kids

    def starved_names(self, node):
        live = {id(ch) for ch in self._live_children(node)}
        return [ch.perspective["name"] for ch in node.children if id(ch) not in live]

    def select(self, root):
        node = root
        while True:
            if node.depth >= self.max_depth:
                return node
            if node.untried:
                return node
            if not node.children:
                return node
            node = max(self._live_children(node), key=lambda ch: self._uqc(ch))

    def _uqc(self, child):
        """Upper Qualia Confidence: UCT plus Symbolic Gravity — S(v) is the
        lens's query-affinity (set at rank time), an attention-multiplier that
        keeps structurally charged paths in the search's gaze."""
        if child.N == 0:
            return float("inf")
        s = self._gravity_map.get((child.perspective["kind"], child.perspective["id"]), 0.0)
        return (child.q()
                + self.c * math.sqrt(math.log(child.parent.N) / child.N)
                + self.gravity * s)

    def expand(self, node, query, context):
        p = node.untried.pop(0)
        path = node.path + [p]
        verdict, _ = self.value(path, query, context)
        nxt_depth = node.depth + 1
        untried = self.rank(query, context, self.forks, self._used(path)) if nxt_depth < self.max_depth else []
        child = Node(node, nxt_depth, p, path, untried)
        child.poq = verdict
        node.children.append(child)
        return child

    def simulate(self, node, query, context):
        """Roll out the FUTURE: greedily extend the path to max_depth, choosing the
        continuation perspective that yields the highest PoQ brightness."""
        path = list(node.path)
        depth = node.depth
        while depth < self.max_depth:
            pool = self.rank(query, context, self.forks, self._used(path))
            if not pool:
                break
            best, best_b = None, -1.0
            for f in pool:
                verdict, _ = self.value(path + [f], query, context)
                if verdict["brightness"] > best_b:
                    best_b, best = verdict["brightness"], f
            path.append(best)
            depth += 1
        verdict, _ = self.value(path, query, context)
        return verdict["brightness"] / 255.0

    def backprop(self, node, value):
        while node is not None:
            node.N += 1
            node.W += value
            node = node.parent

    # ---- the single-pass search ----
    def search(self, query, context=""):
        root = Node(None, 0, None, [], self.rank(query, context, self.forks))
        for i in range(self.iterations):
            node = self.select(root)
            if node.depth < self.max_depth and node.untried:
                node = self.expand(node, query, context)
            value = self.simulate(node, query, context)
            self.backprop(node, value)
            self.iterations_run = i + 1
            # v3.22 early wave-function collapse: once one branch's integrated
            # value crosses the PoQ threshold with enough visits, the remaining
            # budget buys nothing — collapse now.
            if self.collapse_poq and root.children:
                best = max(root.children, key=lambda ch: (ch.N, ch.q()))
                if (best.N >= max(4, self.forks)
                        and best.q() * 255 >= self.collapse_poq):
                    self.collapsed_at = i + 1
                    break
        return root

    def best_path(self, root):
        # Robust child = most-visited, tie-broken by higher unified value, so the
        # collapse is principled even when visit counts are close.
        node, chosen = root, []
        while node.children:
            node = max(node.children, key=lambda ch: (ch.N, ch.q()))
            chosen.append(node)
        return chosen

    def collapse_and_seal(self, root, query, context, difficulty=0, do_seal=True):
        chosen = self.best_path(root)
        if not chosen:
            return None, None
        leaf = chosen[-1]
        synthesis = self.compose(leaf.path, query)
        forks_report = sorted(
            [{"perspective": ch.perspective["name"], "kind": ch.perspective["kind"],
              "visits": ch.N, "value": round(ch.q() * 255, 1)} for ch in root.children],
            key=lambda d: d["visits"], reverse=True)
        # v3.15 loser epitaphs: the collapse ring records WHY each losing fork
        # lost (one line each), so a later dream cycle can learn which
        # perspectives keep losing and why — the losers no longer just vanish.
        chosen_names = {p["name"] for p in leaf.path}
        epitaphs = []
        for ch in root.children:
            if ch.perspective["name"] in chosen_names:
                continue
            v = ch.poq or {}
            epitaphs.append({
                "perspective": ch.perspective["name"],
                "visits": ch.N,
                "value": round(ch.q() * 255, 1),
                "epitaph": (f"lost: value {round(ch.q()*255,1)} vs winner "
                            f"{round(leaf.q()*255,1) if leaf.N else '?'}; "
                            + (f"distinctiveness {v.get('distinctiveness')}"
                               if v.get("distinctiveness") is not None
                               else "no distinct reading"))})
        starved = self.starved_names(root)
        payload = {
            "event": "chronosynaptic_collapse",
            "query": query,
            "chosen_path": [p["name"] for p in leaf.path],
            "synthesis": synthesis,
            "considered_forks": forks_report,
            "loser_epitaphs": epitaphs,
            "collapsed_from": len(root.children),
            "sealed_one_of": sum(1 for _ in root.children),
            # v3.22 UQC telemetry: how the search spent and withheld attention
            "uqc": {"gravity_weight": self.gravity,
                    "starved_branches": starved,
                    "iterations_run": self.iterations_run,
                    "early_collapse_at": self.collapsed_at},
        }
        flushed = []
        if do_seal:
            flushed = self.flush_losers_to_dream_cache(root, leaf, query)
            if flushed:
                payload["dream_cache_flush"] = flushed
        ring = None
        if do_seal:
            ring = self.tc.seal("synthesis", payload,
                                poq=leaf.poq["scores"] if leaf.poq else None,
                                difficulty=difficulty)
        return {"chosen": chosen, "leaf": leaf, "forks": forks_report,
                "synthesis": synthesis, "starved": starved, "flushed": flushed}, ring

    def flush_losers_to_dream_cache(self, root, leaf, query, cap=2):
        """v3.22: discarded branches are not waste. The brightest losers are
        flushed into the Cambium Dream Cache (the emergent store — DORMANT
        proposals, never executed, human-activated only) as metaphor seeds for
        future growth. Capped at `cap` per collapse and junk-guarded so a
        collapse can never flood the ecology; flushing must never break the
        collapse itself."""
        chosen_names = {p["name"] for p in leaf.path}
        losers = sorted((ch for ch in root.children
                         if ch.perspective["name"] not in chosen_names and ch.N > 0),
                        key=lambda ch: ch.q(), reverse=True)[:cap]
        if not losers:
            return []
        try:
            reg = registry_home(self.root_path)
            data = load_emergent(reg)
            existing = {f.get("name") for f in data["faculties"]}
            nxt = max((int(str(f.get("eid", "E0"))[1:]) for f in data["faculties"]
                       if str(f.get("eid", "E0"))[1:].isdigit()), default=0) + 1
            qtok = set(tokens(query))
            flushed = []
            for ch in losers:
                p = ch.perspective
                seeds = [t for t in sorted(p["tokens"] | qtok)
                         if len(t) >= 4 and not is_junk_token(t)][:6]
                name = f"{p['name']} (discarded branch)"
                if not seeds or name in existing:
                    continue
                data["faculties"].append({
                    "eid": f"E{nxt}", "kind": p["kind"], "name": name,
                    "sprout_name": name,
                    "function": (f"Metaphor seed from a Chronosynaptic branch discarded at "
                                 f"collapse (value {round(ch.q() * 255, 1)} vs winner "
                                 f"{round(leaf.q() * 255, 1) if leaf.N else '?'}): "
                                 f"{short(frame(p, query), 140)}"),
                    "category": p.get("category", "knowledge"),
                    "origin": "chronosynaptic-discard",
                    "status": "proposal",
                    "seed_terms": seeds,
                    "parents": [],
                })
                existing.add(name)
                nxt += 1
                flushed.append(name)
            if flushed:
                save_emergent(reg, data)
                # v3.14 integrity perimeter: a registry mutation must be
                # epoch-resealed, or the chain reports an unsealed mutation.
                try:
                    import epochs as _epochs
                    _epochs.seal_epoch(self.root_path,
                                       reason=f"chronosynaptic flush: {len(flushed)} discarded branch(es)")
                except Exception:
                    pass
            return flushed
        except Exception:
            return []

    def collapse_explicit_notes(self, notes, query=None, context=None, winner=None,
                                difficulty=0, do_seal=True):
        if isinstance(notes, list):
            top = {}
            raw_perspectives = notes
        elif isinstance(notes, dict):
            top = notes
            raw_perspectives = notes.get("perspectives") or notes.get("forks")
        else:
            raise ValueError("notes must be an object or a list of perspectives")

        if not isinstance(raw_perspectives, list) or not raw_perspectives:
            raise ValueError("notes must contain a non-empty perspectives list")

        query = query or top.get("query")
        if not query:
            raise ValueError("query is required in notes or via --query")
        context = top.get("context", "") if context is None else context

        perspectives = [
            normalize_perspective_note(note, i)
            for i, note in enumerate(raw_perspectives, start=1)
        ]
        chosen = choose_explicit_perspective(perspectives, winner=winner)
        synthesis = top.get("synthesis") or chosen["summary"]
        rejected = [p for p in perspectives if p["index"] != chosen["index"]]
        forks_report = [
            {"perspective": p["name"], "kind": p["kind"], "value": p["value"],
             "decision": "sealed" if p["index"] == chosen["index"] else "rejected"}
            for p in sorted(perspectives, key=lambda item: item["value"], reverse=True)
        ]

        payload = {
            "event": "chronosynaptic_explicit_collapse",
            "mode": "explicit-perspective-notes",
            "query": query,
            "context": context,
            "chosen_path": [chosen["name"]],
            "chosen_perspective": public_perspective(chosen, decision="sealed"),
            "synthesis": synthesis,
            "considered_forks": forks_report,
            "perspectives": [
                public_perspective(
                    p,
                    decision="sealed" if p["index"] == chosen["index"] else "rejected",
                )
                for p in perspectives
            ],
            "rejected_perspectives": [
                public_perspective(p, decision="rejected")
                for p in rejected
            ],
            "collapsed_from": len(perspectives),
            "sealed_one_of": 1,
            "score_basis": "model-supplied explicit perspective notes",
        }
        for field in ("audit_id", "scope", "repo", "commit", "source"):
            if field in top:
                payload[field] = top[field]

        ring = None
        if do_seal:
            ring = self.tc.seal("synthesis", payload, poq=chosen["scores"], difficulty=difficulty)
        return {"chosen": chosen, "forks": forks_report, "rejected": rejected,
                "synthesis": synthesis, "payload": payload}, ring


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def print_epoch_banner(ring, decision, extras=None):
    """v3.22: the sealed collapse announced as a genesis-epoch block. Every
    field is the REAL ring — prev hash, mined nonce, brightness — ceremony
    never invents a value the chain cannot verify."""
    b = (ring.get("poq") or {}).get("brightness")
    pct = f"{(b / 255 * 100):.1f}%" if isinstance(b, (int, float)) else "—"
    prev = ring.get("prev_hash")
    prev_line = (f"  Previous Hash  : 0x{str(prev)[:16]}…" if prev
                 else "  Previous Hash  : GENESIS")
    lines = [
        "",
        "  ═══ CHRONOSYNAPTIC COLLAPSE — EPOCH RING ═══",
        f"  Depth Index    : {ring['index']:04d}",
        f"  Timestamp      : {ring.get('timestamp', '—')}",
        prev_line,
        f"  Ring Hash      : 0x{ring['ring_hash'][:16]}…",
        f"  Nonce          : 0x{ring.get('nonce', 0):X}  (difficulty {ring.get('difficulty', 0)})",
        f"  PoQ Brightness : {pct}  ({decision})",
    ]
    for k, v in (extras or []):
        lines.append(f"  {k:<15}: {v}")
    lines.append("  Ring Status    : SEALED")
    lines.append("  ═════════════════════════════════════════════")
    print("\n".join(lines))


def cmd_think(args):
    # v3.15 --budget deep: spend search where the gap is — depth 4, 64 iterations,
    # wider exploration (c=1.8), 6 forks. The router invokes this automatically
    # when dissonance is high; routine turns keep the cheap default.
    if getattr(args, "budget", "") == "deep":
        args.iterations = max(args.iterations, 64)
        args.depth = max(args.depth, 4)
        args.forks = max(args.forks, 6)
    tree = ChronosynapticTree(args.root, iterations=args.iterations,
                              forks=args.forks, max_depth=args.depth, window=args.window,
                              contrastive=not args.no_contrastive,
                              gravity=args.gravity,
                              apoptosis=not args.no_apoptosis,
                              collapse_poq=args.collapse_poq or None)
    if getattr(args, "budget", "") == "deep":
        tree.c = 1.8
    if len(tree.chain) == 0:
        print("No chain yet — run 'python3 timechain.py init' first.")
        sys.exit(1)
    root = tree.search(args.query, args.context or "")
    result, ring = tree.collapse_and_seal(root, args.query, args.context or "",
                                          difficulty=args.difficulty, do_seal=args.seal)

    ran = tree.iterations_run or args.iterations
    print(f"forked {len(root.children)} parallel self-perspectives over "
          f"{ran}/{args.iterations} in-process iterations (depth {args.depth}, "
          f"UQC gravity {tree.gravity}); no subagents.\n")
    print("  PARALLEL FORKS (perspective | visits | unified value 0-255 | S(v)):")
    starved = set(result.get("starved") or [])
    for f in result["forks"]:
        mark = "†" if f["perspective"] in starved else " "
        print(f"   {mark}[{f['kind'][0].upper()}] {f['perspective']:<34} N={f['visits']:>3}  v={f['value']}")
    if starved:
        print(f"    † starved by economic apoptosis — compute rerouted to bright branches")
    if tree.collapsed_at:
        print(f"    early wave-function collapse at iteration {tree.collapsed_at} "
              f"(threshold {tree.collapse_poq}/255)")
    leaf = result["leaf"]
    print(f"\n  COLLAPSE -> highest-truth path ({len(leaf.path)} perspectives):")
    for p in leaf.path:
        print(f"    -> {p['name']}  ({p['category']})")
    if leaf.poq:
        comps = ""
        if leaf.poq.get("brightness_profiled") is not None:
            comps = (f"  [absolute {leaf.poq.get('brightness_absolute')} · "
                     f"profiled {leaf.poq.get('brightness_profiled')} · "
                     f"distinct {leaf.poq.get('distinctiveness')}]")
        print(f"  winner PoQ brightness: {leaf.poq['brightness']}{comps}  decision: {leaf.poq['decision']}")
        print(f"  cited rings: {leaf.poq['cited_rings'] or 'none'}")
    print(f"\n  synthesis: {short(result['synthesis'], 160)}")

    if getattr(args, "worksheet", None):
        skeleton = {
            "query": args.query,
            "context": args.context or "",
            "synthesis": "",
            "perspectives": [
                {"name": ch.perspective["name"], "kind": ch.perspective["kind"],
                 "machine_prior": {
                     "visits": ch.N, "value_255": round(ch.q() * 255, 1),
                     "gravity": tree._gravity_map.get(
                         (ch.perspective["kind"], ch.perspective["id"]), 0.0),
                     "starved": ch.perspective["name"] in starved,
                     "frame": frame(ch.perspective, args.query)},
                 "summary": "",
                 "scores": {d: None for d in POQ_DIMENSIONS}}
                for ch in sorted(root.children, key=lambda ch: ch.N, reverse=True)
            ],
            "_instructions": ("Machine values are PRIORS from lexical proxies — YOUR semantic "
                              "judgment replaces them. For each perspective you keep: write the "
                              "genuine reading through that lens in `summary` and score the six "
                              "dimensions 0-255 in `scores`. Drop perspectives that add nothing; "
                              "add ones the ranking missed; set top-level `synthesis`. Then: "
                              "python3 chronosynaptic.py collapse-notes <this-file> --seal"),
        }
        Path(args.worksheet).write_text(json.dumps(skeleton, indent=1))
        print(f"\n  WORKSHEET -> {args.worksheet}")
        print("  (fill summaries + scores with real semantic judgment, then collapse-notes --seal)")

    if ring:
        extras = [("Forks", f"{len(root.children)} explored · {len(starved)} starved (apoptosis)"),
                  ("Iterations", f"{ran}/{args.iterations}"
                   + (f" · early collapse @ {tree.collapsed_at}" if tree.collapsed_at else ""))]
        if result.get("flushed"):
            extras.append(("Dream Cache", f"{len(result['flushed'])} discarded branch(es) "
                           f"flushed as metaphor seeds"))
        print_epoch_banner(ring, leaf.poq["decision"] if leaf.poq else "SEAL", extras)
    else:
        print("\n  (not sealed — pass --seal to commit the collapse to the Timechain)")


def cmd_collapse_notes(args):
    tree = ChronosynapticTree(args.root)
    if len(tree.chain) == 0:
        print("No chain yet — run 'python3 timechain.py init' first.")
        sys.exit(1)
    try:
        notes = load_notes_file(args.notes)
        result, ring = tree.collapse_explicit_notes(
            notes,
            query=args.query,
            context=args.context,
            winner=args.winner,
            difficulty=args.difficulty,
            do_seal=args.seal,
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"collapse-notes error: {exc}")
        sys.exit(1)

    print(f"collapsed {len(result['forks'])} explicit perspective note(s); no subagents.\n")
    print("  EXPLICIT FORKS (perspective | value 0-255 | decision):")
    for f in result["forks"]:
        marker = "*" if f["decision"] == "sealed" else "-"
        print(f"    {marker} [{f['kind'][0].upper()}] {f['perspective']:<34} "
              f"v={f['value']:>5}  {f['decision']}")
    chosen = result["chosen"]
    print(f"\n  COLLAPSE -> {chosen['name']} ({chosen['kind']})")
    print(f"  winner brightness: {chosen['value']}  rejected: {len(result['rejected'])}")
    print(f"\n  synthesis: {short(result['synthesis'], 180)}")
    if ring:
        print(f"\n  SEALED synthesis Ring {ring['index']}  {ring['ring_hash'][:16]}..  "
              f"(1 of {len(result['forks'])} explicit perspectives kept; rejected notes preserved)")
        print_epoch_banner(
            ring, "SEAL — explicit model notes",
            [("Forks", f"{len(result['forks'])} explicit · "
              f"{len(result['rejected'])} rejected (preserved in payload)")])
    else:
        print("\n  (not sealed — pass --seal to commit the explicit collapse to the Timechain)")


def build_parser():
    default_root = Path(__file__).resolve().parent
    p = argparse.ArgumentParser(description="Chronosynaptic Tree — single-pass parallel-self MCTS over the Timechain.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pt = sub.add_parser("think", help="fork self-perspectives, search futures, collapse to the highest-truth path")
    pt.add_argument("query")
    pt.add_argument("--root", type=Path, default=default_root)
    pt.add_argument("--context", default=None)
    pt.add_argument("--iterations", type=int, default=16)
    pt.add_argument("--forks", type=int, default=4,
                    help="parallel siloed perspectives to fork (doctrine: 5-12 for hard queries)")
    pt.add_argument("--depth", type=int, default=2)
    pt.add_argument("--budget", choices=["default", "deep"], default="default",
                    help="deep: depth>=4, iterations>=64, forks>=6, wider exploration — for high-dissonance queries")
    pt.add_argument("--no-contrastive", action="store_true",
                    help="disable v3.15 contrastive valuation (absolute brightness only)")
    pt.add_argument("--gravity", type=float, default=0.35,
                    help="UQC symbolic-gravity weight S(v) in selection (0 = plain UCT)")
    pt.add_argument("--no-apoptosis", action="store_true",
                    help="disable economic apoptosis (starving of persistently dim branches)")
    pt.add_argument("--collapse-poq", type=int, default=243,
                    help="early wave-collapse threshold on 0-255 (default 243 ≈ 95%%; 0 = off)")
    pt.add_argument("--worksheet", default=None, metavar="FILE",
                    help="write the ranked fork skeleton as JSON for model-filled collapse-notes")
    pt.add_argument("--window", type=int, default=POQ_WINDOW,
                    help=f"bounded relevance window of recent rings to ground against (default {POQ_WINDOW}; 0 = whole chain)")
    pt.add_argument("--seal", action="store_true", help="seal the collapsed highest-truth path into the chain")
    pt.add_argument("--difficulty", type=int, default=0)
    pt.set_defaults(func=cmd_think)

    pn = sub.add_parser("collapse-notes", aliases=["from-notes"],
                        help="collapse model-supplied perspective notes and optionally seal the winner")
    pn.add_argument("notes", help="JSON notes file, or '-' for stdin")
    pn.add_argument("--root", type=Path, default=default_root)
    pn.add_argument("--query", default=None, help="override/define the query if absent from notes")
    pn.add_argument("--context", default=None, help="override/define context")
    pn.add_argument("--winner", default=None, help="chosen perspective name or 1-based index")
    pn.add_argument("--seal", action="store_true", help="seal the explicit collapse into the Timechain")
    pn.add_argument("--difficulty", type=int, default=0)
    pn.set_defaults(func=cmd_collapse_notes)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
