#!/bin/bash
# Cypher Tempre — SessionStart hook: prime the session so it WEARS the self-model
# from turn 0 even if the model never opens SKILL.md. enforce.py session-start emits the
# ACTIVE/DORMANT context as a hook-JSON envelope ({"hookSpecificOutput":{...}}): the harness
# parses SessionStart hook stdout as JSON (the Codex CLI rejects plain text), and enforce.py
# writes ONLY that JSON to stdout. Set CT_ENFORCE_DEBUG=1 to surface stderr. Fail-open.
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SKILL/enforce.py" ] || exit 0
case "${CT_ENFORCE_DEBUG:-}" in
  1|true|TRUE|True|yes|YES|Yes|on|ON|On|debug|DEBUG|Debug)
  python3 "$SKILL/enforce.py" session-start
  ;;
  *)
  python3 "$SKILL/enforce.py" session-start 2>/dev/null
  ;;
esac
exit 0
