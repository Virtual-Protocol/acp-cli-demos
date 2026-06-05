#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$repo_root/packages/claude-desktop"

mkdir -p "$out_dir"
rm -f "$out_dir"/*.zip

skills=(
  "acp-builder-setup"
  "acp-paid-subscription-checkout-handoff"
)

for skill in "${skills[@]}"; do
  if [[ ! -f "$repo_root/skills/$skill/SKILL.md" ]]; then
    echo "Missing SKILL.md for $skill" >&2
    exit 1
  fi

  (
    cd "$repo_root/skills"
    zip -qr "$out_dir/$skill.zip" "$skill"
  )

  echo "Wrote $out_dir/$skill.zip"
done
