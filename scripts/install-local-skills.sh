#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mode="symlink"
target="both"
home_dir="$HOME"

usage() {
  cat <<'USAGE'
Usage: scripts/install-local-skills.sh [--mode symlink|copy] [--target codex|claude|both] [--home DIR]

Installs ACP skills from this repo into local agent skill directories.

Defaults:
  --mode symlink
  --target both
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      mode="${2:?missing value for --mode}"
      shift 2
      ;;
    --target)
      target="${2:?missing value for --target}"
      shift 2
      ;;
    --home)
      home_dir="${2:?missing value for --home}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$mode" in
  symlink|copy) ;;
  *)
    echo "--mode must be symlink or copy" >&2
    exit 1
    ;;
esac

case "$target" in
  codex|claude|both) ;;
  *)
    echo "--target must be codex, claude, or both" >&2
    exit 1
    ;;
esac

skills=(
  "acp-builder-setup"
  "acp-paid-subscription-checkout"
)

install_skill() {
  local source_dir="$1"
  local dest_dir="$2"

  mkdir -p "$(dirname "$dest_dir")"
  rm -rf "$dest_dir"

  if [[ "$mode" == "symlink" ]]; then
    ln -s "$source_dir" "$dest_dir"
  else
    cp -R "$source_dir" "$dest_dir"
  fi
}

for skill in "${skills[@]}"; do
  source_dir="$repo_root/skills/$skill"
  if [[ ! -f "$source_dir/SKILL.md" ]]; then
    echo "Missing skill source: $source_dir/SKILL.md" >&2
    exit 1
  fi

  if [[ "$target" == "codex" || "$target" == "both" ]]; then
    install_skill "$source_dir" "$home_dir/.agents/skills/$skill"
    echo "Installed Codex skill: $home_dir/.agents/skills/$skill"
  fi

  if [[ "$target" == "claude" || "$target" == "both" ]]; then
    install_skill "$source_dir" "$home_dir/.claude/skills/$skill"
    echo "Installed Claude Code skill: $home_dir/.claude/skills/$skill"
  fi
done
