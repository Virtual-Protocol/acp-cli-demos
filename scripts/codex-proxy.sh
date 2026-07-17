#!/usr/bin/env bash
# Manage the local Codex Virtuals proxy as a background process.
#
#   scripts/codex-proxy.sh start    Start the proxy (if not already running),
#                                   wait until it answers /health.
#   scripts/codex-proxy.sh stop     Stop the proxy this script started.
#   scripts/codex-proxy.sh status   Report whether the managed proxy is running.
#
# State lives next to the proxy: .proxy.pid and .proxy.log (both gitignored).
# Host/port follow the proxy's own VIRTUALS_PROXY_HOST / VIRTUALS_PROXY_PORT.
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
proxy_dir="$repo_root/utilities/model-routing/codex-virtuals-proxy"
pid_file="$proxy_dir/.proxy.pid"
log_file="$proxy_dir/.proxy.log"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_dotenv() {
  local env_file="$1"
  local line key value

  [ -f "$env_file" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    line=$(trim "$line")
    [ -n "$line" ] || continue
    case "$line" in
      \#*) continue ;;
      *=*) ;;
      *) continue ;;
    esac

    key=$(trim "${line%%=*}")
    value=$(trim "${line#*=}")
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if { [[ "$value" == \"*\" ]] && [[ "$value" == *\" ]]; } ||
      { [[ "$value" == \'* ]] && [[ "$value" == *\' ]]; }; then
      value="${value:1:${#value}-2}"
    fi

    if [ -z "${!key+x}" ]; then
      export "$key=$value"
    fi
  done <"$env_file"
}

load_dotenv "$proxy_dir/.env"

# Defaults mirror server.mjs (the source of truth); keep them in sync.
host="${VIRTUALS_PROXY_HOST:-127.0.0.1}"
port="${VIRTUALS_PROXY_PORT:-8787}"
health="http://$host:$port/health"

running() {
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

start() {
  if [ -z "${VIRTUALS_API_KEY:-}" ]; then
    echo "VIRTUALS_API_KEY is not set in this shell. Export it before starting the proxy:" >&2
    echo "  export VIRTUALS_API_KEY=..." >&2
    return 1
  fi

  if running; then
    echo "Proxy already running (pid $(cat "$pid_file"))."
    return 0
  fi

  echo "Starting Codex proxy in the background (logs: $log_file)..."
  ( cd "$proxy_dir" && exec node server.mjs >>"$log_file" 2>&1 ) &
  echo $! >"$pid_file"

  printf "Waiting for proxy at %s " "$health"
  for _ in $(seq 1 30); do
    if curl -fsS "$health" >/dev/null 2>&1; then
      echo; echo "Proxy is up."
      return 0
    fi
    printf "."
    sleep 0.5
  done

  echo
  echo "Proxy did not become reachable. Check $log_file."
  rm -f "$pid_file"
  return 1
}

stop() {
  if [ ! -f "$pid_file" ]; then
    echo "No make-managed proxy pidfile found; if you started the proxy yourself, stop it manually."
    return 0
  fi

  local pid
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" && echo "Stopped Codex proxy (pid $pid)."
  else
    echo "Codex proxy (pid $pid) was not running."
  fi
  rm -f "$pid_file"
}

status() {
  if running; then
    echo "Proxy running (pid $(cat "$pid_file")) at $health."
  else
    echo "Proxy not running."
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 2
    ;;
esac
