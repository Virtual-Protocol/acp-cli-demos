#!/usr/bin/env python3
# Copyright (c) 2026 cyberphysicsai. MIT License.
"""Task-chain linkage helpers.

Large jobs should live in their own task chain, but the identity chain should
remember that work by sealing a compact pointer to the task head. This keeps
identity small and durable without trying to splice two hash chains together.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from timechain import Timechain


def normalize_root(root):
    """Return a Timechain project root, correcting the common chain/ mistake.

    Timechain roots are project folders that CONTAIN chain/rings.jsonl. Users
    often paste the chain directory itself; using that raw path would create a
    nested chain/chain. Normalize it here and report the correction.
    """
    p = Path(root).expanduser()
    try:
        p = p.resolve()
    except Exception:
        p = p.absolute()
    if (p / "rings.jsonl").is_file():
        return p.parent, f"{p} looks like a chain/ directory; using project root {p.parent}"
    return p, None


def _tail_summary(root):
    tc = Timechain(root)
    ok, report = tc.verify()
    head = tc._tail_ring()
    payload = (head or {}).get("payload") or {}
    state = payload.get("state") if isinstance(payload.get("state"), dict) else {}
    audit_state = state.get("audit") if isinstance(state.get("audit"), dict) else None
    objective = (
        payload.get("objective")
        or payload.get("task")
        or state.get("objective")
        or (audit_state or {}).get("objective")
    )
    return {
        "root": str(Path(root).resolve()),
        "chain_dir": str(tc.dir.resolve()),
        "verified": ok,
        "verify_tail": report[-3:],
        "height": (int(head["index"]) + 1) if head else 0,
        "head_index": int(head["index"]) if head else None,
        "head_hash": head.get("ring_hash") if head else None,
        "head_type": head.get("ring_type") if head else None,
        "head_summary": payload.get("summary") or payload.get("name") or "",
        "objective": objective,
        "audit": audit_state,
    }


def _existing_report(path):
    if not path:
        return None
    p = Path(path).expanduser()
    try:
        p = p.resolve()
    except Exception:
        p = p.absolute()
    return p


def link_task(identity_root, task_root, *, status, objective=None, report=None,
              note=None, coverage=None, difficulty=0):
    identity_root, identity_warning = normalize_root(identity_root)
    task_root, task_warning = normalize_root(task_root)
    identity_root = identity_root.resolve()
    task_root = task_root.resolve()
    if identity_root == task_root:
        raise RuntimeError("identity root and task root are the same; nothing to link")

    task_info = _tail_summary(task_root)
    if not task_info["head_hash"]:
        raise RuntimeError(f"task chain has no rings: {task_root}")
    if not task_info["verified"]:
        tail = "; ".join(task_info["verify_tail"])
        raise RuntimeError(f"task chain does not verify: {tail}")

    identity = Timechain(identity_root)
    if identity._tail_ring() is None:
        raise RuntimeError(f"identity chain has no genesis: {identity_root}")

    report_path = _existing_report(report)
    files = [report_path] if report_path and report_path.is_file() else []
    payload = {
        "event": "task_link",
        "status": status,
        "summary": f"{status} task chain {task_root.name}",
        "task_root": str(task_root),
        "task_chain_dir": task_info["chain_dir"],
        "task_head_index": task_info["head_index"],
        "task_head_hash": task_info["head_hash"],
        "task_head_type": task_info["head_type"],
        "task_height": task_info["height"],
        "task_verified": task_info["verified"],
        "objective": objective or task_info.get("objective"),
        "audit": task_info.get("audit"),
    }
    warnings = [w for w in (identity_warning, task_warning) if w]
    if report_path:
        payload["report_path"] = str(report_path)
        payload["report_attached"] = bool(files)
    if note:
        payload["note"] = note
    if coverage:
        payload["coverage"] = coverage
    if warnings:
        payload["warnings"] = warnings

    ring = identity.seal("task_link", payload, files=files, difficulty=difficulty)
    return ring, payload, warnings


def _print_link(kind, ring, payload, warnings):
    for w in warnings:
        print(f"warning: {w}", file=sys.stderr)
    print(f"task {kind} sealed into identity Ring {ring['index']} ({ring['ring_hash'][:16]}..)")
    print(f"  identity event: {payload['status']}")
    print(f"  task root:      {payload['task_root']}")
    print(f"  task head:      #{payload['task_head_index']} {payload['task_head_hash'][:16]}..")
    print(f"  verified:       {payload['task_verified']}")
    if payload.get("objective"):
        print(f"  objective:      {payload['objective']}")
    if payload.get("report_path"):
        attached = "attached" if payload.get("report_attached") else "not attached (file missing)"
        print(f"  report:         {payload['report_path']} ({attached})")


def cmd_attach(args):
    try:
        ring, payload, warnings = link_task(
            args.identity_root,
            args.task_root,
            status="attached",
            objective=args.objective,
            report=args.report,
            note=args.note,
            coverage=args.coverage,
            difficulty=args.difficulty,
        )
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    _print_link("attached", ring, payload, warnings)


def cmd_complete(args):
    try:
        ring, payload, warnings = link_task(
            args.identity_root,
            args.task_root,
            status=args.status,
            objective=args.objective,
            report=args.report,
            note=args.note,
            coverage=args.coverage,
            difficulty=args.difficulty,
        )
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    _print_link(args.status, ring, payload, warnings)


def cmd_inspect(args):
    root, warning = normalize_root(args.task_root)
    info = _tail_summary(root)
    if warning:
        print(f"warning: {warning}", file=sys.stderr)
    print(json.dumps(info, indent=2, ensure_ascii=False))


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--identity-root", type=Path, default=default_root,
                        help="identity chain project root (default: this skill folder)")
    common.add_argument("--task-root", type=Path, required=True,
                        help="task chain project root; pass the folder that contains chain/, not chain/ itself")
    common.add_argument("--objective", default=None)
    common.add_argument("--report", default=None, help="optional report file to attach to identity blockspace")
    common.add_argument("--coverage", default=None, help="optional human-readable coverage string")
    common.add_argument("--note", default=None)
    common.add_argument("--difficulty", type=int, default=0)

    p = argparse.ArgumentParser(description="Link separate task chains into an identity chain.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pa = sub.add_parser("attach", parents=[common],
                        help="seal an identity-chain pointer to an in-progress task chain")
    pa.set_defaults(func=cmd_attach)

    pc = sub.add_parser("complete", parents=[common],
                        help="seal an identity-chain pointer marking a task chain complete/interim/abandoned")
    pc.add_argument("--status", choices=["complete", "interim", "abandoned"], default="complete")
    pc.set_defaults(func=cmd_complete)

    pi = sub.add_parser("inspect", help="inspect a task chain head without sealing identity")
    pi.add_argument("--task-root", type=Path, required=True,
                    help="task chain project root; pass the folder that contains chain/, not chain/ itself")
    pi.set_defaults(func=cmd_inspect)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
