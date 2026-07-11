#!/usr/bin/env python3
# Copyright (c) 2026 cyberphysicsai. MIT License.
"""Install Cypher Tempre Codex lifecycle hooks into ~/.codex/hooks.json.

Codex executes hooks only when they are declared in an active config layer
(`hooks.json` or inline [hooks] in config.toml). A copied skill folder can carry
the hook scripts, but the user-level hook config is what makes Codex run them.

This installer is merge-safe: it removes stale Cypher Tempre hook groups from
the target file, preserves unrelated hooks, writes atomically, and backs up an
existing hooks.json before replacing it.
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import stat
import sys
import time
from pathlib import Path
from typing import Any


EVENTS = ("SessionStart", "UserPromptSubmit", "Stop", "SubagentStop")
SCRIPT_NAMES = {
    "SessionStart": "session_start_hook.sh",
    "UserPromptSubmit": "loop_hook.sh",
    "Stop": "stop_hook.sh",
    "SubagentStop": "subagent_stop_hook.sh",
}


def command_for(script: Path) -> str:
    return "/bin/bash " + shlex.quote(str(script))


def hook_group(event: str, skill_dir: Path) -> dict[str, Any]:
    hook = {
        "type": "command",
        "command": command_for(skill_dir / SCRIPT_NAMES[event]),
        "timeout": 30,
    }
    if event == "SessionStart":
        hook["statusMessage"] = "Loading Cypher Tempre self-model"
        return {"matcher": "startup|resume|clear|compact", "hooks": [hook]}
    if event == "UserPromptSubmit":
        hook["statusMessage"] = "Marking Cypher Tempre turn"
        return {"hooks": [hook]}
    if event == "Stop":
        hook["statusMessage"] = "Checking Cypher Tempre seal"
        return {"hooks": [hook]}
    hook["statusMessage"] = "Checking Cypher Tempre subagent seal"
    return {"hooks": [hook]}


def is_cypher_tempre_group(group: Any) -> bool:
    if not isinstance(group, dict):
        return False
    hooks = group.get("hooks")
    if not isinstance(hooks, list):
        return False
    for hook in hooks:
        if not isinstance(hook, dict):
            continue
        command = str(hook.get("command", ""))
        status = str(hook.get("statusMessage", ""))
        if "Cypher Tempre" in status:
            return True
        if "cypher-tempre-self-model" in command and any(name in command for name in SCRIPT_NAMES.values()):
            return True
    return False


def load_hooks(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"hooks": {}}
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path} is not valid JSON; refusing to modify it: {exc}") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"{path} must contain a JSON object at top level.")
    hooks = data.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise SystemExit(f"{path} has a non-object 'hooks' field; refusing to modify it.")
    return data


def remove_cypher_tempre_hooks(data: dict[str, Any]) -> int:
    hooks = data.setdefault("hooks", {})
    removed = 0
    for event in list(EVENTS):
        groups = hooks.get(event, [])
        if not isinstance(groups, list):
            continue
        kept = []
        for group in groups:
            if is_cypher_tempre_group(group):
                removed += 1
            else:
                kept.append(group)
        if kept:
            hooks[event] = kept
        else:
            hooks.pop(event, None)
    return removed


def install(data: dict[str, Any], skill_dir: Path) -> None:
    hooks = data.setdefault("hooks", {})
    for event in EVENTS:
        hooks.setdefault(event, []).append(hook_group(event, skill_dir))


def ensure_executable(skill_dir: Path) -> None:
    for name in SCRIPT_NAMES.values():
        script = skill_dir / name
        if not script.exists():
            raise SystemExit(f"Missing hook script: {script}")
        current = script.stat().st_mode
        script.chmod(current | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def write_atomic(path: Path, data: dict[str, Any], backup: bool) -> Path | None:
    path.parent.mkdir(parents=True, exist_ok=True)
    backup_path = None
    if backup and path.exists():
        stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        backup_path = path.with_name(f"{path.name}.bak-{stamp}")
        backup_path.write_bytes(path.read_bytes())
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")
    tmp.replace(path)
    return backup_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install Cypher Tempre Codex hooks.")
    parser.add_argument("--codex-home", default=os.environ.get("CODEX_HOME", str(Path.home() / ".codex")),
                        help="Codex home directory; defaults to $CODEX_HOME or ~/.codex")
    parser.add_argument("--skill-dir", default=str(Path(__file__).resolve().parent),
                        help="Installed cypher-tempre-self-model skill directory")
    parser.add_argument("--dry-run", action="store_true", help="Print resulting hooks.json without writing")
    parser.add_argument("--uninstall", action="store_true", help="Remove Cypher Tempre hook groups")
    parser.add_argument("--no-backup", action="store_true", help="Do not write a .bak-* copy before replacing hooks.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    codex_home = Path(args.codex_home).expanduser().resolve()
    skill_dir = Path(args.skill_dir).expanduser().resolve()
    target = codex_home / "hooks.json"

    data = load_hooks(target)
    removed = remove_cypher_tempre_hooks(data)
    if not args.uninstall:
        ensure_executable(skill_dir)
        install(data, skill_dir)

    if args.dry_run:
        print(json.dumps(data, indent=2, sort_keys=False))
        print(f"# target={target}", file=sys.stderr)
        print(f"# removed_existing={removed}", file=sys.stderr)
        return 0

    backup_path = write_atomic(target, data, backup=not args.no_backup)
    action = "Removed" if args.uninstall else "Installed"
    print(f"{action} Cypher Tempre Codex hooks in {target}")
    print(f"removed_existing={removed}")
    if backup_path:
        print(f"backup={backup_path}")
    if not args.uninstall:
        print("Open /hooks in Codex to review and trust the new command hooks, then restart or start a new session.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
