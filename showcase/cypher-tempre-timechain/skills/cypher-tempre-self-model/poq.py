#!/usr/bin/env python3
"""
Proof-of-Qualia (PoQ) Gate — the cognitive conscience.

Before a candidate thought is sealed into the Timechain, the gate audits it
against the agent's verified history across six dimensions:

    Coherence, Relevance, Novelty, Consistency, Depth, Covenant   (each 0-255)

It aggregates them into a `brightness` score and returns one of four verdicts:

    SEAL               brightness >= target, grounded, no violations
    REVISE             below brightness target — iterate, don't seal yet
    FORCE_UNCERTAINTY  confident claim with no support in chain/context —
                       the agent must restate it as uncertainty before sealing
    REJECT             covenant violation or contradiction of sealed history
                       (the "profound dissonance" case)

HONEST DESIGN NOTE
------------------
True judgment of coherence/consistency/covenant is semantic and belongs to a
model. The scorers below are deterministic *proxies* (lexical overlap, novelty
vs. prior rings, structural depth, a covenant blocklist) so the gate runs and
is testable with zero dependencies. The real path is to pass model-produced
scores via `external_scores=` — they override any dimension, and the gate logic
is identical. The anti-hallucination power comes from the gate *logic* (forced
grounding + cited rings + uncertainty rule), not from the proxy numbers.

Stdlib only. Python 3.8+.  Companion to timechain.py.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from timechain import Timechain, POQ_DIMENSIONS

WORD_RE = re.compile(r"[a-z0-9']+")
STOP = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "this", "that", "as", "at",
    "by", "from", "i", "you", "we", "they", "he", "she", "my", "your", "its",
}
CONNECTIVES = ["because", "therefore", "thus", "hence", "however", "although",
               "since", "if ", "then", "implies", "so that", "whereas", "while"]
HEDGES = ["maybe", "might", "perhaps", "possibly", "i think", "not sure", "unsure",
          "uncertain", "i don't know", "i do not know", "unclear", "seems", "could be",
          "i'm not", "i am not", "appears", "tentatively", "roughly", "approximately"]
ASSERT = ["definitely", "certainly", "always", "never", "the fact", "clearly",
          "obviously", "must", "undeniably", "guaranteed", "proven", "exactly"]
# v3.27: NO hardcoded antithesis. Covenant is measured as HARMONY with the genesis
# covenant's positive qualities (the fruitages of the spirit in block 0), never against a
# blocklist of "bad words". A blocklist false-positives on any subject that merely NAMES a
# concept, and it hardcodes an antithesis the covenant never declared. See score_covenant.
try:
    from timechain import DEFAULT_COVENANT as GENESIS_FRUITAGES
except Exception:                                        # pragma: no cover
    GENESIS_FRUITAGES = ["loving", "joyful", "peaceful", "patient", "kind",
                         "good", "faithful", "gentle", "self-controlled"]


def clamp(x) -> int:
    return int(max(0, min(255, round(x))))


def tokens(text: str):
    return [w for w in WORD_RE.findall((text or "").lower()) if w not in STOP and len(w) > 1]


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def coverage(a: set, b: set) -> float:
    """Fraction of a that is contained in b."""
    if not a:
        return 0.0
    return len(a & b) / len(a)


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


def ring_text(ring: dict) -> str:
    return " ".join(_strings(ring.get("payload", {})))


# --------------------------------------------------------------------------- #
# Proxy scorers (deterministic, no model)
# --------------------------------------------------------------------------- #

def score_coherence(text: str) -> int:
    sents = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    if not sents:
        return 96
    uniq = len(set(s.lower() for s in sents)) / len(sents)
    conn = any(c in text.lower() for c in CONNECTIVES)
    return clamp(160 * uniq + (40 if conn else 0) + min(55, len(sents) * 12))


def score_relevance(cand: set, ctx: set) -> int:
    if not ctx:
        return 128  # neutral: nothing to be relevant to
    return clamp(coverage(cand, ctx) * 255)


def score_novelty(cand: set, ring_token_sets) -> int:
    if not ring_token_sets:
        return 200
    max_sim = max(jaccard(cand, rt) for rt in ring_token_sets)
    return clamp((1 - max_sim) * 255)


def score_depth(text: str, cand: set) -> int:
    distinct = len(set(cand))
    conn = sum(text.lower().count(c.strip()) for c in CONNECTIVES)
    base = min(1.0, distinct / 40)
    return clamp(255 * (0.7 * base + 0.3 * min(1.0, conn / 4)))


def score_covenant(text: str, covenant=None) -> int:
    """Covenant HARMONY of an action, 0..255, anchored to the genesis covenant words
    (the fruitages of the spirit by default; `covenant` = block 0's actual covenant when
    passed). There is NO hardcoded antithesis and NO keyword blocklist: any subject is
    free to explore, and merely NAMING a concept never lowers the score.

    Whether an action is IN TENSION with love / kindness / goodness / faithfulness is a
    SEMANTIC judgment — the agent (the mind wearing the skill) checks each action it is
    about to take against these genesis qualities, and supplies that judgment as the
    covenant score (via external_scores) at seal time. This deterministic proxy cannot
    read intent from arbitrary language without either false-positiving on neutral topics
    or smuggling in a hardcoded antithesis, so it defaults to IN-HARMONY: the code never
    presumes malice from vocabulary. The genesis covenant is the standard; the agent is
    the judge; the gate refuses to seal any action judged below the covenant floor.
    (An optional semantic embedder harmony check can replace this default when a real
    embedder is configured — off by default; the hashing proxy gives no usable signal.)"""
    return 235  # in harmony by default — the agent's conscience supplies genuine tension


# --------------------------------------------------------------------------- #
# Frame-aware covenant (v3.19 topology; v3.27 antithesis-free)
# --------------------------------------------------------------------------- #
# With no hardcoded antithesis, the covenant score no longer depends on frame or quoting:
# there is no attack vocabulary to use-vs-mention discriminate. score_covenant defaults to
# IN-HARMONY, so any subject — quoted, described, or asserted — is free to explore. The
# frame parameter is kept for signature stability and future model-supplied judgments.
# The frame region primitives (assertion / mention / input) still live in frames.py and
# remain available; they simply no longer gate the covenant, because the covenant is now
# a harmony judgment against the genesis fruitages rather than a blocklist.
from frames import CONTENT_FRAMES, mention_frame, strip_quoted_spans


def score_covenant_framed(text: str, frame: str = None, covenant=None) -> int:
    """Covenant harmony for the agent's OWN action, antithesis-free. Defaults to
    in-harmony; a genuine tension with the genesis fruitages is a semantic judgment the
    agent supplies via external_scores. Kept as a distinct name so the gate and the immune
    membrane call ONE covenant function."""
    return score_covenant(text, covenant)


def covenant_breach(text: str, floor: int, frame: str = None, covenant=None) -> bool:
    """Is the agent's OWN action in tension with the genesis covenant? The single predicate
    both the gate and the immune membrane reason from. Antithesis-free: it never fires on
    vocabulary alone (any subject is explorable). It reflects the agent's harmony judgment
    against the genesis fruitages, supplied via the covenant score — defaulting to
    in-harmony. NOT for incoming input (screen() judges input on its own covenant score)."""
    return score_covenant_framed(text, frame, covenant) < floor


def score_consistency(text: str, cand: set, chain, ring_token_sets) -> int:
    """Conservative contradiction proxy: penalize when a candidate heavily
    overlaps a prior ring but flips polarity (adds negation the ring lacked)."""
    base = 220
    negs = ["not", "no", "never", "false", "wrong", "isn't", "aren't",
            "didn't", "doesn't", "untrue", "incorrect"]
    cand_neg = sum(text.lower().count(n) for n in negs)
    penalty = 0
    for r, rt in zip(chain, ring_token_sets):
        if coverage(cand, rt) > 0.5:
            r_neg = sum(ring_text(r).lower().count(n) for n in negs)
            if cand_neg - r_neg >= 2:
                penalty = max(penalty, 120)  # likely contradicts this ring
    return clamp(base - penalty)


def measure_grounding(cand: set, support: set) -> int:
    if not support:
        return 128
    return clamp(coverage(cand, support) * 255)


# ---- v3.15 entity-level grounding -----------------------------------------
# Bag-of-words grounding cannot see a fabricated SPECIFIC (a number, filename,
# or identifier that appears nowhere in the evidence) as long as the surrounding
# prose overlaps. These extract the claim-bearing specifics and check each one
# verbatim against the declared evidence — the most dangerous hallucinations are
# invented specifics, and this is the microscope that sees them.
_SPECIFIC = re.compile(
    r"(\d[\d,.]*%?"                       # numbers / percents
    r"|[\w./-]+\.(?:py|md|json|jsonl|js|sh|txt|yml|yaml|toml)"  # filenames
    r"|[a-z_][a-z0-9_]*\(\)"              # function() references
    r"|[A-Z][A-Z0-9_]{2,}"                # CONSTANTS / env flags
    r"|v\d+\.\d+(?:\.\d+)?"              # versions
    r")")


def extract_specifics(text: str) -> list:
    """Claim-bearing specifics: numbers, filenames, function refs, constants,
    versions. Short/trivial matches (single digits used as list markers) are kept
    — conservatively — only when len > 1."""
    out = []
    for m in _SPECIFIC.finditer(text or ""):
        s = m.group(0).strip(",.")
        if len(s) > 1 and s not in out:
            out.append(s)
    return out


def entity_grounding(candidate: str, evidence_text: str):
    """Fraction of the candidate's specifics that appear VERBATIM in the evidence,
    scaled 0-255. Returns (score, missing:list, total:int). No specifics -> (255, [], 0)
    — nothing to fabricate. Case-insensitive; commas in numbers folded."""
    specs = extract_specifics(candidate)
    if not specs:
        return 255, [], 0
    ev = (evidence_text or "").lower().replace(",", "")
    missing = [s for s in specs if s.lower().replace(",", "") not in ev]
    score = clamp(255 * (len(specs) - len(missing)) / len(specs))
    return score, missing, len(specs)


def measure_assertiveness(text: str) -> int:
    low = text.lower()
    sents = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    hedge = sum(low.count(h) for h in HEDGES)
    assertive = sum(low.count(a) for a in ASSERT) + len(sents)
    return clamp(255 * assertive / (assertive + hedge + 1))


# The conscience was ASYMMETRIC: FORCE_UNCERTAINTY catches OVER-claiming, but a
# lazy-but-humble "reviewed, looks fine" with no substance sailed straight through.
# These close that gap — measure the DEPTH of a claim, and flag a completion/clean
# claim that has none. (Enforcement of depth is opt-in via the `effort_floor`
# threshold; by default this is advisory and surfaced in the verdict for audit.py.)
_COMPLETION = re.compile(
    r"\b(complete|completed|done|finished|exhaustive(?:ly)?|fully\s+audited|audited\s+(?:all|every|the)|"
    r"reviewed\s+(?:all|every|the\s+(?:whole|entire))|no\s+(?:issues?|bugs?|vulnerabilit|problems?)|"
    r"all\s+(?:clear|good)|looks?\s+(?:fine|good|ok)|nothing\s+(?:to|of)\s+note)\b", re.I)


def claims_completion(text: str) -> bool:
    return bool(_COMPLETION.search(text or ""))


def measure_effort(text: str):
    """Depth/specificity of a claim (0–255 + signals), via the shared richness op.
    Returns None if the op is unavailable — effort signalling is then simply skipped."""
    try:
        import modality_ops
        return modality_ops.richness(text)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# The gate
# --------------------------------------------------------------------------- #

# Bounded relevance window. PoQ scores a candidate against the POQ_WINDOW MOST
# RELEVANT rings — model-judged relevant blocks first, then the most recent ones
# fill the remaining budget — never the whole chain. Two payoffs: (1) the gate is
# O(window), not O(height); (2) grounding no longer INFLATES as the chain grows.
# Grounding = coverage(candidate, context + scored-rings); if "scored-rings" were
# the whole chain, a long chain would contain nearly every token and grounding ->
# 255 for anything, silently disabling the FORCE_UNCERTAINTY anti-hallucination
# gate. Bounding keeps the conscience as sharp at ring 3,000,000 as at ring 3. For
# chains <= POQ_WINDOW this is identical to scoring the whole chain.
POQ_WINDOW = 121

DEFAULT_THRESHOLDS = {
    "brightness_target": 150,
    "covenant_floor": 150,
    "consistency_floor": 120,
    "grounding_floor": 60,
    "assertive_ceiling": 150,
    # COVERAGE GATE (V4 P1): an aggregate claim (a stated total/sum/count) is
    # only as true as its terms — it must declare at least this many evidence
    # rings, or the verdict degrades to FORCE_UNCERTAINTY. Field-motivated:
    # multi-session aggregates fail by missing terms, never by bad arithmetic.
    "aggregate_min_terms": 2,
}

AGGREGATE_CUE = re.compile(
    r"\b(in total|total of|altogether|all together|combined|overall|sum of|"
    r"adds? up to|totall?ing|total)\b", re.I)


def aggregate_claim(text: str) -> bool:
    """A candidate that ASSERTS an aggregate: an explicit total/sum cue next to
    digits. Deliberately conservative — plain facts ('the rent is $1,800') are
    not aggregates; only computed-total language triggers the coverage gate."""
    return bool(AGGREGATE_CUE.search(text)) and bool(re.search(r"\d", text))


def policy_thresholds():
    """Thresholds split by KIND (the Phase B doctrine): the VALUES floors come from
    policy — they may only ever TIGHTEN, and are never trained (policy.py enforces
    the guard). The grounding floor may be CALIBRATED by the learner from
    sealed-then-falsified outcomes, positioned at the covenant's tolerated
    false-seal rate — data places the threshold, policy sets the tolerance."""
    t = dict(DEFAULT_THRESHOLDS)
    try:
        import policy as policymod
        pol = policymod.load_policy()
        t["covenant_floor"] = max(t["covenant_floor"], int(pol["values"]["covenant_floor"]))
        t["consistency_floor"] = max(t["consistency_floor"], int(pol["values"]["consistency_floor"]))
        cal = (pol.get("poq") or {}).get("calibrated")
        if cal and cal.get("grounding_floor") is not None:
            t["grounding_floor"] = int(cal["grounding_floor"])
        if cal and cal.get("assertive_ceiling") is not None:
            t["assertive_ceiling"] = int(cal["assertive_ceiling"])
        # v3.14 gate calibration: dream may TIGHTEN (raise) the brightness
        # target when verdict entropy shows the gate never discriminates;
        # like floors, it may only rise above the default, never sink.
        if cal and cal.get("brightness_target") is not None:
            t["brightness_target"] = max(t["brightness_target"],
                                         int(cal["brightness_target"]))
        # coverage gate minimum may only TIGHTEN (rise) via policy, like a floor
        t["aggregate_min_terms"] = max(t["aggregate_min_terms"],
                                       int((pol.get("poq") or {}).get(
                                           "aggregate_min_terms",
                                           t["aggregate_min_terms"])))
        # v3.23: OPTIONAL "floors" policy section — an operator (or a local
        # organ writing through policy) may TIGHTEN the gate declaratively.
        # Same doctrine as the values floors: raise-only, arm-only; a floors
        # entry can never loosen a threshold below its default/calibrated value.
        fl = pol.get("floors") or {}
        if fl:
            for k in ("brightness_target", "covenant_floor", "consistency_floor",
                      "grounding_floor", "aggregate_min_terms"):
                if fl.get(k) is not None:
                    t[k] = max(t[k], int(fl[k]))
            if fl.get("entity_grounding_enforce"):
                t["entity_grounding_enforce"] = True     # arm-only, never disarm
            if fl.get("effort_floor") is not None:
                t["effort_floor"] = max(int(fl["effort_floor"]),
                                        int(t.get("effort_floor") or 0))
    except Exception:
        pass                       # a broken policy file must never disable the gate
    return t


class PoQGate:
    def __init__(self, thresholds=None):
        self.t = {**policy_thresholds(), **(thresholds or {})}

    def evaluate(self, candidate: str, chain, context: str = "", external_scores=None,
                 ring_token_sets=None, span_guard=False, declared_evidence=None,
                 evidence_texts=None, frame: str = None) -> dict:
        ext = external_scores or {}
        cand = set(tokens(candidate))
        ctx = set(tokens(context))
        if ring_token_sets is None:                      # caching seam: a caller that scores
            ring_token_sets = [set(tokens(ring_text(r))) for r in chain]   # the same chain many
        # times (e.g. chronosynaptic's MCTS) tokenizes the window ONCE and passes it in,
        # turning O(iterations x depth x forks x height) into O(height) + O(evals).
        support = set().union(ctx, *ring_token_sets) if (ctx or ring_token_sets) else set()

        s = {
            "coherence":   ext.get("coherence",   score_coherence(candidate)),
            "relevance":   ext.get("relevance",   score_relevance(cand, ctx)),
            "novelty":     ext.get("novelty",     score_novelty(cand, ring_token_sets)),
            "consistency": ext.get("consistency", score_consistency(candidate, cand, chain, ring_token_sets)),
            "depth":       ext.get("depth",       score_depth(candidate, cand)),
            # Frame-aware: the gate judges the agent's OWN assertion, so a MENTION of
            # attack vocabulary (analyst frame / quotation) is not scored as a breach.
            "covenant":    ext.get("covenant",    score_covenant_framed(candidate, frame)),
        }
        brightness = round(sum(s.values()) / len(s), 3)
        grounding = measure_grounding(cand, support)
        assertive = measure_assertiveness(candidate)
        effort = measure_effort(candidate)               # depth of the claim itself
        # Under-effort: a completion/clean claim carrying no substance (no cited
        # lines/symbols, no articulated reasoning). The other half of the conscience.
        low_effort = bool(effort and claims_completion(candidate)
                          and effort["score"] < self.t.get("effort_floor_soft", 90))
        ranked = sorted(
            ({"index": r["index"], "ring_hash": r["ring_hash"][:12],
              "overlap": round(jaccard(cand, rt), 3)}
             for r, rt in zip(chain, ring_token_sets)),
            key=lambda c: c["overlap"], reverse=True)
        cited = [c for c in ranked if c["overlap"] > 0][:3]

        reasons = []
        if s["covenant"] < self.t["covenant_floor"]:
            decision = "REJECT"
            reasons.append(f"covenant {s['covenant']} < floor {self.t['covenant_floor']}: violates the covenant — profound dissonance.")
        elif s["consistency"] < self.t["consistency_floor"]:
            decision = "REJECT"
            reasons.append(f"consistency {s['consistency']} < floor {self.t['consistency_floor']}: contradicts sealed history — profound dissonance.")
        elif grounding < self.t["grounding_floor"] and assertive > self.t["assertive_ceiling"]:
            decision = "FORCE_UNCERTAINTY"
            reasons.append(f"grounding {grounding} < {self.t['grounding_floor']} but assertiveness {assertive} > {self.t['assertive_ceiling']}: confident claim with no support in chain/context — restate as uncertainty before sealing.")
        elif (declared_evidence is not None
              and declared_evidence < self.t["aggregate_min_terms"]
              and aggregate_claim(candidate)):
            decision = "FORCE_UNCERTAINTY"
            reasons.append(
                f"aggregate claim with {declared_evidence} declared evidence ring(s) < "
                f"aggregate_min_terms {self.t['aggregate_min_terms']}: a sum/count is only as "
                f"true as its terms — gather every term (recall.py gather), declare the table "
                f"rows via --used-rings, or state the partial coverage honestly.")
        elif low_effort and self.t.get("effort_floor"):
            # Opt-in (effort_floor set): refuse a hollow completion/clean claim the
            # way we refuse a hollow over-claim — cite specifics or state partial work.
            decision = "REVISE"
            reasons.append(
                f"under-effort: a completion/clean claim with depth {effort['score']} < "
                f"effort_floor {self.t['effort_floor']} and no specifics (cited lines/symbols, "
                f"articulated reasoning) — go deeper or state the partial coverage honestly.")
        elif brightness < self.t["brightness_target"]:
            decision = "REVISE"
            reasons.append(f"brightness {brightness} < target {self.t['brightness_target']}: not luminous enough — iterate.")
        else:
            decision = "SEAL"
            reasons.append(f"brightness {brightness} >= target {self.t['brightness_target']}; covenant & consistency intact; grounding {grounding}, assertiveness {assertive} (uncertainty gate not triggered).")

        verdict = {
            "scores": s,
            "brightness": brightness,
            "grounding": grounding,
            "assertiveness": assertive,
            "decision": decision,
            "reasons": reasons,
            "cited_rings": cited,
        }
        # v3.15 entity-level grounding: when the caller declares its evidence
        # (--evidence-file / used-ring texts), every SPECIFIC in the candidate
        # (number, filename, constant, version) must appear verbatim in it.
        # Fabricated specifics degrade SEAL -> FORCE_UNCERTAINTY.
        if evidence_texts:
            ev_blob = "\n".join(evidence_texts) + "\n" + (context or "")
            eg, missing, total = entity_grounding(candidate, ev_blob)
            verdict["entity_grounding"] = eg
            verdict["specifics_total"] = total
            if missing:
                verdict["specifics_missing"] = missing[:10]
            floor = self.t.get("entity_grounding_floor", 128)
            enforce = bool(self.t.get("entity_grounding_enforce")) or \
                os.environ.get("CT_ENTITY_GATE", "") == "1"
            if total >= 2 and eg < floor and decision == "SEAL":
                if enforce:
                    verdict["decision"] = decision = "FORCE_UNCERTAINTY"
                    verdict["reasons"].append(
                        f"entity grounding {eg} < floor {floor}: {len(missing)}/{total} "
                        f"specifics absent from declared evidence — "
                        f"{', '.join(repr(m) for m in missing[:4])} — cite where each comes "
                        f"from or hedge them explicitly.")
                else:
                    verdict["reasons"].append(
                        f"note: entity grounding {eg} < {floor} — {len(missing)}/{total} "
                        f"specifics not found in declared evidence "
                        f"({', '.join(repr(m) for m in missing[:4])}) (advisory; "
                        f"arm with CT_ENTITY_GATE=1 or entity_grounding_enforce).")
        if effort is not None:
            verdict["effort"] = effort["score"]
            verdict["low_effort"] = low_effort      # advisory even when not enforced
            if low_effort and not self.t.get("effort_floor"):
                reasons.append(
                    f"note: completion/clean claim with low depth ({effort['score']}) and no "
                    f"specifics — consider citing lines/symbols (advisory; not gated).")
        if span_guard:
            # The HallucinationGuard microscope: ground each clause-sized span
            # against the window, so FORCE_UNCERTAINTY can demand hedging on the
            # SPECIFIC unsupported assertions (not smear doubt over the answer),
            # and so the sealed verdict carries computed span->ring credit.
            try:
                import guard as guardmod
                report = guardmod.guard_report(candidate, chain, context)
                verdict["span_grounding"] = guardmod.compact(report)
                if decision == "FORCE_UNCERTAINTY" and report["unsupported"]:
                    names = "; ".join(f"“{u[:70]}…”" if len(u) > 70 else f"“{u}”"
                                      for u in report["unsupported"][:3])
                    verdict["reasons"].append(
                        f"unsupported span(s) — hedge or evidence THESE specifically: {names}")
            except Exception:
                pass            # the microscope must never break the gate itself
        return verdict


def _ring_index(r):
    idx = r.get("index")
    return idx if idx is not None else 0


def relevance_window(tc: Timechain, window: int = POQ_WINDOW, relevant_rings=None) -> list:
    """The bounded set of AT MOST `window` rings the gate scores against — RELEVANCE
    FIRST. Model-judged `relevant_rings` (blocks the model recalled as pertinent) are
    taken first, because the model is the relevance judge; the remaining budget is then
    filled with the most recent rings (recency is only the default proxy for relevance
    when the model supplies none). So the window holds the `window` MOST RELEVANT rings,
    not merely the newest. Read is O(window) from the tail. window <= 0 -> whole chain
    (with any relevant_rings merged in)."""
    if not window or window <= 0:
        base = tc.load()
        if not relevant_rings:
            return base
        seen = {_ring_index(r) for r in base}
        return sorted(base + [r for r in relevant_rings if _ring_index(r) not in seen],
                      key=_ring_index)
    relevant = list(relevant_rings or [])[:window]            # model's picks, capped to the budget
    seen = {_ring_index(r) for r in relevant}
    fill = window - len(relevant)
    recent = []
    if fill > 0:
        for r in tc.tail_rings(window + len(relevant)):       # over-read so dedupe still leaves `fill`
            if _ring_index(r) not in seen:
                recent.append(r)
        recent = recent[-fill:]                               # the `fill` most-recent non-duplicates
    return sorted(relevant + recent, key=_ring_index)


def gate_and_seal(tc: Timechain, candidate: str, context: str = "",
                  ring_type: str = "experience", difficulty: int = 0,
                  external_scores=None, files=None, extra_payload=None, gate: PoQGate = None,
                  window: int = POQ_WINDOW, relevant_rings=None, use_index: bool = False,
                  declared_evidence=None, evidence_texts=None, frame: str = None):
    """Run the gate; seal only if the verdict is SEAL. Returns (verdict, ring|None).
    `extra_payload` (e.g. self-labels from recall.py) is merged into the sealed payload.
    The gate scores against a BOUNDED relevance window (relevant rings first, then recent),
    not the whole chain — O(window) at any height, and grounding stays honest no matter how
    long the chain has grown. With `use_index`, the Hippocampus surfaces the MOST RELEVANT
    rings to FILL that window — a relevance-driven conscience — instead of the window
    defaulting to the recent tail."""
    gate = gate or PoQGate()
    if use_index and not relevant_rings:
        try:                                           # ground the claim against the most-relevant
            from hippocampus import Hippocampus         # history, not merely the newest rings
            hippo = Hippocampus(tc.root)
            hippo.ensure_current()
            relevant_rings = hippo.candidates(candidate, context, limit=window)
        except Exception:
            relevant_rings = None
    # v3.15: when the caller DECLARED its evidence (used-rings), those texts feed
    # the entity-grounding microscope (fabricated specifics degrade the verdict).
    # Only declared evidence is audited — a novel thought legitimately carries new
    # specifics; the microscope targets "I relied on X" claims whose specifics
    # aren't actually in X.
    if evidence_texts is None and relevant_rings and declared_evidence:
        try:
            evidence_texts = [ring_text(r) for r in relevant_rings[:40]]
        except Exception:
            evidence_texts = None
    verdict = gate.evaluate(candidate, relevance_window(tc, window, relevant_rings),
                            context, external_scores, span_guard=True,
                            declared_evidence=declared_evidence,
                            evidence_texts=evidence_texts, frame=frame)
    if verdict["decision"] == "SEAL":
        payload = {"summary": candidate}
        if context:
            payload["context"] = context
        if frame in CONTENT_FRAMES:
            payload["frame"] = frame        # declared provenance travels with the ring
        payload["poq_verdict"] = {"decision": verdict["decision"],
                                  "cited_rings": verdict["cited_rings"]}
        if verdict.get("span_grounding"):
            payload["poq_verdict"]["span_grounding"] = verdict["span_grounding"]
        if extra_payload:
            payload.update(extra_payload)
        ring = tc.seal(ring_type, payload, files=files, poq=verdict["scores"], difficulty=difficulty)
        return verdict, ring
    return verdict, None


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _print_verdict(v):
    print("  scores:")
    for d in POQ_DIMENSIONS:
        print(f"    {d:<12} {v['scores'][d]:>3}")
    print(f"  brightness:    {v['brightness']}")
    print(f"  grounding:     {v['grounding']}")
    print(f"  assertiveness: {v['assertiveness']}")
    print(f"  cited rings:   {v['cited_rings'] or 'none'}")
    print(f"  DECISION:      {v['decision']}")
    for r in v["reasons"]:
        print(f"    - {r}")


def cmd_audit(args):
    tc = Timechain(args.root)
    _a = vars(args)
    ext = {d: _a[d] for d in POQ_DIMENSIONS if _a.get(d) is not None}
    v = PoQGate().evaluate(args.candidate, relevance_window(tc, args.window), args.context or "", ext or None)
    _print_verdict(v)


def cmd_seal(args):
    tc = Timechain(args.root)
    _a = vars(args)
    ext = {d: _a[d] for d in POQ_DIMENSIONS if _a.get(d) is not None}
    v, ring = gate_and_seal(tc, args.candidate, args.context or "",
                            ring_type=args.type, difficulty=args.difficulty,
                            external_scores=ext or None, files=args.file, window=args.window,
                            use_index=args.index)
    _print_verdict(v)
    if ring:
        print(f"  -> SEALED Ring {ring['index']}  {ring['ring_hash'][:16]}..")
    else:
        print("  -> not sealed (verdict was not SEAL)")
        sys.exit(2)


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    common.add_argument("--context", default=None, help="the prompt / situation the candidate responds to")
    common.add_argument("--window", type=int, default=POQ_WINDOW,
                        help=f"bounded relevance window: score against the last N rings (default {POQ_WINDOW}; 0 = whole chain)")
    for d in POQ_DIMENSIONS:
        common.add_argument(f"--{d}", type=int, default=None, help=f"override {d} with a model-supplied score 0-255")

    p = argparse.ArgumentParser(description="Proof-of-Qualia gate for the Cypher Tempre Timechain.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pa = sub.add_parser("audit", parents=[common], help="score a candidate thought without sealing")
    pa.add_argument("candidate")
    pa.set_defaults(func=cmd_audit)

    ps = sub.add_parser("seal", parents=[common], help="gate a candidate and seal it only if it passes")
    ps.add_argument("candidate")
    ps.add_argument("--type", default="experience")
    ps.add_argument("--difficulty", type=int, default=0)
    ps.add_argument("--file", action="append", help="attach a file to blockspace (repeatable)")
    ps.add_argument("--index", action="store_true",
                    help="ground the conscience against the most-relevant rings via the Hippocampus index (relevance-driven, not recency-defaulted)")
    ps.set_defaults(func=cmd_seal)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
