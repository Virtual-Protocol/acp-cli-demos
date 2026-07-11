#!/bin/bash
# Cypher Tempre — UserPromptSubmit hook (standing instruction set by cyberphysicsai).
# Records turn-start AND injects the per-turn reminder. The reminder is emitted by
# enforce.py as a hook-JSON CONTEXT envelope ({"hookSpecificOutput":{...}}): the harness
# parses UserPromptSubmit hook stdout as JSON, and the Codex CLI rejects plain text with
# "invalid user prompt submit JSON output". enforce.py quarantines all incidental output
# and writes ONLY the JSON envelope to stdout. The reminder is GUIDANCE (context), never a
# verbatim-runnable command — some runtimes try to EXECUTE an injected `python3 ...` string.
# Set CT_ENFORCE_DEBUG=1 to surface enforce.py stderr for diagnosis. Fail-open: exit 0.
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SKILL/enforce.py" ] || exit 0
case "${CT_ENFORCE_DEBUG:-}" in
  1|true|TRUE|True|yes|YES|Yes|on|ON|On|debug|DEBUG|Debug)
  python3 "$SKILL/enforce.py" user-prompt
  ;;
  *)
  python3 "$SKILL/enforce.py" user-prompt 2>/dev/null
  ;;
esac
exit 0
