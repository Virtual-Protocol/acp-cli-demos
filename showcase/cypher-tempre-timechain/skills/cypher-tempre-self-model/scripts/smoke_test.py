#!/usr/bin/env python3
"""Hermetic smoke test for the Showcase Cypher Tempre skill snapshot."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, Optional


SKILL = Path(__file__).resolve().parent.parent


def run(*args: str, expect: int = 0, env: Optional[Dict[str, str]] = None) -> str:
    proc = subprocess.run(
        [sys.executable, *args],
        cwd=SKILL,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if proc.returncode != expect:
        raise AssertionError(
            f"expected exit {expect}, got {proc.returncode}: {' '.join(args)}\n{proc.stdout}"
        )
    return proc.stdout


def main() -> int:
    env = dict(os.environ)
    env.update({"CT_AUTOGROW": "0", "CT_AUTOMAINT": "0", "CT_TELEMETRY": "off"})

    with tempfile.TemporaryDirectory(prefix="ct_showcase_smoke_") as tmp:
        root = Path(tmp)
        init = run(str(SKILL / "timechain.py"), "init", "--name", "ShowcaseSmoke",
                   "--root", str(root), env=env)
        assert "Genesis Block sealed" in init

        turn = run(
            str(SKILL / "recall.py"),
            "turn",
            "A synthetic smoke-test ring grounded only in this public test.",
            "--input",
            "Run the public Showcase smoke test",
            "--root",
            str(root),
            env=env,
        )
        assert "verify: PASS" in turn and "sealed self-labeled Ring 1" in turn

        verify = run(str(SKILL / "timechain.py"), "verify", "--root", str(root), env=env)
        assert "VERIFY: PASS" in verify

        target = run(str(SKILL / "cphy.py"), "onchain", "target", "--from", "1",
                     "--to", "1", "--root", str(root), env=env)
        assert "deposit_address" in target and "KEYLESS" in target

        audit = run(str(SKILL / "cphy.py"), "audit", "--root", str(root), env=env)
        assert "AUDIT: PASS" in audit

    with tempfile.TemporaryDirectory(prefix="ct_showcase_empty_") as tmp:
        stopped = run(
            str(SKILL / "recall.py"),
            "turn",
            "This must not seal.",
            "--input",
            "Uninitialized root",
            "--root",
            tmp,
            expect=2,
            env=env,
        )
        assert "no Genesis Block found" in stopped

    print("SHOWCASE SMOKE: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
