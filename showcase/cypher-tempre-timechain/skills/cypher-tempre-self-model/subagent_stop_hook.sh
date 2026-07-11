#!/bin/bash
# Cypher Tempre — SubagentStop hook: same block-until-seal pressure for spawned
# subagents, so a subagent wears the skill too (it must seal before returning).
# A subagent that forges its own task chain can point enforcement at it via
# CT_ENFORCE_ROOT; by default it enforces against the shared identity chain.
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SKILL/enforce.py" ] || exit 0
# stderr -> /dev/null so nothing can corrupt the stdout the harness parses as the
# decision JSON (enforce.py also quarantines its own stdout). Set CT_ENFORCE_DEBUG=1
# to surface enforce.py stderr for diagnosis; 0/false/no/off stay quiet. Fail-open: exit 0.
case "${CT_ENFORCE_DEBUG:-}" in
  1|true|TRUE|True|yes|YES|Yes|on|ON|On|debug|DEBUG|Debug)
  python3 "$SKILL/enforce.py" subagent-check
  ;;
  *)
  python3 "$SKILL/enforce.py" subagent-check 2>/dev/null
  ;;
esac
exit 0
