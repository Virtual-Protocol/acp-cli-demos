#!/usr/bin/env python3
"""
Replay — the antecedent cache: before generating from scratch, ask whether the
chain already holds the answer. This is where "the LLM shifts from generator to
indexer" becomes an executable loop, with its economics measured and sealed.

THE LOOP (the model is always the judge — replay is OFFERED, never imposed):
  1. MATCH    `replay.py match "<query>"` shortlists sealed rings whose content
              already covers the question (Hippocampus-narrowed; lexical coverage
              blended with embedding cosine when sealed vectors exist). Only
              candidates above the threshold are offered.
  2. CONFIRM  YOU read the antecedent and decide: does it truly answer this?
  3. ACCEPT   `replay.py accept <ring> --query …` — answer grounded on the
              antecedent (seal the turn citing it via `recall seal --used-rings`),
              log a `replay-accept` (a certified positive pair: new query ≡ old
              ring) and the tokens regeneration would have cost.
     REJECT   `replay.py reject <ring> --query …` — looked similar, wasn't: a
              `replay-reject`, the mined hard negative contrastive training
              starves for.

THRESHOLD = DATA + POLICY: the offer threshold starts at the policy default and
is CALIBRATED (`replay.py calibrate --adopt`) by fitting P(accept | match score)
on the logged outcomes, placed at the false-replay rate the covenant tolerates.
The values layer governs the cache's permitted deception rate.

SELF-FULFILLING-REPLAY GUARD (closed loops bite): a replay-accept must not become
the only evidence for the next replay of the same content. After `max_chain_depth`
consecutive accepts, the ring is marked re-derivation due — match still shows it,
but flagged: answer fresh, seal anew (`replay.py refresh <ring>` records the
re-derivation). The depth ledger (`chain/replay.json`) is derived state, beside
the chain, never inside it.

FALSIFICATION CLOSES THE LOOP: a replayed ring later contradicted by
`recall verify-source` emits `falsify` — negative resonance flows back into the
same telemetry the threshold calibrates from.

Stdlib only. Python 3.8+. Builds on timechain.py, telemetry.py, policy.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from timechain import Timechain, now_iso
from telemetry import Telemetry, query_hash
from recall import block_text, approx_tokens, excerpt_text
from poq import tokens
import embed as embmod
import policy as policymod

# Structural/bookkeeping rings are not answers; never offer them for replay.
SKIP_RING_TYPES = {"genesis", "bench", "telemetry-digest", "operator",
                   "faculty-import", "faculty-export", "faculty", "faculty-recur",
                   "promotion", "quarantine", "recovery", "resume", "dream"}

STOPISH = {"the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
           "with", "as", "at", "by", "is", "are", "was", "were", "be", "been",
           "what", "how", "why", "does", "do", "did", "my", "our", "your"}


def _content_tokens(text):
    return {t for t in tokens(text) if t not in STOPISH and len(t) > 2}


class Replay:
    def __init__(self, root, registry_root=None):
        self.root = Path(root)
        self.tc = Timechain(root)
        self.tel = Telemetry(root)
        self.policy = policymod.load_policy(registry_root)["replay"]
        self.ledger_path = self.tc.dir / "replay.json"

    # ---- depth ledger (derived state; safe to lose, rebuilt by operating) ----
    def _ledger(self):
        if self.ledger_path.exists():
            try:
                return json.loads(self.ledger_path.read_text())
            except Exception:
                return {}
        return {}

    def _save_ledger(self, led):
        tmp = self.ledger_path.with_name(self.ledger_path.name + f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(led, indent=2))
        tmp.replace(self.ledger_path)

    def threshold(self):
        cal = self.policy.get("calibrated")
        if cal and cal.get("match_threshold") is not None:
            return float(cal["match_threshold"]), "calibrated"
        return float(self.policy["match_threshold"]), "policy-default"

    # ---- match ----
    def match(self, query, context="", top=5, threshold=None, embed=False,
              provider="hashing", use_index=True, index_limit=300):
        thr, thr_source = (threshold, "explicit") if threshold is not None else self.threshold()
        qtoks = _content_tokens(query + " " + (context or ""))
        embedder = qvec = None
        if embed:
            embedder = embmod.get_embedder(provider)
            qvec = embedder.embed(query + " " + (context or ""))

        rings = None
        if use_index:
            try:
                from hippocampus import Hippocampus
                hippo = Hippocampus(self.root, embedder=embedder)
                hippo.ensure_current()
                rings = hippo.candidates(query, context or "", query_embedding=qvec,
                                         limit=index_limit,
                                         query_fingerprint=(
                                             None if embedder is None
                                             else embmod.fingerprint_of(embedder)))
            except Exception:
                rings = None
        if rings is None:
            rings = self.tc.load()

        led = self._ledger()
        depth_cap = int(self.policy["max_chain_depth"])
        out = []
        for r in rings:
            if r.get("index", 0) == 0 or r.get("ring_type") in SKIP_RING_TYPES:
                continue
            text = block_text(r)
            rtoks = _content_tokens(text)
            if not rtoks or not qtoks:
                continue
            cov = len(qtoks & rtoks) / len(qtoks)
            lab = (r.get("payload", {}) or {}).get("labels") or {}
            ltoks = {str(t).lower() for t in (lab.get("keywords") or [])}
            ltoks |= {str(t).lower() for t in (lab.get("entities") or [])}
            kw = (len(qtoks & ltoks) / len(qtoks)) if ltoks else 0.0
            score = 0.7 * cov + 0.3 * kw
            if embedder is not None:
                vec = lab.get("embedding")
                if vec is not None and not embmod.compatible(
                        lab.get("embedding_fingerprint"), embmod.fingerprint_of(embedder)):
                    vec = None
                score = max(score, embmod.cosine(qvec, vec or embedder.embed(text)))
            if score < thr:
                continue
            entry = led.get(str(r["index"]), {})
            out.append({
                "index": r["index"], "ring_type": r["ring_type"],
                "score": round(score, 4), "timestamp": r.get("timestamp"),
                "replays": entry.get("accepts", 0),
                "rederive_due": entry.get("since_fresh", 0) >= depth_cap,
                "est_tokens_saved": approx_tokens(text),
                "excerpt": excerpt_text(text, query=query, words=50),
            })
        out.sort(key=lambda c: c["score"], reverse=True)
        return {"threshold": thr, "threshold_source": thr_source,
                "considered": len(rings), "candidates": out[:top]}

    # ---- outcomes (the annotation function) ----
    def accept(self, ring_index, query, context="", score=None, tokens_saved=None):
        rings = {r["index"]: r for r in self.tc.load()}
        ring = rings.get(ring_index)
        if ring is None:
            raise ValueError(f"ring {ring_index} not found")
        if tokens_saved is None:
            tokens_saved = approx_tokens(block_text(ring))
        led = self._ledger()
        e = led.setdefault(str(ring_index), {"accepts": 0, "rejects": 0, "since_fresh": 0})
        e["accepts"] += 1
        e["since_fresh"] = e.get("since_fresh", 0) + 1
        e["last"] = now_iso()
        self._save_ledger(led)
        depth_cap = int(self.policy["max_chain_depth"])
        self.tel.emit("replay-accept", {
            "query_hash": query_hash(query, context), "ring_index": ring_index,
            "match_score": score, "tokens_saved": tokens_saved,
            "depth": e["since_fresh"],
        })
        return {"ring_index": ring_index, "tokens_saved": tokens_saved,
                "depth": e["since_fresh"], "rederive_due": e["since_fresh"] >= depth_cap}

    def reject(self, ring_index, query, context="", score=None):
        led = self._ledger()
        e = led.setdefault(str(ring_index), {"accepts": 0, "rejects": 0, "since_fresh": 0})
        e["rejects"] += 1
        e["last"] = now_iso()
        self._save_ledger(led)
        self.tel.emit("replay-reject", {
            "query_hash": query_hash(query, context), "ring_index": ring_index,
            "match_score": score,
        })
        return {"ring_index": ring_index, "hard_negative": True}

    def refresh(self, ring_index):
        """Record that this content was re-derived fresh (and presumably sealed
        anew): the replay-depth counter resets, the guard is satisfied."""
        led = self._ledger()
        e = led.setdefault(str(ring_index), {"accepts": 0, "rejects": 0, "since_fresh": 0})
        e["since_fresh"] = 0
        e["refreshed"] = now_iso()
        self._save_ledger(led)
        return {"ring_index": ring_index, "since_fresh": 0}

    # ---- economics + calibration ----
    def stats(self):
        accepts = rejects = saved = 0
        for _, e in self.tel.events():
            if e.get("event") == "replay-accept":
                accepts += 1
                saved += int(e["data"].get("tokens_saved") or 0)
            elif e.get("event") == "replay-reject":
                rejects += 1
        led = self._ledger()
        top = sorted(((int(k), v.get("accepts", 0)) for k, v in led.items()),
                     key=lambda x: x[1], reverse=True)[:5]
        thr, src = self.threshold()
        return {"accepts": accepts, "rejects": rejects,
                "acceptance_rate": round(accepts / (accepts + rejects), 4)
                                   if (accepts + rejects) else None,
                "tokens_saved_total": saved,
                "threshold": thr, "threshold_source": src,
                "most_replayed": top}

    def calibrate(self, registry_root=None, adopt=False):
        """Fit P(accept | match score) on logged outcomes; place the threshold at
        the covenant's tolerated false-replay rate."""
        events = []
        for _, e in self.tel.events():
            if e.get("event") in ("replay-accept", "replay-reject"):
                s = e["data"].get("match_score")
                if s is not None:
                    events.append((float(s), e["event"] == "replay-accept"))
        pol = self.policy
        report = {"events": len(events), "min_events": pol["min_events"],
                  "target_false_replay_rate": pol["target_false_replay_rate"],
                  "eligible": len(events) >= pol["min_events"]}
        if not report["eligible"]:
            report["note"] = "insufficient replay outcomes — threshold stays at " \
                             f"{self.threshold()[0]} ({self.threshold()[1]})"
            return report
        target = pol["target_false_replay_rate"]
        thr = None
        for s in sorted({s for s, _ in events}):
            kept = [(sc, acc) for sc, acc in events if sc >= s]
            if kept and sum(1 for _, acc in kept if not acc) / len(kept) <= target:
                thr = round(s, 4)
                break
        report["match_threshold"] = thr
        if adopt and thr is not None:
            policymod.write_calibration("replay", {
                "match_threshold": thr, "fitted_on": len(events), "at": now_iso(),
            }, registry_root)
            report["adopted"] = True
        return report


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_match(args):
    rp = Replay(args.root, args.registry_root)
    r = rp.match(args.query, args.context or "", top=args.top, threshold=args.threshold,
                 embed=args.embed, provider=args.provider, use_index=not args.no_index)
    print(f"threshold {r['threshold']} ({r['threshold_source']})   "
          f"considered {r['considered']}   offered {len(r['candidates'])}")
    for c in r["candidates"]:
        flag = "  RE-DERIVE DUE — answer fresh and seal anew" if c["rederive_due"] else ""
        print(f"  #{c['index']:>4} [{c['ring_type']}] score {c['score']}  "
              f"replayed {c['replays']}x  ~{c['est_tokens_saved']} tok{flag}")
        print(f"        “{c['excerpt'][:130]}…”")
    if not r["candidates"]:
        print("  (no antecedent above threshold — generate fresh, then seal; "
              "the chain grows an answer for next time)")
    print("\nYOU are the judge: read the antecedent (recall fetch <id>), then "
          "`replay accept <id> --query …` or `replay reject <id> --query …`.")


def cmd_accept(args):
    rp = Replay(args.root, args.registry_root)
    r = rp.accept(args.ring, args.query, args.context or "",
                  score=args.score, tokens_saved=args.tokens_saved)
    print(f"replay-accept logged: ring #{r['ring_index']}, ~{r['tokens_saved']} tokens saved, "
          f"depth {r['depth']}")
    if r["rederive_due"]:
        print("NOTE: depth cap reached — next time, re-derive fresh and `replay refresh` "
              "(the self-fulfilling-replay guard).")
    print(f"ground your turn on it: recall seal \"…\" --used-rings {r['ring_index']}")


def cmd_reject(args):
    rp = Replay(args.root, args.registry_root)
    rp.reject(args.ring, args.query, args.context or "", score=args.score)
    print(f"replay-reject logged: ring #{args.ring} looked similar, wasn't — "
          "a mined hard negative for the learners.")


def cmd_refresh(args):
    Replay(args.root, args.registry_root).refresh(args.ring)
    print(f"ring #{args.ring}: re-derivation recorded, replay depth reset.")


def cmd_stats(args):
    s = Replay(args.root, args.registry_root).stats()
    print(f"accepts: {s['accepts']}   rejects: {s['rejects']}   "
          f"acceptance: {s['acceptance_rate'] if s['acceptance_rate'] is not None else '-'}")
    print(f"tokens saved (total): {s['tokens_saved_total']}")
    print(f"threshold: {s['threshold']} ({s['threshold_source']})")
    if s["most_replayed"]:
        print("most replayed: " + ", ".join(f"#{i} ({n}x)" for i, n in s["most_replayed"]))


def cmd_calibrate(args):
    r = Replay(args.root, args.registry_root).calibrate(args.registry_root, adopt=args.adopt)
    print(f"replay outcomes: {r['events']} (policy min {r['min_events']}, "
          f"target false-replay rate {r['target_false_replay_rate']})")
    if not r["eligible"]:
        print(f"  {r['note']}")
    else:
        print(f"  calibrated match_threshold: {r['match_threshold']}"
              + ("   (adopted into policy.json)" if r.get("adopted") else ""))


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    common.add_argument("--registry-root", type=Path, default=None)

    p = argparse.ArgumentParser(description="Replay — answer from the chain when it already knows.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pm = sub.add_parser("match", parents=[common], help="offer sealed antecedents for a query (you confirm)")
    pm.add_argument("query")
    pm.add_argument("--context", default=None)
    pm.add_argument("--top", type=int, default=5)
    pm.add_argument("--threshold", type=float, default=None, help="override the policy/calibrated threshold")
    pm.add_argument("--embed", action="store_true")
    pm.add_argument("--provider", default="hashing")
    pm.add_argument("--no-index", action="store_true", help="full scan instead of the Hippocampus shortlist")
    pm.set_defaults(func=cmd_match)

    pa = sub.add_parser("accept", parents=[common], help="certify an antecedent answers the query (positive pair)")
    pa.add_argument("ring", type=int)
    pa.add_argument("--query", required=True)
    pa.add_argument("--context", default=None)
    pa.add_argument("--score", type=float, default=None, help="the match score shown by `match`")
    pa.add_argument("--tokens-saved", type=int, default=None)
    pa.set_defaults(func=cmd_accept)

    pr = sub.add_parser("reject", parents=[common], help="record that a match looked similar but wasn't (hard negative)")
    pr.add_argument("ring", type=int)
    pr.add_argument("--query", required=True)
    pr.add_argument("--context", default=None)
    pr.add_argument("--score", type=float, default=None)
    pr.set_defaults(func=cmd_reject)

    pf = sub.add_parser("refresh", parents=[common], help="record a fresh re-derivation (resets the depth guard)")
    pf.add_argument("ring", type=int)
    pf.set_defaults(func=cmd_refresh)

    ps = sub.add_parser("stats", parents=[common], help="acceptance rate, tokens saved, threshold, top replays")
    ps.set_defaults(func=cmd_stats)

    pc = sub.add_parser("calibrate", parents=[common], help="fit P(accept|score); place threshold at the covenant's tolerance")
    pc.add_argument("--adopt", action="store_true")
    pc.set_defaults(func=cmd_calibrate)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
