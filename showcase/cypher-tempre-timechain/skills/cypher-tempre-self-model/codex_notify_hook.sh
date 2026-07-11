#!/bin/bash
# Cypher Tempre — Codex / OpenClaw `notify` chaining wrapper.
#
# Codex (and OpenClaw's embedded Codex runtime) fire a single `notify` program on
# turn lifecycle events, appending the event JSON as the FINAL argument. There is
# only one notify slot, so to add adherence recording WITHOUT displacing an
# existing integration (e.g. Computer Use) we chain: record first, then forward
# every argument to the original program unchanged.
#
# Wire it into your Codex config file (config.toml in the Codex home; back up first) as:
#   notify = ["/abs/path/codex_notify_hook.sh", "<original_program>", "<original_args...>"]
# If there is no original program, just:
#   notify = ["/abs/path/codex_notify_hook.sh"]
#
# This wrapper NEVER fails the notify chain: adherence errors are swallowed and
# the original program is always exec'd.
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The event JSON is the last argument Codex appended.
JSON="${@: -1}"
if [ -f "$SKILL_DIR/enforce.py" ]; then
  python3 "$SKILL_DIR/enforce.py" codex-notify "$JSON" >/dev/null 2>&1 || true
fi

# Forward to the original notify program (argv: <orig> <orig_args...> <json>),
# preserving its exact invocation. If none was configured, we are done.
if [ "$#" -gt 1 ]; then
  ORIG="$1"; shift
  exec "$ORIG" "$@"
fi
exit 0
