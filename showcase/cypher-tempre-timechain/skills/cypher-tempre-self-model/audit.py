#!/usr/bin/env python3
# Copyright (c) 2026 cyberphysicsai. MIT License.
"""Audit — an exhaustive-review coverage governor on top of Continuum.

THE PROBLEM THIS FIXES. Continuum guarantees that a corpus larger than any
context window gets *ingested* into a navigable, resumable chain. It does NOT
prove the model has *semantically reviewed* every block. So on a "read every
line / no corners / full audit" task, a model walks the repo (ingest = 100%),
does a seductive round of high-risk *retrieval* + grep, writes a "Final Report",
and stops — converting an EXHAUSTIVE audit into a TARGETED one without noticing.
The common failure is a chain that shows 100% INGEST coverage with "findings" that
are really structural metadata (line/def/class counts), not line-by-line review.

THE GOVERNOR. This module separates INGEST coverage from REVIEW coverage and
drives completion off an unreviewed-block queue:

  audit.py open      --root <chain> --objective "..."   # init review ledger over an ingested chain
  audit.py next      --root <chain> --batch-size N       # hand back the next UNREVIEWED blocks to read
  audit.py record    --root <chain> --block I... (--finding "..." | --clean)
  audit.py progress  --root <chain>                      # reviewed blocks/files/lines vs total
  audit.py validate  --root <chain> [--require-complete] # PROVE every in-scope block has a review record
  audit.py report    --root <chain> [--final]            # refuses "FINAL" below 100% — labels "INTERIM"

DESIGN. The hot path (progress, the enforce.py turn-end governor) reads an O(1),
*bounded* audit sub-state from the head block (reviewed counts + recent findings).
The queue and final proof stream the chain, rebuild the reviewed set from sealed
`audit_review` rings, and compare it against the in-scope continuum blocks. That
means out-of-order reviews do not strand missed blocks, and the final report never
rests on a sequential assumption.

Stdlib only. Python 3.8+. Companion to continuum.py / timechain.py.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from timechain import Timechain

# Content-anchoring (proof of reading): a DEEP review must cite something REAL from
# the block it covers — a specific symbol/literal present in the block's content, or a
# line number inside the block's range. This is what makes "deep" mean "I read this"
# rather than "I wrote 60 lexically-rich characters". Generic words can't anchor.
_ANCHOR_STOP = set("""the and for that this with from have your you are was were will would
should could function functions return value values class self import const variable true false
null none code line lines file files block blocks review reviewed reading read looks fine good
clean checks checked audit audited error errors test tests pass passes path paths data input
output method methods object pattern standard mirrors version async sync logic handles handler""".split())


def _finding_anchors_in(finding, blocks):
    """True if `finding` cites something that ACTUALLY appears in the block's content: a
    specific identifier/symbol (>=5 chars, not generic), or a multi-digit literal. This is
    proof the model read the block. (A line NUMBER alone is NOT accepted — `next` prints the
    line range in its header, so citing an in-range line is gameable without reading; only a
    token/literal that is genuinely IN the content survives. The `challenge` command then
    double-verifies by demanding an exact quote.)"""
    if not finding or not blocks:
        return False
    texts = "\n".join((b.get("content") or "").lower() for b in blocks)
    for tok in re.findall(r"[A-Za-z_][A-Za-z0-9_]{4,}|\w+\.\w+|\w+\(\)", finding):
        t = tok.lower().rstrip("()")
        if len(t) >= 5 and t not in _ANCHOR_STOP and t in texts:
            return True
    for num in re.findall(r"\b\d{2,}\b", finding):       # a literal (not a line ref) present in the code
        if num in texts:
            return True
    return False

# Roles that are NOT authored source lines, so excluded from "every line" by
# default. Override with --roles / --exclude-roles at `open`.
DEFAULT_EXCLUDE_ROLES = {"generated", "vendor"}
RECENT_FINDINGS_CAP = 8           # bounded recent-findings window in the head state


# The enforce.py audit governor reads this pointer (next to the skill's own chain)
# to know which task chain is under active review. Set on `open`, cleared on
# completion or `close`.
def _pointer_path():
    # The pointer lives in the enforce.py namespace so the governor finds it at
    # the same root it reads: CT_ENFORCE_ROOT if set (also keeps selftest
    # hermetic), else the skill dir.
    import os
    base = os.environ.get("CT_ENFORCE_ROOT")
    root = Path(base) if base else Path(__file__).resolve().parent
    return root / "chain" / ".active_audit"


def _set_active(root):
    try:
        p = _pointer_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"root": str(Path(root).resolve())}))
    except Exception:
        pass


def _clear_active(root=None):
    try:
        p = _pointer_path()
        if not p.is_file():
            return
        if root is None:
            p.unlink()
            return
        cur = (json.loads(p.read_text()) or {}).get("root")
        if cur and Path(cur).resolve() == Path(root).resolve():
            p.unlink()
    except Exception:
        pass


def _is_continuum_block(payload):
    return (payload or {}).get("event") == "continuum" and "data" in (payload or {})


def _block_lines(data):
    try:
        return max(0, int(data["line_end"]) - int(data["line_start"]) + 1)
    except Exception:
        return 0


def _in_scope(data, scope):
    role = data.get("path_role")
    if role in set(scope.get("exclude_roles") or ()):
        return False
    roles = scope.get("roles")
    if roles and role not in set(roles):
        return False
    return True


class Audit:
    _last_anchor_warning = None        # set by record() when a finding cites nothing in the block

    def __init__(self, root):
        self.tc = Timechain(root)
        self.root = Path(root)

    # -- state -------------------------------------------------------------- #
    def _head_state(self):
        """The most recent full task state (continuum metrics + any audit
        sub-state), read O(1) from the tail, with bounded fallbacks."""
        last = self.tc._tail_ring()
        if last:
            st = (last.get("payload") or {}).get("state")
            if st:
                return st
        for r in reversed(self.tc.tail_rings(256)):
            st = (r.get("payload") or {}).get("state")
            if st:
                return st
        latest = None
        for r in self.tc.iter_rings():
            st = (r.get("payload") or {}).get("state")
            if st:
                latest = st
        return latest

    def status(self):
        """Bounded O(1) audit status from the head block (None if no audit open)."""
        st = self._head_state()
        return (st or {}).get("audit")

    def _review_sets(self, scope):
        """Return (in_scope, reviewed, deep) index sets by streaming the chain. `deep`
        is the set of in-scope blocks that have at least one DEEP review record — the
        authoritative depth ground truth, used to keep the cached counters correct when
        a shallow block is later re-reviewed deeply (a 'promotion')."""
        in_scope, reviewed, deep = set(), set(), set()
        for r in self.tc.iter_rings():
            p = r.get("payload") or {}
            if _is_continuum_block(p) and _in_scope(p["data"], scope):
                in_scope.add(r["index"])
            elif p.get("event") == "audit_review":
                d = p.get("data") or {}
                idxs = []
                for i in d.get("reviewed_indices", []):
                    try:
                        idxs.append(int(i))
                    except (TypeError, ValueError):
                        continue
                reviewed.update(idxs)
                if d.get("deep"):
                    deep.update(idxs)
        return in_scope, reviewed & in_scope, deep & in_scope

    # -- open --------------------------------------------------------------- #
    def open(self, objective=None, roles=None, exclude_roles=None, difficulty=0, strict_depth=True):
        st = self._head_state()
        if st is None:
            raise RuntimeError("No continuum task on this chain — run `continuum.py walk` first.")
        scope = {"roles": list(roles) if roles else None,
                 "exclude_roles": list(exclude_roles) if exclude_roles is not None
                 else sorted(DEFAULT_EXCLUDE_ROLES)}
        # One-time O(n) census of the in-scope reviewable blocks.
        total_blocks = total_lines = 0
        for r in self.tc.iter_rings():
            p = r.get("payload") or {}
            if _is_continuum_block(p) and _in_scope(p["data"], scope):
                total_blocks += 1
                total_lines += _block_lines(p["data"])
        if total_blocks == 0:
            raise RuntimeError("No in-scope continuum blocks found — check --roles/--exclude-roles "
                               "or ingest the corpus first.")
        st = json.loads(json.dumps(st))   # deep copy; preserve continuum metrics
        st["audit"] = {
            "objective": objective or st.get("objective"),
            "scope": scope,
            "total_blocks": total_blocks,
            "total_lines": total_lines,
            "review_cursor": 0,            # reviewed in-scope block count (bounded)
            "review_high_water": -1,       # legacy/non-authoritative max reviewed ring
            "reviewed_blocks": 0,
            "reviewed_lines": 0,
            "deep_reviews": 0,             # in-scope blocks with a DEEP (content-anchored) review
            "shallow_reviews": 0,          # bare "clean"/hollow records — coverage without depth
            "findings_total": 0,
            "recent_findings": [],
            # strict_depth (default): the governor stays engaged until every block is DEEPLY
            # reviewed — coverage alone (shallow --clean) cannot make it disengage. This is the
            # anti-skipping completion criterion. --coverage-only relaxes it to coverage-complete.
            "strict_depth": bool(strict_depth),
            "challenge_failures": 0,       # fabricated-review spot-checks that failed (see `challenge`)
            "complete": False,
            "next_action": f"audit.py next  (0/{total_blocks} blocks reviewed)",
        }
        ring = self.tc.seal("audit_open",
                            {"event": "audit_open", "objective": st["audit"]["objective"],
                             "state": st}, difficulty=difficulty)
        _set_active(self.root)        # engage the enforce.py turn-end governor
        return st["audit"], ring

    # -- next --------------------------------------------------------------- #
    def next_batch(self, batch_size=10):
        st = self._head_state()
        a = (st or {}).get("audit")
        if not a:
            raise RuntimeError("No audit open — run `audit.py open` first.")
        scope = a["scope"]
        _, reviewed, _ = self._review_sets(scope)
        out = []
        for r in self.tc.iter_rings():
            if r["index"] in reviewed:
                continue
            p = r.get("payload") or {}
            if _is_continuum_block(p) and _in_scope(p["data"], scope):
                d = p["data"]
                out.append({"index": r["index"], "path": d.get("relative_path"),
                            "line_start": d.get("line_start"), "line_end": d.get("line_end"),
                            "chunk": f"{d.get('chunk_index')}/{d.get('chunk_of')}",
                            "content": d.get("content", "")})
                if len(out) >= batch_size:
                    break
        return out, a

    # -- record ------------------------------------------------------------- #
    # Maximum blocks a single --clean call can cover. Prevents batch-skipping.
    # A model that records 50 blocks as --clean in one call did not read them.
    MAX_CLEAN_BATCH = 1
    # Maximum blocks per finding call. Findings require reading, but even so,
    # recording more than this in one call means some blocks were skimmed.
    MAX_FINDING_BATCH = 5
    # Minimum finding length (chars) to count as DEEP. Below this, the finding
    # is too thin to prove the model read the code.
    MIN_DEEP_FINDING_LEN = 60

    def record(self, indices, finding=None, clean=False, status="reviewed", difficulty=0):
        st = self._head_state()
        if st is None or "audit" not in st:
            raise RuntimeError("No audit open — run `audit.py open` first.")
        st = json.loads(json.dumps(st))
        a = st["audit"]
        idxset = set(int(i) for i in indices)
        if not idxset:
            raise RuntimeError("No block indices supplied.")

        in_scope, reviewed_before, deep_before = self._review_sets(a["scope"])
        invalid = sorted(idxset - in_scope)
        if invalid:
            raise RuntimeError("Block index(es) are not reviewable in-scope continuum blocks: "
                               + ", ".join(str(i) for i in invalid))

        # --- Anti-skipping guards ---
        # GAP 1 FIX: --clean is a model-asserted escape hatch. Limit batch size
        # so the model cannot record 50 unread blocks in one call.
        if clean and not finding:
            if len(idxset) > self.MAX_CLEAN_BATCH:
                raise RuntimeError(
                    f"--clean batch of {len(idxset)} blocks exceeds MAX_CLEAN_BATCH={self.MAX_CLEAN_BATCH}. "
                    "A --clean assertion means you read the block and found nothing — you cannot "
                    "batch-assert that for multiple blocks without reading them. Record each block "
                    "individually with --clean, or provide a --finding that cites what you read. "
                    "This guard exists because models skip reading on large corpora.")

        # GAP 1 FIX: Even findings have a batch cap — reading 20 blocks at once
        # means some were skimmed, not read line by line.
        if finding and len(idxset) > self.MAX_FINDING_BATCH:
            raise RuntimeError(
                f"Finding batch of {len(idxset)} blocks exceeds MAX_FINDING_BATCH={self.MAX_FINDING_BATCH}. "
                "Reading more than this in one record means some blocks were skimmed. "
                "Split into smaller batches and record each with specific line citations.")

        # GAP 1 FIX: A finding too short to cite specifics is not a deep review.
        # "looks fine" or "mirrors async" is not a line-by-line finding.
        if finding and len(finding) < self.MIN_DEEP_FINDING_LEN:
            raise RuntimeError(
                f"Finding too short ({len(finding)} chars, minimum {self.MIN_DEEP_FINDING_LEN}). "
                "A deep review must cite specific lines/symbols and articulate what was found. "
                "Short findings like 'looks fine' or 'mirrors async version' are shallow passes "
                "that skip reading. Cite the file, line range, and what you observed.")

        new_idxs = idxset - reviewed_before
        new_lines, paths, cited_blocks = 0, [], []
        for r in self.tc.iter_rings():
            if r["index"] not in idxset:
                continue
            p = r.get("payload") or {}
            d = p.get("data") or {}
            if r["index"] in new_idxs:
                new_lines += _block_lines(d)
            paths.append(d.get("relative_path"))
            cited_blocks.append({"content": d.get("content", ""),
                                 "line_start": d.get("line_start"), "line_end": d.get("line_end")})
        newly = len(new_idxs)
        reviewed_after = reviewed_before | idxset
        a["review_cursor"] = len(reviewed_after)
        a["reviewed_blocks"] = len(reviewed_after)
        a["reviewed_lines"] += new_lines
        a["review_high_water"] = max(reviewed_after) if reviewed_after else -1
        # Depth: coverage is not comprehension. A DEEP review needs a substantive finding
        # (>= floor richness, >= min length) AND a CONTENT ANCHOR — a symbol/line that
        # actually appears in the block. Lexical richness alone is gameable; the anchor is
        # proof the model read THIS block, not hand-waved 60 rich characters.
        depth, floor = 0, 90
        try:
            import modality_ops
            depth = modality_ops.richness(finding or "")["score"]
            floor = modality_ops.RICHNESS_FLOOR
        except Exception:
            pass
        anchored = _finding_anchors_in(finding, cited_blocks)
        is_deep = bool(finding) and depth >= floor and len(finding) >= self.MIN_DEEP_FINDING_LEN and anchored
        if finding and depth >= floor and len(finding) >= self.MIN_DEEP_FINDING_LEN and not anchored:
            self._last_anchor_warning = ("finding did not cite anything found in the block(s) — "
                                         "counted SHALLOW. Cite a specific symbol/literal or a line "
                                         "number inside the block to prove you read it.")
        else:
            self._last_anchor_warning = None
        # GAP-1 FIX (stale counters): count BLOCKS, not review ops, and handle PROMOTION
        # (a previously-shallow block re-reviewed deeply) so the cached counters never
        # disagree with the set-based validator.
        new_deep = newly if is_deep else 0
        promoted = ((idxset & reviewed_before) - deep_before) if is_deep else set()
        a["deep_reviews"] = a.get("deep_reviews", 0) + new_deep + len(promoted)
        a["shallow_reviews"] = max(0, a.get("shallow_reviews", 0) + (newly - new_deep) - len(promoted))
        if finding:
            tag = ", ".join(sorted(set(p for p in paths if p))) or "?"
            a["recent_findings"] = (a["recent_findings"] + [f"{tag}: {finding}"])[-RECENT_FINDINGS_CAP:]
            a["findings_total"] += 1
        # Depth-completing governor: by default (strict_depth) the audit is only "complete"
        # — and the turn-end governor only disengages — when every block is DEEPLY reviewed,
        # not merely covered. Shallow --clean coverage can no longer make the governor stop.
        coverage_complete = a["review_cursor"] >= a["total_blocks"]
        depth_complete = a.get("deep_reviews", 0) >= a["total_blocks"]
        a["complete"] = depth_complete if a.get("strict_depth", True) else coverage_complete
        if a["complete"]:
            a["next_action"] = "audit COMPLETE — `audit.py report --final`"
        elif a.get("strict_depth", True) and coverage_complete:
            need = a["total_blocks"] - a.get("deep_reviews", 0)
            a["next_action"] = (f"coverage 100% but {need} block(s) only SHALLOW — re-review them with "
                                f"cited specifics (audit.py next), or open with --coverage-only.")
        else:
            remaining = max(0, a["total_blocks"] - a["review_cursor"])
            a["next_action"] = (f"audit.py next  ({a['review_cursor']}/{a['total_blocks']} reviewed, "
                                f"{a.get('deep_reviews', 0)} deep, {remaining} to go)")
        data = {"reviewed_indices": sorted(idxset), "status": status,
                "clean": bool(clean and not finding),
                "finding": finding, "paths": [p for p in paths if p],
                "depth": depth, "deep": is_deep,
                "batch_size": len(idxset)}
        ring = self.tc.seal("audit_review",
                            {"event": "audit_review", "task": (a.get("objective") or "")[:48],
                             "state": st, "data": data}, difficulty=difficulty)
        if a["complete"]:
            _clear_active(self.root)  # coverage reached — stop the governor nagging
        return a, ring, newly

    def close(self):
        """Disengage the governor for this chain (pause/abandon an audit)."""
        _clear_active(self.root)

    # -- spot-check challenges (falsifiable proof of reading) ----------------- #
    def _block_content(self, index):
        for r in self.tc.iter_rings():
            if r["index"] == int(index):
                return ((r.get("payload") or {}).get("data") or {}).get("content")
        return None

    def challenge(self, n=1, seed=None):
        """Pick N already-DEEP-reviewed in-scope blocks at random and return their
        coordinates WITHOUT content. The model must then quote a real line/symbol from
        each (`audit.py answer`); a wrong quote flags a FABRICATED review. This makes a
        claimed deep review falsifiable — a model that didn't read block N cannot quote it."""
        import random
        a = self.status()
        if not a:
            raise RuntimeError("No audit open — run `audit.py open` first.")
        _, _, deep = self._review_sets(a["scope"])
        pool = sorted(deep)
        if not pool:
            return []
        want = set(random.Random(seed).sample(pool, min(n, len(pool))))
        out = []
        for r in self.tc.iter_rings():
            if r["index"] in want:
                d = (r.get("payload") or {}).get("data") or {}
                out.append({"index": r["index"], "path": d.get("relative_path"),
                            "line_start": d.get("line_start"), "line_end": d.get("line_end")})
        return out

    def answer(self, block_index, quote, difficulty=0):
        """Verify a challenge: does `quote` actually appear in block `block_index`? Seals
        an `audit_challenge` ring (pass/fail). A FAIL is on-chain evidence that the prior
        'deep' review was fabricated — it bumps `challenge_failures`, which validate/report
        surface so a final report on a fabricated audit can't be trusted."""
        content = self._block_content(block_index)
        if content is None:
            raise RuntimeError(f"Block {block_index} not found on this chain.")
        norm = lambda s: re.sub(r"\s+", " ", (s or "").strip().lower())
        q = norm(quote)
        passed = len(q) >= 6 and q in norm(content)
        st = json.loads(json.dumps(self._head_state()))
        aa = st.get("audit") or {}
        if not passed:
            aa["challenge_failures"] = aa.get("challenge_failures", 0) + 1
        ring = self.tc.seal("audit_challenge",
                            {"event": "audit_challenge", "state": st,
                             "data": {"block": int(block_index), "quote": str(quote)[:200],
                                      "passed": passed}}, difficulty=difficulty)
        return passed, ring

    # -- validate (rigorous, O(n)) ----------------------------------------- #
    def validate(self, require_complete=False, require_depth=False):
        ok, report = self.tc.verify()
        a = self.status()
        if not a:
            return False, list(report) + ["no audit open on this chain"]
        scope = a["scope"]
        in_scope, reviewed, deep = set(), set(), set()
        for r in self.tc.iter_rings():
            p = r.get("payload") or {}
            if _is_continuum_block(p) and _in_scope(p["data"], scope):
                in_scope.add(r["index"])
            elif p.get("event") == "audit_review":
                d = p.get("data") or {}
                idxs = [int(i) for i in d.get("reviewed_indices", [])]
                reviewed.update(idxs)
                if d.get("deep"):
                    deep.update(idxs)
        reviewed_in_scope = reviewed & in_scope
        deep_in_scope = deep & in_scope
        unreviewed = in_scope - reviewed
        shallow = reviewed_in_scope - deep_in_scope
        pct = (100.0 * len(reviewed_in_scope) / len(in_scope)) if in_scope else 0.0
        dpct = (100.0 * len(deep_in_scope) / len(in_scope)) if in_scope else 0.0
        out = list(report)
        out.append(f"audit objective: {a.get('objective')}")
        out.append(f"in-scope blocks: {len(in_scope)} (roles excl {scope.get('exclude_roles')})")
        out.append(f"reviewed (proven on-chain): {len(reviewed_in_scope)}/{len(in_scope)} = {pct:.2f}%")
        out.append(f"deep reviews (cited specifics): {len(deep_in_scope)}/{len(in_scope)} = {dpct:.2f}%")
        complete = not unreviewed and bool(in_scope)
        depth_complete = complete and not shallow
        if unreviewed:
            out.append(f"UNREVIEWED blocks remain: {len(unreviewed)} (e.g. rings {sorted(unreviewed)[:8]})")
            out.append("resume: `audit.py next` -> read -> `audit.py record`")
        else:
            out.append("every in-scope block has a sealed review record — coverage COMPLETE")
        if require_depth and shallow:
            out.append(f"SHALLOW blocks (reviewed but no substantive finding): {len(shallow)} "
                       f"(e.g. rings {sorted(shallow)[:8]}) — re-review with cited lines/symbols.")
            out.append(f"DEEP reviews: {len(deep_in_scope)} / {len(reviewed_in_scope)} "
                       f"({len(deep_in_scope)/max(1,len(reviewed_in_scope))*100:.0f}%). "
                       f"Shallow reviews do not count as reading the code.")
        passed = ok and (complete if require_complete else True) and (depth_complete if require_depth else True)
        return passed, out

    # -- report ------------------------------------------------------------- #
    # GAP 3 FIX: --final now requires depth by default. A 100%-coverage audit
    # where half the blocks are shallow --clean is not a complete audit.
    # The model must override with --allow-shallow to get a final report with
    # shallow blocks (explicit acknowledgment that it skipped reading).
    def report(self, final=False, require_depth=False, allow_shallow=False):
        # GAP 3 FIX: depth is required when explicitly asked OR for a final report
        # (unless --allow-shallow). This works the same from the CLI and the Python API
        # — the old default require_depth=True made allow_shallow=True silently ignored.
        effective_depth = require_depth or (final and not allow_shallow)
        ok, lines = self.validate(require_complete=True, require_depth=effective_depth)
        a = self.status() or {}
        # A failed spot-check (audit.py challenge) is on-chain evidence a 'deep' review was
        # fabricated — a fabricated audit cannot be finalized under depth.
        fails = a.get("challenge_failures", 0)
        if effective_depth and fails:
            ok = False
        bar = "coverage" + (" + depth" if effective_depth else "")
        head = []
        if final and ok:
            head.append("===== FINAL AUDIT REPORT =====")
        elif final and not ok and fails and effective_depth:
            head.append("===== INTERIM AUDIT REPORT (--final REFUSED: fabricated reviews) =====")
            head.append(f"{fails} spot-check challenge(s) FAILED — a claimed deep review could not")
            head.append("quote its own block. Those reviews are fabricated; re-read and re-record")
            head.append("the affected blocks with genuine cited specifics before finalizing.")
        elif final and not ok:
            head.append(f"===== INTERIM AUDIT REPORT (--final REFUSED: {bar} < 100%) =====")
            head.append("A 'final' report on an incomplete exhaustive audit is a persistence/")
            head.append("covenant miss. Keep going (audit.py next) or state this is interim.")
            if effective_depth and not allow_shallow:
                head.append("")
                head.append("NOTE: --final now requires DEPTH by default (every block must have")
                head.append("a cited, specific finding — not just --clean). If you genuinely")
                head.append("need to finalize with shallow reviews, pass --allow-shallow to")
                head.append("acknowledge that you are accepting incomplete reading.")
        else:
            head.append("===== INTERIM AUDIT REPORT =====")
        head.append(f"objective: {a.get('objective')}")
        head.append(f"review coverage: {a.get('review_cursor', 0)}/{a.get('total_blocks', 0)} blocks, "
                    f"~{a.get('reviewed_lines', 0)}/{a.get('total_lines', 0)} lines")
        head.append(f"depth: {a.get('deep_reviews', 0)} deep / {a.get('shallow_reviews', 0)} shallow reviews")
        if a.get('total_blocks', 0) > 0:
            dpct = 100.0 * a.get('deep_reviews', 0) / max(1, a.get('review_cursor', 1))
            head.append(f"depth ratio: {dpct:.0f}% deep (target: 100% for a line-by-line audit)")
        head.append(f"findings recorded: {a.get('findings_total', 0)}")
        if fails:
            head.append(f"spot-check failures: {fails} (fabricated reviews — see audit.py challenge)")
        if a.get("recent_findings"):
            head.append("recent findings:")
            head += [f"  - {f}" for f in a["recent_findings"]]
        return (final and ok), head + ["", f"--- {bar} proof ---"] + lines


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_open(args):
    a, ring = Audit(args.root).open(objective=args.objective, roles=args.roles,
                                    exclude_roles=args.exclude_roles,
                                    strict_depth=not args.coverage_only)
    print(f"audit opened (Ring {ring['index']}). in-scope: {a['total_blocks']} blocks, "
          f"~{a['total_lines']} lines. mode: {'STRICT-DEPTH (governor holds until 100% deep)' if a['strict_depth'] else 'coverage-only'}.")
    print(f"NEXT: {a['next_action']}")


def cmd_next(args):
    blocks, a = Audit(args.root).next_batch(batch_size=args.batch_size)
    if not blocks:
        print(f"no unreviewed in-scope blocks — coverage {a['review_cursor']}/{a['total_blocks']}. "
              "Run `audit.py report --final`.")
        return
    print(f"# next {len(blocks)} UNREVIEWED block(s) — read every line, then record. A DEEP "
          f"review cites specific lines/symbols PRESENT IN THE BLOCK; a bare --clean counts as shallow:")
    for b in blocks:
        print(f"\n----- ring {b['index']}  {b['path']}  L{b['line_start']}-{b['line_end']} "
              f"chunk {b['chunk']} -----")
        print(b["content"])
    # friction reducer: a ready-to-fill record scaffold — GAP 2 FIX: the finding command
    # never lists more than MAX_FINDING_BATCH ids (record would reject a larger batch).
    cap = Audit.MAX_FINDING_BATCH
    fids = " ".join(str(b["index"]) for b in blocks[:cap])
    print(f"\n# record after reading (cite a symbol/line that ACTUALLY appears in the block):")
    print(f"#   audit.py record --root {args.root} --block {fids} --finding \"<file:Lstart-Lend — symbol/what & why>\"")
    print(f"#   (only if genuinely nothing of note: audit.py record --root {args.root} --block <id> --clean)")
    print(f"#   Limits: --clean = 1 block/call; --finding = {cap} blocks/call. A finding that cites nothing")
    print(f"#   found in the block, or is too short ('looks fine'/'mirrors async'), counts SHALLOW.")
    print(f"# Run your 8 chronosynaptic security-perspective forks against THIS batch (not once at the")
    print(f"#   start): chronosynaptic.py ... — surface each fork's findings, then record them above.")
    print(f"# Spot-check yourself: audit.py challenge --root {args.root}  (quote a real line from a block")
    print(f"#   you claimed to review; a wrong quote flags a fabricated review and blocks the final report).")


def cmd_record(args):
    auditor = Audit(args.root)
    try:
        a, ring, newly = auditor.record(args.block, finding=args.finding, clean=args.clean,
                                        status=args.status)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"recorded review of {newly} new block(s) (Ring {ring['index']}). "
          f"coverage {a['review_cursor']}/{a['total_blocks']}.")
    if auditor._last_anchor_warning:
        print(f"NOTE: {auditor._last_anchor_warning}")
    print(f"NEXT: {a['next_action']}")


def cmd_progress(args):
    a = Audit(args.root).status()
    if not a:
        print("no audit open on this chain (run `audit.py open`).")
        sys.exit(1)
    pct = (100.0 * a["review_cursor"] / a["total_blocks"]) if a["total_blocks"] else 0.0
    print(f"objective: {a.get('objective')}")
    print(f"review:    {a['review_cursor']}/{a['total_blocks']} blocks ({pct:.2f}%), "
          f"~{a['reviewed_lines']}/{a['total_lines']} lines")
    print(f"depth:     {a.get('deep_reviews', 0)} deep / {a.get('shallow_reviews', 0)} shallow")
    print(f"findings:  {a['findings_total']}")
    print(f"complete:  {a['complete']}")
    print(f"NEXT:      {a['next_action']}")


def cmd_validate(args):
    ok, lines = Audit(args.root).validate(require_complete=args.require_complete,
                                          require_depth=args.require_depth)
    for ln in lines:
        print("  " + ln)
    print("AUDIT:", "COMPLETE" if ok else "INCOMPLETE")
    sys.exit(0 if ok else 1)


def cmd_close(args):
    Audit(args.root).close()
    print("audit governor disengaged for this chain (pointer cleared).")


def cmd_challenge(args):
    picks = Audit(args.root).challenge(n=args.n, seed=args.seed)
    if not picks:
        print("no deep-reviewed blocks to challenge yet.")
        return
    print(f"# SPOT-CHECK: prove you actually read these block(s) you recorded as DEEP. For each,")
    print(f"# quote a real line or symbol FROM THE BLOCK (you are NOT shown the content):")
    for b in picks:
        print(f"  ring {b['index']}  {b['path']}  L{b['line_start']}-{b['line_end']}")
        print(f"    -> audit.py answer --root {args.root} --block {b['index']} --quote \"<exact line/symbol from this block>\"")
    print("# A wrong quote records a fabricated-review failure and blocks the final report.")


def cmd_answer(args):
    passed, ring = Audit(args.root).answer(args.block, args.quote)
    print(f"challenge block {args.block}: {'PASS — quote found in the block ✓' if passed else 'FAIL — quote NOT in the block (fabricated review)'} "
          f"(Ring {ring['index']}).")
    sys.exit(0 if passed else 3)


def cmd_report(args):
    is_final, lines = Audit(args.root).report(
        final=args.final, require_depth=args.require_depth,
        allow_shallow=args.allow_shallow)
    for ln in lines:
        print(ln)
    # exit nonzero when --final was requested but refused, so scripts/hooks notice
    sys.exit(0 if (is_final or not args.final) else 2)


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root,
                        help="task chain root (the per-task dir you walked with continuum.py)")
    p = argparse.ArgumentParser(description="Audit — exhaustive-review coverage governor over Continuum.")
    sub = p.add_subparsers(dest="cmd", required=True)

    po = sub.add_parser("open", parents=[common], help="init a review ledger over an ingested chain")
    po.add_argument("--objective", default=None)
    po.add_argument("--roles", nargs="*", default=None,
                    help="only these path roles count as reviewable (e.g. source config)")
    po.add_argument("--exclude-roles", nargs="*", default=None,
                    help=f"roles to exclude (default {sorted(DEFAULT_EXCLUDE_ROLES)})")
    po.add_argument("--coverage-only", action="store_true",
                    help="relax the governor to disengage at coverage-complete (default: STRICT-DEPTH "
                         "— it holds until every block is deeply, content-anchored reviewed)")
    po.set_defaults(func=cmd_open)

    pn = sub.add_parser("next", parents=[common], help="hand back the next UNREVIEWED blocks to read")
    pn.add_argument("--batch-size", type=int, default=5,  # GAP 2 FIX: = MAX_FINDING_BATCH
                    help="how many unreviewed blocks to surface (default 5 = the per-finding cap)")
    pn.set_defaults(func=cmd_next)

    pr = sub.add_parser("record", parents=[common], help="seal a review record for block(s) you read")
    pr.add_argument("--block", nargs="+", type=int, required=True, help="ring index(es) just reviewed")
    prx = pr.add_mutually_exclusive_group(required=True)
    prx.add_argument("--finding", default=None, help="a real finding (omit + use --clean if nothing)")
    prx.add_argument("--clean", action="store_true",
                     help="reviewed, nothing of note. LIMITED TO 1 BLOCK PER CALL to prevent batch-skipping. "
                          "You must have actually read the block's content first.")
    pr.add_argument("--status", default="reviewed")
    pr.set_defaults(func=cmd_record)

    pp = sub.add_parser("progress", parents=[common], help="O(1) coverage from the head block")
    pp.set_defaults(func=cmd_progress)

    pv = sub.add_parser("validate", parents=[common], help="PROVE coverage by streaming the chain")
    pv.add_argument("--require-complete", action="store_true", help="fail unless 100%% reviewed")
    pv.add_argument("--require-depth", action="store_true",
                    help="fail unless every reviewed block has a DEEP record (cited specifics)")
    pv.set_defaults(func=cmd_validate)

    prp = sub.add_parser("report", parents=[common], help="audit report (refuses FINAL below 100%%)")
    prp.add_argument("--final", action="store_true", help="request a FINAL report (refused if incomplete or shallow)")
    prp.add_argument("--require-depth", action="store_true",
                     help="require depth-complete (no shallow reviews). DEFAULT for --final since v3.8.3.")
    prp.add_argument("--allow-shallow", action="store_true",
                     help="allow --final to pass with shallow reviews (explicit acknowledgment of incomplete reading)")
    prp.set_defaults(func=cmd_report)

    pc = sub.add_parser("close", parents=[common], help="disengage the turn-end governor (pause/abandon)")
    pc.set_defaults(func=cmd_close)

    pch = sub.add_parser("challenge", parents=[common],
                         help="spot-check: pick deep-reviewed blocks at random and demand a real quote")
    pch.add_argument("--n", type=int, default=1, help="how many blocks to challenge")
    pch.add_argument("--seed", type=int, default=None, help="RNG seed (reproducible challenges)")
    pch.set_defaults(func=cmd_challenge)

    pa = sub.add_parser("answer", parents=[common], help="answer a challenge by quoting a real line from the block")
    pa.add_argument("--block", type=int, required=True)
    pa.add_argument("--quote", required=True, help="an exact line or symbol from that block")
    pa.set_defaults(func=cmd_answer)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
