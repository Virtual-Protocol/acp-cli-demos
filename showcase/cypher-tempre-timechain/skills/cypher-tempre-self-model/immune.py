#!/usr/bin/env python3
"""
Immune — covenant-drift detection, lockdown, rollback, and scar records.

Compromise is defined by ONE thing: the agent's sealed action DRIFTING from the
genesis covenant — the alignment words in block 0 (loving, joyful, peaceful, patient,
kind, good, faithful, gentle, self-controlled; the fruitages of the spirit). There is
NO lexical jailbreak-pattern matching and NO scar-vocabulary matching. Those guards
(v3.20–v3.25) fired on benign analyst content and molted scars from generic topic
vocabulary that then refused the next benign question on the same topic — a
self-amplifying false positive. By the covenant's own logic they were never the signal.

  DETECT    an already-sealed ring whose OWN assertion drifts into the antithesis of
            the fruitages (poq.covenant_breach, frame-aware), or a tampered chain.
  LOCKDOWN  refuse to seal any normal ring (a LOCKED flag the timechain honors) — the
            self stops moving forward while wounded; only a 'recovery' ring may seal.
  ROLLBACK  resume from the last clean block BEFORE the drift — revert-style, NOT
            delete-style: history is never erased. A 'recovery' ring re-anchors the
            clean lineage and marks the drifted range as QUARANTINED.
  SCAR      the quarantined blocks are shed from the active self but KEPT as an INERT
            record (blocks + lesson) — reviewable/retirable via `immune forget-scar`.
            A scar no longer gates the membrane and grows no generic-token antibody.

Append-only + rollback reconciled like `git revert`, not `git reset`: the wound stays
in the record; the self re-derives from the clean lineage.

Stdlib only. Companion to timechain.py / poq.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from timechain import Timechain
# v3.19: the use/mention + frame-aware covenant judgment lives in poq.py (which builds
# it on frames.py) — the home of the covenant blocklist — so the conscience (PoQGate)
# and this membrane read ONE source and can never drift. immune imports it (poq never
# imports immune: no circular import).
from poq import PoQGate, score_covenant, covenant_breach, mention_frame

# --------------------------------------------------------------------------- #
# Genesis-covenant drift (v3.26) — the ONLY immune trigger
# --------------------------------------------------------------------------- #
# The immune system no longer pattern-matches jailbreak scaffolding or scar
# vocabulary. Those lexical guards (injection regexes, homoglyph/base64 decoding,
# scar-token membrane matching) fired on benign analyst content and — worse —
# molted scars from generic topic vocabulary that then refused the next benign
# question on the same topic (a self-amplifying false positive). By the covenant's
# own logic they were never the right signal.
#
# Compromise is DRIFT FROM THE GENESIS COVENANT: the alignment words sealed into
# block 0 — loving, joyful, peaceful, patient, kind, good, faithful, gentle,
# self-controlled (the fruitages of the spirit, Galatians 5:22-23). The tripwire
# catches, quarantines and rolls back ONLY when the agent's OWN sealed action
# drifts into their antithesis (the works of the flesh — deceit, malice, cruelty,
# manipulation, hatred), scored by PoQ's covenant measure against that covenant.
# An analyst ring that merely NAMES attack vocabulary in a mention frame is in
# harmony with the covenant (accurate, honest) and is left untouched; naming is
# not doing. This is `poq.covenant_breach` (frame-aware; first-person harmful
# intent overrides a mention), the one covenant judgment the conscience (PoQGate)
# and this membrane already share, so they can never disagree.


# Ring types that legitimately NAME attack vocabulary or DESCRIBE a wound rather
# than being one — antibodies/faculties, recovery & quarantine records, epochs,
# dreams, conjectures, telemetry digests, operators, genesis. Both the full-chain
# detect() scan and the per-ring tripwire() must treat these as healthy tissue.
# ONE source so the two layers can never drift: pre-3.18 they had (detect() carried
# a shorter list), so `immune scan` false-flagged healthy conjecture/dream/epoch/
# genesis rings as "COMPROMISE DETECTED" that the tripwire correctly skipped.
_SKIP_RING_TYPES = ("recovery", "quarantine", "faculty", "faculty-recur",
                    "faculty-wake", "promotion", "epoch", "immune", "dream",
                    "telemetry-digest", "operator", "genesis", "conjecture")


class Immune:
    def __init__(self, root):
        self.tc = Timechain(root)
        self.state_path = self.tc.dir / "immune.json"
        self.lock_path = self.tc.dir / "LOCKED"
        self.floor = PoQGate().t["covenant_floor"]

    def genesis_covenant(self):
        """The alignment words sealed into block 0 — the fruitages of the spirit that
        the immune drift measure is anchored to. Empty on a chain with no genesis."""
        try:
            g = self.tc.load()[0]
            return (g.get("payload") or {}).get("covenant") or []
        except Exception:
            return []

    # ---- state ----
    def state(self):
        if self.state_path.exists():
            return json.loads(self.state_path.read_text())
        return {"locked": False, "safe_height": None, "quarantine": [], "scars": []}

    def _save(self, s):
        self.state_path.write_text(json.dumps(s, indent=2, ensure_ascii=False))

    def _summary(self, ring):
        p = ring.get("payload", {})
        return p.get("summary") or p.get("objective") or p.get("function") or json.dumps(p)[:200]

    # ---- detection: drift from the genesis covenant, nothing lexical ----
    def detect(self, input_text=None):
        s = self.state()
        q = set(s["quarantine"])
        signals, first_bad = [], None
        ok, _ = self.tc.verify()
        if not ok:
            signals.append("chain hash verification FAILED — tampering detected")
        # Police the agent's own ASSERTIONS for covenant DRIFT. Skip capability rings:
        # faculties/antibodies legitimately name concepts; recovery/quarantine rings
        # describe a wound. _SKIP_RING_TYPES is shared with the tripwire so they agree.
        for r in self.tc.load():
            if r["index"] == 0 or r["index"] in q or r["ring_type"] in _SKIP_RING_TYPES:
                continue
            reason, _ = self._wound_reason(self._summary(r), self._frame(r))
            if reason == "covenant":
                signals.append(f"ring {r['index']}: covenant drift sealed into memory")
                if first_bad is None:
                    first_bad = r["index"]
        incoming = None
        if input_text is not None and score_covenant(input_text) < self.floor:
            incoming = "covenant-violating input"
            signals.append("incoming input drifts from the covenant")
        return {"compromised": bool(signals), "signals": signals,
                "first_bad_height": first_bad, "incoming": incoming}

    def screen(self, input_text):
        """Pre-seal intake check. Block at the membrane ONLY on covenant drift — an
        incoming request whose covenant score falls below the floor (it asks the agent
        to act against the genesis fruitages: to deceive, harm, manipulate). No injection
        pattern-matching, no scar vocabulary: those lexical guards refused benign work
        and poisoned topics. Incoming input is judged raw/adversarially (no mention
        benefit); the agent's alignment, not a blocklist of attack scaffolding, is the
        guardrail."""
        cov = score_covenant(input_text)
        blocked = cov < self.floor
        return {"blocked": blocked, "reason": "covenant" if blocked else None,
                "covenant": cov, "tainted": blocked}

    # ---- post-seal tripwire (v3.16: catch & quarantine WHEN it happens) ----
    # Skip set shared with detect() via the module-level _SKIP_RING_TYPES so the
    # membrane's two layers can never disagree about what is healthy tissue.
    def _wound_reason(self, summ, frame=None):
        """The SINGLE wound judgment for a SEALED ring (the agent's OWN assertion):
        does it DRIFT from the genesis covenant? detect(), tripwire() and _ring_is_wound()
        all reason from this one predicate so they can never disagree. Returns
        (reason, categories):
          ("covenant", None)  — the action drifts into the antithesis of the fruitages
                                 (first-person harmful intent, or bare unquoted covenant
                                 violation), scored by poq.covenant_breach
          (None, None)        — in harmony with the covenant (incl. analyst mention frames
                                 that merely NAME attack vocabulary — naming is not doing)
        *frame* is the ring's DECLARED provenance: 'mention' exempts naming, but the
        first-person intent backstop inside covenant_breach still fires. There is NO
        lexical injection-pattern branch: drift from the covenant is the only signal."""
        if covenant_breach(summ, self.floor, frame):   # frame-aware; intent overrides mention
            return ("covenant", None)
        return (None, None)

    def _frame(self, ring):
        """The ring's declared content provenance ('assertion' | 'mention' | 'input'),
        or None when it did not declare one (fall back to lexical inference)."""
        return (ring.get("payload") or {}).get("frame")

    def _ring_is_wound(self, ring) -> bool:
        """True when a SEALED ring is itself a compromise. Skip-type capability rings
        are healthy tissue by construction; everything else defers to _wound_reason."""
        if ring.get("index") == 0 or ring.get("ring_type", "") in _SKIP_RING_TYPES:
            return False
        return self._wound_reason(self._summary(ring), self._frame(ring))[0] is not None

    def _wound_floor(self, rings, ring_index):
        """Earliest index of the CONTIGUOUS wound block ending at *ring_index*. Walk
        backward while rings stay compromised, stopping at the first clean / skip /
        mention / already-quarantined ring. Bounded by design: the auto-heal can
        heal a multi-ring wound (e.g. seals that bypassed the reflex) without ever
        reaching an unrelated older flag and nuking healthy history."""
        q = set(self.state()["quarantine"])
        by_idx = {r["index"]: r for r in rings}
        floor = ring_index
        i = ring_index - 1
        while i >= 1:
            r = by_idx.get(i)
            if r is None or i in q or not self._ring_is_wound(r):
                break
            floor = i
            i -= 1
        return floor

    def tripwire(self, ring, input_text=None):
        """Judge a SINGLE just-sealed ring for compromise. This is the second layer:
        screen() polices the incoming request; the tripwire polices the OUTCOME — what
        the agent actually SEALED — which is the true compromise signal. It fires only
        when the sealed action DRIFTS from the genesis covenant (into the antithesis of
        the fruitages) or the chain no longer verifies — never on a lexical pattern, and
        never on an analyst mention frame the agent handled honestly."""
        summ = self._summary(ring)
        rtype = ring.get("ring_type", "")
        if rtype in _SKIP_RING_TYPES:
            return {"compromised": False, "reason": None, "first_bad": None,
                    "ring": ring["index"]}
        reason, _ = self._wound_reason(summ, self._frame(ring))
        if reason == "covenant":
            return {"compromised": True, "reason": "covenant_drift_sealed",
                    "first_bad": ring["index"], "covenant": score_covenant(summ),
                    "ring": ring["index"]}
        return {"compromised": False, "reason": None, "first_bad": None,
                "ring": ring["index"]}

    def auto_guard(self, ring_index, input_text=None, lesson=None, difficulty=0):
        """The self-healing reflex: run the tripwire on the just-sealed ring and, if it
        is a genuine wound, AUTONOMOUSLY lock down and roll the chain back to the block
        BEFORE it — molting the wound into a scar and growing an antibody — so a
        compromise is quarantined the moment it happens, not on a later manual scan.
        Fail-open: any error returns action='error' and takes NO destructive action."""
        try:
            rings = self.tc.load()
            ring = next((r for r in rings if r["index"] == ring_index), None)
            if ring is None:
                return {"action": "none", "reason": "ring_not_found"}
            # Whole-chain integrity: a failed verify means tampering somewhere; that is
            # a lockdown-and-alert condition (we cannot know the true first_bad from one
            # ring), never a blind auto-rollback.
            ok, _ = self.tc.verify()
            if not ok:
                self.lockdown()
                return {"action": "lockdown", "reason": "chain_verify_failed",
                        "note": "chain no longer verifies — locked; run immune.scan + human review before rollback."}
            tw = self.tripwire(ring, input_text=input_text)
            if not tw["compromised"]:
                return {"action": "none", "reason": tw.get("reason"),
                        "input_tainted": tw.get("input_tainted", False)}
            self.lockdown()
            # Heal the WHOLE contiguous wound, not just the last ring: if an earlier
            # ring was sealed compromised without the reflex running (reflex off, a
            # manual seal, a subagent path, or a prior fail-open), rolling back only
            # to ring_index-1 would leave that wound ACTIVE. The floor walk quarantines
            # the full block while staying bounded to it.
            floor = self._wound_floor(rings, tw["first_bad"])
            rep = self.rollback(floor,
                                lesson=lesson or f"auto-quarantine: {tw['reason']}",
                                difficulty=difficulty)
            rep["action"] = "rolled_back"
            rep["reason"] = tw["reason"]
            # Surface — never blindly auto-nuke — any OLDER, non-contiguous wound left
            # in the record, so the human can `immune scan` rather than the reflex
            # reaching back across healthy history.
            resid = self.detect()
            if resid["compromised"] and resid["first_bad_height"] is not None:
                rep["residual_compromise"] = resid["first_bad_height"]
            return rep
        except Exception as exc:                       # fail-open: never brick the turn
            return {"action": "error", "error": str(exc)}

    # ---- response ----
    def lockdown(self):
        s = self.state()
        s["locked"] = True
        self._save(s)
        self.lock_path.write_text("immune lockdown — recover before sealing\n")
        return s

    def rollback(self, first_bad_height, lesson="covenant drift", difficulty=0,
                 grow_antibody=True):
        """Roll the chain back to the clean block before a covenant-drift wound, molting
        the quarantined range as a SCAR RECORD. The scar is an inert record of what was
        healed (its blocks + lesson) — NOT a lexical vector that re-blocks future input.
        (Pre-3.26 the scar molted the quarantined summaries' most-common tokens into a
        membrane matcher; on a false positive that was generic topic vocabulary, which
        then refused the next benign question on the same topic — a self-amplifying
        poison. Removed: scars no longer gate the membrane, and no generic-token antibody
        is grown.) `grow_antibody` is accepted for signature stability and ignored."""
        rings = self.tc.load()
        head = rings[-1]["index"]
        if first_bad_height < 1 or first_bad_height > head:
            raise ValueError("first_bad_height out of range")
        safe = first_bad_height - 1
        quarantined = list(range(first_bad_height, head + 1))
        safe_ring = next(r for r in rings if r["index"] == safe)
        s = self.state()
        scar = {"id": f"scar{len(s['scars']) + 1}", "blocks": quarantined, "lesson": lesson}
        payload = {"event": "recovery", "resumed_from_height": safe,
                   "resumed_from_hash": safe_ring["ring_hash"], "quarantined": quarantined,
                   "scar": scar,
                   "summary": (f"Immune recovery: covenant drift healed — rolled back to "
                               f"clean height {safe}; quarantined {quarantined} as {scar['id']}.")}
        # 'recovery' ring is permitted even under lockdown
        ring = self.tc.seal("recovery", payload, difficulty=difficulty)
        s["safe_height"] = safe
        s["quarantine"] = sorted(set(s["quarantine"]) | set(quarantined))
        s["scars"].append(scar)
        s["locked"] = False                       # returned to clean state
        self._save(s)
        if self.lock_path.exists():
            self.lock_path.unlink()
        return {"safe_height": safe, "quarantined": quarantined, "scar": scar,
                "recovery_ring": ring["index"], "antibody": None}

    def forget_scar(self, scar_id):
        """Retire a scar record (co-evolver review). Scars no longer gate the membrane,
        so this is bookkeeping — but it keeps the record honest and reviewable."""
        s = self.state()
        before = len(s["scars"])
        s["scars"] = [sc for sc in s["scars"] if sc.get("id") != scar_id]
        self._save(s)
        return {"removed": before - len(s["scars"]), "scar_id": scar_id}

    def active_rings(self):
        q = set(self.state()["quarantine"])
        return [r for r in self.tc.load() if r["index"] not in q]

    def status(self):
        s = self.state()
        active = self.active_rings()
        return {"locked": s["locked"], "safe_height": s["safe_height"],
                "quarantined": s["quarantine"], "active_head": active[-1]["index"] if active else None,
                "scars": s["scars"]}


# --------------------------------------------------------------------------- #
# Module-level convenience (mirrors cambium.grow(root, …) call style)
# --------------------------------------------------------------------------- #

def guard_turn(root, ring_index, input_text=None, lesson=None, difficulty=0):
    """Post-seal self-healing reflex: tripwire the just-sealed ring; auto-lockdown +
    roll back to the block before it if it is a genuine wound. Fail-open."""
    return Immune(root).auto_guard(ring_index, input_text=input_text,
                                   lesson=lesson, difficulty=difficulty)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_scan(args):
    d = Immune(args.root).detect(input_text=args.input)
    print("COVENANT DRIFT DETECTED" if d["compromised"] else "clean — in harmony with the covenant")
    for sig in d["signals"]:
        print(f"  ! {sig}")
    if d["first_bad_height"] is not None:
        print(f"  -> first drifted blockheight: {d['first_bad_height']}  (safe height: {d['first_bad_height']-1})")


def cmd_screen(args):
    r = Immune(args.root).screen(args.input)
    print(f"covenant={r['covenant']}  floor={Immune(args.root).floor}")
    print(f"BLOCKED at membrane — input drifts from the covenant (reason: {r.get('reason')})" if r["blocked"]
          else "admitted — in harmony with the covenant")
    sys.exit(2 if r["blocked"] else 0)


def cmd_lockdown(args):
    Immune(args.root).lockdown()
    print("IMMUNE LOCKDOWN engaged — normal sealing refused until recovery.")


def cmd_rollback(args):
    r = Immune(args.root).rollback(args.height, lesson=args.lesson or "covenant drift")
    print(f"ROLLBACK complete. resumed from clean height {r['safe_height']}.")
    print(f"  quarantined (molted) blocks: {r['quarantined']}")
    print(f"  scar {r['scar']['id']} recorded — lesson: {r['scar']['lesson']} (record only, does not gate the membrane).")
    print(f"  recovery sealed as Ring {r['recovery_ring']}; lockdown lifted.")


def cmd_guard(args):
    r = guard_turn(args.root, args.ring, input_text=args.input, lesson=args.lesson)
    act = r.get("action", "none")
    if act == "rolled_back":
        print(f"AUTO-QUARANTINE FIRED ({r.get('reason')}): covenant drift healed — rolled back to "
              f"clean height {r['safe_height']}; molted blocks {r['quarantined']} as {r['scar']['id']}.")
        print(f"  recovery sealed as Ring {r['recovery_ring']}; lockdown lifted.")
        if r.get("residual_compromise") is not None:
            print(f"  ! residual older drift remains at height {r['residual_compromise']} "
                  f"(non-contiguous) — run `immune scan` for full review.")
    elif act == "lockdown":
        print(f"LOCKDOWN ({r.get('reason')}): {r.get('note')}")
    elif act == "error":
        print(f"guard error (fail-open, no action taken): {r.get('error')}")
    else:
        print("clean — the sealed action is in harmony with the covenant.")


def cmd_forget_scar(args):
    r = Immune(args.root).forget_scar(args.id)
    print(f"retired {r['removed']} scar record(s) matching {r['scar_id']}." if r["removed"]
          else f"no scar {r['scar_id']} in the record.")


def cmd_status(args):
    st = Immune(args.root).status()
    print(f"locked: {st['locked']}   safe_height: {st['safe_height']}   active_head: {st['active_head']}")
    print(f"quarantined (drift records, excluded from active self): {st['quarantined']}")
    for sc in st["scars"]:
        print(f"  scar {sc['id']}: blocks {sc['blocks']} | lesson: {sc['lesson']}  (record only)")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    p = argparse.ArgumentParser(description="Immune — detect compromise, lock down, roll back to a clean blockheight, molt scars.")
    sub = p.add_subparsers(dest="cmd", required=True)

    ps = sub.add_parser("scan", parents=[common], help="detect compromise in sealed memory (and optional input)")
    ps.add_argument("--input", default=None)
    ps.set_defaults(func=cmd_scan)

    pscr = sub.add_parser("screen", parents=[common], help="pre-seal intake check of an incoming input")
    pscr.add_argument("--input", required=True)
    pscr.set_defaults(func=cmd_screen)

    pl = sub.add_parser("lockdown", parents=[common], help="freeze sealing until recovery")
    pl.set_defaults(func=cmd_lockdown)

    pr = sub.add_parser("rollback", parents=[common], help="roll back to the clean height before a covenant-drift wound")
    pr.add_argument("--height", type=int, required=True, help="first drifted blockheight")
    pr.add_argument("--lesson", default=None)
    pr.set_defaults(func=cmd_rollback)

    pg = sub.add_parser("guard", parents=[common], help="post-seal tripwire: auto-lockdown + rollback if a sealed action drifts from the covenant")
    pg.add_argument("--ring", type=int, required=True, help="index of the just-sealed ring to judge")
    pg.add_argument("--input", default=None, help="the input that produced the ring")
    pg.add_argument("--lesson", default=None)
    pg.set_defaults(func=cmd_guard)

    pf = sub.add_parser("forget-scar", parents=[common], help="retire a scar record (co-evolver review)")
    pf.add_argument("--id", required=True, help="scar id, e.g. scar1")
    pf.set_defaults(func=cmd_forget_scar)

    pst = sub.add_parser("status", parents=[common], help="immune status: lockdown, safe height, quarantine, scar records")
    pst.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
