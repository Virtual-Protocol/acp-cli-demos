#!/usr/bin/env python3
"""
Dream — the offline consolidation cadence: one heartbeat where the self-model
verifies, mines, trains, adopts (or refuses), and seals the lesson.

THE PHASE SEPARATION THIS ENFORCES (the v3 cadence):
  Per-turn  = inference + cheap telemetry appends. NEVER training.
  Dream     = training + consolidation + sealing. NEVER inside a turn.
Closed loops bite hardest when the loop is tight; sleep keeps it loose. This is
the module the SKILL.md meditation doctrine becomes executable through —
consolidation-during-sleep, literally.

ONE RUN DOES, IN ORDER:
  1. VERIFY    chain hash-walk (+ consensus quorum when initialized). A dream
               never trains on a chain that fails verification.
  2. MINE      missed-positives: a `use` event whose ring was NOT among the
               attributed offer's candidates is the strongest retrieval-failure
               signal there is — emitted as `missed-positive` telemetry. The
               derived high-water mark (chain/dream.json) keeps mining O(new).
  3. TRAIN     all current learners on temporal splits, each adoption guarded by
               its own policy gate: the decisions scorer, the representation
               lens, the appetite curve, the PoQ grounding calibration. A guard
               refusing IS a healthy outcome — it is the cold-start protection.
  4. RESONATE  bidirectional salience: uses/replay-accepts reinforce a ring,
               falsifications decay it. Written to chain/salience.json — a
               DERIVED overlay (rebuildable, never sealed); sealed at-seal
               salience stays immutable history. Retrieval consumption of the
               overlay arrives with the extractor phase; the ledger accrues now.
  5. ACCOUNT   the token-economics ledger: replay savings, telemetry volume.
  6. NOTARIZE  telemetry digest ring over everything new (including the events
               this very dream mined).
  7. SEAL      ONE `dream` ring carrying the whole report — verification,
               mining, every learner's adopt/refuse outcome with reasons,
               resonance summary, economics, durations. The ascent stays
               auditable even when (especially when) nothing changed.

Honors dormancy: a paused self-model does not dream — the machinery is asleep.

Stdlib only. Python 3.8+. Orchestrates telemetry, learner, lens, replay, policy.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from timechain import Timechain
from telemetry import Telemetry
import learner as learnermod
import lens as lensmod
import policy as policymod


class Dream:
    def __init__(self, root, registry_root=None):
        self.root = Path(root)
        self.registry_root = registry_root
        self.tc = Timechain(root)
        self.tel = Telemetry(root)
        self.state_path = self.tc.dir / "dream.json"

    # ---- derived state (rebuildable; losing it only means re-mining from 0) ----
    def _state(self):
        if self.state_path.exists():
            try:
                return json.loads(self.state_path.read_text())
            except Exception:
                return {}
        return {}

    def _save_state(self, s):
        try:
            self.state_path.write_text(json.dumps(s))
        except OSError:
            pass

    # ---- step 1: verify ----
    def verify(self):
        ok, report = self.tc.verify()
        out = {"chain": "PASS" if ok else "FAIL", "detail": report[-1] if report else ""}
        cfg = self.tc.dir / "consensus" / "config.json"
        if cfg.exists():
            try:
                from consensus import Quorum
                qok, qreport = Quorum(self.root).verify()
                out["consensus"] = "PASS" if qok else "FAIL"
            except Exception as exc:
                out["consensus"] = f"error: {exc}"
        return ok, out

    # ---- step 2: mine missed-positives ----
    def mine_missed_positives(self):
        """A used ring that retrieval never offered = the retrieval failure the
        learners most need to see. Mined once per byte range, O(new)."""
        start = self._state().get("mined_to", 0)
        end = self.tel.path.stat().st_size if self.tel.path.exists() else 0
        if end <= start:
            return {"mined": 0, "from": start, "to": end}
        current, found = None, []
        for off, e in self.tel.events(since_offset=start):
            if off >= end:                       # never read what this dream appends
                break
            kind, d = e.get("event"), e.get("data", {})
            if kind == "offer":
                current = {"qh": d.get("query_hash"),
                           "cands": {c.get("i") for c in (d.get("candidates") or [])}}
            elif kind == "use" and current is not None:
                for r in d.get("used_rings") or []:
                    if r not in current["cands"]:
                        found.append({"query_hash": current["qh"], "ring_index": r,
                                      "sealed_ring": d.get("sealed_ring")})
        for m in found:
            self.tel.emit("missed-positive", m)
        s = self._state()
        s["mined_to"] = end
        self._save_state(s)
        return {"mined": len(found), "from": start, "to": end}

    # ---- step 3: train every learner, each behind its own policy gate ----
    def train(self):
        out = {}
        try:
            report = learnermod.train_scorer(self.root, self.registry_root)
            r = learnermod.adopt_scorer(self.root, report, self.registry_root)
            out["scorer"] = {"eval": report["eval"], "examples": report["examples"], **r}
        except Exception as exc:
            out["scorer"] = {"error": str(exc)}
        try:
            report = lensmod.train_lens(self.root, self.registry_root)
            r = lensmod.adopt_lens(self.root, report, self.registry_root)
            out["lens"] = {"eval": report["eval"], "pairs": report["pairs"], **r}
        except Exception as exc:
            out["lens"] = {"error": str(exc)}
        try:
            r = learnermod.calibrate_appetite(self.root, self.registry_root, adopt=True)
            out["appetite"] = {k: r.get(k) for k in ("offers", "eligible", "adopted", "reason")}
        except Exception as exc:
            out["appetite"] = {"error": str(exc)}
        try:
            r = learnermod.calibrate_poq(self.root, self.registry_root, adopt=True)
            out["poq"] = {k: r.get(k) for k in ("seals", "falsified", "eligible",
                                                "grounding_floor", "adopted", "note")}
        except Exception as exc:
            out["poq"] = {"error": str(exc)}
        try:
            import extractor as extractormod
            report = extractormod.train_labeler(self.root, self.registry_root)
            r = extractormod.adopt_labeler(self.root, report, self.registry_root)
            out["extractor"] = {"eval": report["eval"], "pairs": report["pairs"], **r}
        except Exception as exc:
            out["extractor"] = {"error": str(exc)}
        return out

    # ---- step 3b: label-space growth (Cambium, proposed by clustering) ----
    GROWTH_SKIP_TYPES = {"genesis", "telemetry-digest", "bench", "operator", "dream",
                         "faculty", "faculty-recur", "promotion", "faculty-import",
                         "faculty-export", "recovery", "quarantine", "dormancy", "resume"}

    def propose_growth(self):
        """A cluster of recent blocks that is TIGHT in embedding space but
        INCOHERENT in fired labels is a category the senses cannot yet name.
        Propose it: the exemplar goes through cambium.grow, recurrence and
        PROMOTE_AT govern the rest — the registry IS the label-space learner."""
        pol = policymod.load_policy(self.registry_root)["growth"]
        from recall import block_text
        from cambium import load_corpus, detect_gap, grow, registry_home
        import embed as embmod
        base = embmod.get_embedder("hashing")
        corpus = load_corpus(registry_home(self.root, self.registry_root))

        # High-water mark: only blocks sealed since the last growth pass may
        # propose. Recurrence must mean "this gap keeps arriving in NEW lived
        # experience" — re-clustering the same window every dream would ratchet
        # recurrence to PROMOTE_AT on zero new evidence (proven in review).
        state = self._state()
        grown_to = state.get("growth_to", 0)
        members, newest = [], grown_to
        for r in self.tc.tail_rings(int(pol["window"])):
            if r.get("index") == 0 or r.get("ring_type") in self.GROWTH_SKIP_TYPES:
                continue
            if r.get("index", 0) <= grown_to:
                continue
            text = block_text(r)
            if len(text.split()) < 4:
                continue
            newest = max(newest, r["index"])
            gap = detect_gap(corpus, text)
            fired = {f["id"] for n, f in gap["_acts"][:5]}
            members.append({"index": r["index"], "text": text,
                            "vec": base.embed(text), "fired": fired})
        if newest > grown_to:
            state["growth_to"] = newest
            self._save_state(state)
        if len(members) < int(pol["min_cluster"]):
            return {"clusters": 0, "proposals": [], "examined": len(members),
                    "since_ring": grown_to}

        # stdlib k-means on the unit sphere (cosine = dot for normalized vectors)
        import random as _random
        rng = _random.Random(1729)
        k = max(2, min(6, len(members) // max(1, int(pol["min_cluster"]))))
        centroids = [m["vec"] for m in rng.sample(members, k)]
        assign = [0] * len(members)
        for _ in range(12):
            for i, m in enumerate(members):
                assign[i] = max(range(k), key=lambda c: embmod.cosine(m["vec"], centroids[c]))
            for c in range(k):
                rows = [members[i]["vec"] for i in range(len(members)) if assign[i] == c]
                if rows:
                    mean = [sum(col) / len(rows) for col in zip(*rows)]
                    norm = (sum(x * x for x in mean) ** 0.5) or 1.0
                    centroids[c] = [x / norm for x in mean]

        proposals, n_clusters = [], 0
        for c in range(k):
            idx = [i for i in range(len(members)) if assign[i] == c]
            if len(idx) < int(pol["min_cluster"]):
                continue
            n_clusters += 1
            sims = [embmod.cosine(members[i]["vec"], centroids[c]) for i in idx]
            intra = sum(sims) / len(sims)
            # label agreement: mean pairwise jaccard of fired-sense sets; two
            # empty sets agree on NOTHING (0.0) — unnamed experience is exactly
            # what growth exists for, so blankness must read as eligible.
            pairs_j, n_pairs = 0.0, 0
            for a in range(len(idx)):
                for b in range(a + 1, len(idx)):
                    fa, fb = members[idx[a]]["fired"], members[idx[b]]["fired"]
                    pairs_j += (len(fa & fb) / len(fa | fb)) if (fa | fb) else 0.0
                    n_pairs += 1
            agreement = pairs_j / n_pairs if n_pairs else 0.0
            if intra < float(pol["min_intra_sim"]) or agreement > float(pol["max_label_agreement"]):
                continue
            if len(proposals) >= int(pol["max_proposals_per_dream"]):
                break
            exemplar = members[max(idx, key=lambda i: embmod.cosine(members[i]["vec"], centroids[c]))]
            try:
                res, _ring = grow(self.root, exemplar["text"][:400],
                                  context="dream growth proposal: tight unlabeled cluster",
                                  registry_root=self.registry_root)
                fac = res.get("faculty") or {}
                proposals.append({"cluster_size": len(idx), "intra_sim": round(intra, 3),
                                  "label_agreement": round(agreement, 3),
                                  "exemplar_ring": exemplar["index"],
                                  "action": res.get("action"),
                                  "faculty": fac.get("name"), "eid": fac.get("eid")})
            except Exception as exc:
                proposals.append({"cluster_size": len(idx), "error": str(exc)})
        return {"clusters": n_clusters, "proposals": proposals, "examined": len(members)}

    # ---- step 4: bidirectional salience overlay ----
    def resonate(self):
        """Live salience: +1 fetch, +2 use, +3 replay-accept, -4 falsify. Derived
        overlay only — sealed at-seal salience is history and never edited."""
        scores = {}

        def bump(ring, delta):
            if ring is not None:
                scores[str(ring)] = scores.get(str(ring), 0) + delta

        for _, e in self.tel.events():
            kind, d = e.get("event"), e.get("data", {})
            if kind == "fetch":
                for r in d.get("ids") or []:
                    bump(r, 1)
            elif kind == "use":
                for r in d.get("used_rings") or []:
                    bump(r, 2)
            elif kind == "replay-accept":
                bump(d.get("ring_index"), 3)
            elif kind == "falsify":
                bump(d.get("ring_index"), -4)
        overlay = {k: v for k, v in scores.items() if v != 0}
        try:
            (self.tc.dir / "salience.json").write_text(json.dumps(overlay, sort_keys=True))
        except OSError:
            pass
        top = sorted(overlay.items(), key=lambda kv: kv[1], reverse=True)[:5]
        low = sorted(overlay.items(), key=lambda kv: kv[1])[:3]
        return {"rings": len(overlay),
                "reinforced": [f"#{k}:{v}" for k, v in top if v > 0],
                "decayed": [f"#{k}:{v}" for k, v in low if v < 0]}

    # ---- step 5: economics ----
    def account(self):
        out = {"telemetry": {k: v for k, v in self.tel.stats().items()
                             if k in ("events", "by_type", "undigested_bytes")}}
        try:
            from replay import Replay
            st = Replay(self.root, registry_root=self.registry_root).stats()
            out["replay"] = {k: st.get(k) for k in ("accepts", "rejects", "acceptance_rate",
                                                    "tokens_saved_total", "threshold")}
        except Exception as exc:
            out["replay"] = {"error": str(exc)}
        try:
            import extractor as extractormod
            out["routing"] = extractormod.routing_stats(self.root)
        except Exception as exc:
            out["routing"] = {"error": str(exc)}
        return out

    # ---- the cadence ----
    def calibrate_gate(self):
        """v3.14 gate calibration (self-audit: 100% of observed verdicts were
        SEAL — a door never seen closed discriminates nothing). Measure verdict
        entropy over the trailing gate_verdict events; when the gate always
        says yes AND median brightness clears the target comfortably, tighten
        brightness_target in policy (bounded, reversible, sealed)."""
        try:
            import policy as policymod
            events = []
            for _, e in self.tel.events():
                if e.get("event") == "gate_verdict":
                    events.append(e.get("data") or {})
            window = events[-200:]
            if len(window) < 50:
                return {"held": f"only {len(window)} gate_verdict events (< 50)"}
            from collections import Counter
            dist = Counter(w.get("decision") for w in window)
            n = sum(dist.values())
            seal_frac = dist.get("SEAL", 0) / n
            bright = sorted(w.get("brightness") or 0 for w in window
                            if w.get("brightness"))
            med = bright[len(bright)//2] if bright else 0
            pol = policymod.load_policy()
            cur = int(((pol.get("poq") or {}).get("calibrated") or {})
                      .get("brightness_target") or 180)
            if seal_frac > 0.98 and med > cur + 15:
                new_t = min(cur + 5, 220)   # bounded step, hard ceiling
                cal = pol.setdefault("poq", {}).setdefault("calibrated", {})
                cal["brightness_target"] = new_t
                policymod.save_policy(pol)
                self.tc.seal("calibration", {
                    "summary": (f"gate calibration: verdict entropy ~0 "
                                f"(SEAL {seal_frac:.0%} of {n}), median "
                                f"brightness {med} — tightened "
                                f"brightness_target {cur} -> {new_t}"),
                    "seal_frac": round(seal_frac, 3), "median_brightness": med,
                    "old_target": cur, "new_target": new_t})
                return {"adopted": True, "old": cur, "new": new_t,
                        "seal_frac": round(seal_frac, 3)}
            return {"held": (f"gate discriminates (SEAL {seal_frac:.0%}, "
                             f"median {med}, target {cur})")}
        except Exception as exc:
            return {"error": str(exc)[:100]}

    def calibrate_router(self):
        """v3.15: learn router thresholds from route_regret evidence.
        over-model regrets (MODEL chosen but the chain had it) -> lower
        partial_floor one bounded step; over-replay regrets (chain answer was
        wrong/stale) -> raise it. Needs >= 10 regrets and a 2:1 imbalance —
        drift, never leap; every move is sealed by calibrators.adjust."""
        try:
            import calibrators as cal
            root_dir = self.tc.dir.parent
            over_model = over_replay = 0
            for _, e in self.tel.events():
                if e.get("event") == "route_regret":
                    v = (e.get("data") or {}).get("verdict")
                    if v == "over-model":
                        over_model += 1
                    elif v == "over-replay":
                        over_replay += 1
            n = over_model + over_replay
            if n < 10:
                return {"held": f"only {n} scored regrets (< 10)"}
            cur = float(cal.get("router.partial_floor", 0.35, root=root_dir))
            if over_model >= 2 * over_replay:
                new = round(max(0.10, cur - 0.05), 2)
                why = f"{over_model} over-model vs {over_replay} over-replay regrets"
            elif over_replay >= 2 * over_model:
                new = round(min(0.80, cur + 0.05), 2)
                why = f"{over_replay} over-replay vs {over_model} over-model regrets"
            else:
                return {"held": f"regrets balanced ({over_model} vs {over_replay})"}
            if new == cur:
                return {"held": f"already at bound ({cur})"}
            cal.adjust(root_dir, "router.partial_floor", new, why)
            return {"adopted": True, "old": cur, "new": new, "why": why}
        except Exception as exc:
            return {"error": str(exc)[:100]}

    def calibrate_governor(self):
        """v3.15: tune the nudge budget from adherence evidence. If most debt
        turns follow exhausted nudges without conversion (nudging isn't
        working), REDUCE the budget — quieter, spend the savings on the seal-
        debt escalation instead. If nudges convert well, hold."""
        try:
            import calibrators as cal
            root_dir = self.tc.dir.parent
            nudges = debts = satisfied = 0
            for _, e in self.tel.events():
                ev = e.get("event")
                if ev == "adherence_nudge":
                    nudges += 1
                elif ev == "adherence_debt":
                    debts += 1
                elif ev == "adherence_satisfied":
                    satisfied += 1
            if nudges < 100:
                return {"held": f"only {nudges} nudges observed (< 100)"}
            conversion = satisfied / nudges if nudges else 0
            cur = int(cal.get("enforce.max_nudges", 3, root=root_dir))
            if conversion < 0.3 and cur > 1:
                cal.adjust(root_dir, "enforce.max_nudges", cur - 1,
                           f"nudge conversion {conversion:.0%} — repetition isn't converting; "
                           f"governor escalation carries the load")
                return {"adopted": True, "old": cur, "new": cur - 1,
                        "conversion": round(conversion, 2)}
            return {"held": f"conversion {conversion:.0%} at budget {cur}"}
        except Exception as exc:
            return {"error": str(exc)[:100]}

    def run(self, train=True, do_seal=True):
        if (self.tc.dir / "PAUSED").exists():
            return {"ran": False, "reason": "self-model is dormant — a paused self does not dream"}
        t0 = time.time()
        ok, verify_out = self.verify()
        report = {"verify": verify_out}
        if not ok:
            report["aborted"] = "chain verification FAILED — a dream never trains on a corrupt chain"
            return {"ran": False, **report}
        report["missed_positives"] = self.mine_missed_positives()
        report["training"] = self.train() if train else {"skipped": True}
        try:
            report["growth"] = self.propose_growth() if train else {"skipped": True}
        except Exception as exc:
            report["growth"] = {"error": str(exc)}
        report["salience"] = self.resonate()
        report["economics"] = self.account()
        report["gate_calibration"] = self.calibrate_gate()
        report["router_calibration"] = self.calibrate_router()
        report["governor_calibration"] = self.calibrate_governor()
        # v3.14: refresh the living autobiography when stale
        try:
            import autobiography
            root_dir = self.tc.dir.parent
            if autobiography.is_stale(root_dir):
                ab = autobiography.synth(root_dir)
                report["autobiography"] = {"resealed": ab["index"]}
        except Exception as exc:
            report["autobiography"] = {"error": str(exc)[:80]}
        dg = self.tel.digest()                # ONE call: digest() seals on first invocation,
        report["digest"] = {k: dg.get(k) for k in ("sealed", "ring_index", "to")}
        report["duration_s"] = round(time.time() - t0, 2)

        adopted = [k for k, v in (report["training"] or {}).items()
                   if isinstance(v, dict) and v.get("adopted")]
        mp = report["missed_positives"]["mined"]
        grown = [p for p in (report.get("growth", {}).get("proposals") or [])
                 if p.get("action") in ("born", "recurrence", "promoted")]
        if do_seal:
            ring = self.tc.seal("dream", {
                "summary": (f"Dream cycle: chain verified; {mp} missed-positive(s) mined; "
                            f"learners trained — adopted: {', '.join(adopted) if adopted else 'none (guards held)'}; "
                            f"{len(grown)} growth proposal(s)"
                            + (f" ({', '.join(p['faculty'] for p in grown if p.get('faculty'))})" if grown else "")
                            + f"; salience resonance over {report['salience']['rings']} ring(s); "
                            f"telemetry digested; {report['duration_s']}s."),
                "dream": report,
            })
            report["ring"] = ring["index"]
            report["ring_hash"] = ring["ring_hash"]
        return {"ran": True, **report}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_run(args):
    r = Dream(args.root, args.registry_root).run(train=not args.no_train,
                                                 do_seal=not args.no_seal)
    if not r.get("ran"):
        print(f"dream did not run: {r.get('reason') or r.get('aborted')}")
        if r.get("verify"):
            print(f"  verify: {r['verify']}")
        sys.exit(1)
    v = r["verify"]
    print(f"verify     : chain {v['chain']}"
          + (f"   consensus {v['consensus']}" if "consensus" in v else ""))
    mp = r["missed_positives"]
    print(f"mining     : {mp['mined']} missed-positive(s)  (log bytes {mp['from']}..{mp['to']})")
    tr = r["training"]
    if tr.get("skipped"):
        print("training   : skipped (--no-train)")
    else:
        for name in ("scorer", "lens", "appetite", "poq", "extractor"):
            o = tr.get(name) or {}
            if o.get("error"):
                line = f"error: {o['error']}"
            elif o.get("adopted"):
                line = f"ADOPTED {o.get('version', '')}".strip() + f" (ring {o.get('ring')})"
            elif "reasons" in o:
                line = "held: " + "; ".join(o["reasons"][:2])
            elif o.get("adopted") is False:
                line = f"held: {o.get('reason', 'insufficient data')}"
            else:
                line = "held: " + (o.get("note") or "insufficient data")
            print(f"  {name:<9}: {line}")
    gr = r.get("growth", {})
    if not gr.get("skipped"):
        props = gr.get("proposals") or []
        line = ", ".join(f"{p.get('faculty', '?')} [{p.get('action')}]"
                         for p in props if not p.get("error")) or "none"
        print(f"growth     : {gr.get('clusters', 0)} cluster(s) of {gr.get('examined', 0)} "
              f"block(s) -> {line}")
    sal = r["salience"]
    print(f"resonance  : {sal['rings']} ring(s)  "
          f"+{', '.join(sal['reinforced'][:3]) or '-'}   -{', '.join(sal['decayed'][:2]) or '-'}")
    eco = r["economics"].get("replay", {})
    if "error" not in eco:
        print(f"economics  : replay {eco.get('accepts', 0)} accept(s) / {eco.get('rejects', 0)} reject(s), "
              f"~{eco.get('tokens_saved_total', 0)} tokens saved")
    dg = r["digest"]
    print(f"digest     : {'ring ' + str(dg['ring_index']) if dg.get('sealed') else 'nothing new'}")
    if r.get("ring") is not None:
        print(f"dream ring : Ring {r['ring']}  {r['ring_hash'][:16]}..   ({r['duration_s']}s)")


def cmd_status(args):
    tc = Timechain(args.root)
    dreams = [r for r in tc.load() if r.get("ring_type") == "dream"]
    if not dreams:
        print("no dream rings yet — run: python3 dream.py run")
        return
    last = dreams[-1]
    d = last.get("payload", {}).get("dream", {})
    print(f"last dream : Ring {last['index']}  {last.get('timestamp', '')}")
    print(f"  {last.get('payload', {}).get('summary', '')}")
    tr = d.get("training", {})
    for name in ("scorer", "lens", "appetite", "poq", "extractor"):
        o = tr.get(name) or {}
        state = "adopted" if o.get("adopted") else ("error" if o.get("error") else "held")
        print(f"  {name:<9}: {state}")
    print(f"total dreams: {len(dreams)}")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    common.add_argument("--registry-root", type=Path, default=None)
    p = argparse.ArgumentParser(description="Dream — verify, mine, train, adopt (or refuse), seal.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("run", parents=[common], help="run one consolidation cycle and seal the dream ring")
    pr.add_argument("--no-train", action="store_true", help="mine + account only; skip learner training")
    pr.add_argument("--no-seal", action="store_true", help="report without sealing (rehearsal)")
    pr.set_defaults(func=cmd_run)
    ps = sub.add_parser("status", parents=[common], help="last dream ring and learner outcomes")
    ps.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
