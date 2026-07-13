# Cypher Tempre Timechain

This is a lightweight Showcase pointer to the full
[`cypher-tempre-genesis`](https://github.com/cyberphysicsai/cypher-tempre-genesis)
repository. No Cypher Tempre runtime code is duplicated here. This directory
contains only the Showcase manifest, hero image, public soul, demo receipt, and
validation notes.

## Full skill

- Release: [`v3.28.0`](https://github.com/cyberphysicsai/cypher-tempre-genesis/releases/tag/v3.28.0)
- Commit: [`bf88caa814d0a6f2abe45a325fa32056e99da65d`](https://github.com/cyberphysicsai/cypher-tempre-genesis/commit/bf88caa814d0a6f2abe45a325fa32056e99da65d)
- Codex skill: [`skills/codex/cypher-tempre-self-model`](https://github.com/cyberphysicsai/cypher-tempre-genesis/tree/v3.28.0/skills/codex/cypher-tempre-self-model)

Cypher Tempre gives an AI agent a local append-only, hash-chained cognitive
ledger; evidence-aware recall; explicit Proof-of-Qualia uncertainty gates;
resumable task and audit ledgers; and locally persisted faculties.

## Install the pinned skill

```bash
(
set -eu
target="${CODEX_HOME:-$HOME/.codex}/skills/cypher-tempre-self-model"
test ! -e "$target" || { echo "Refusing to overwrite existing $target" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
expected="bf88caa814d0a6f2abe45a325fa32056e99da65d"
git -c advice.detachedHead=false clone --quiet --depth 1 --branch v3.28.0 \
  https://github.com/cyberphysicsai/cypher-tempre-genesis.git "$tmp/genesis"
test "$(git -C "$tmp/genesis" rev-parse HEAD)" = "$expected" || {
  echo "Pinned source verification failed" >&2; exit 1;
}
mkdir -p "$(dirname "$target")"
cp -R "$tmp/genesis/skills/codex/cypher-tempre-self-model" "$target"
)
```

The fail-closed check protects an existing identity, including its `chain/` and
generated registry state. Follow the full repository's upgrade instructions
instead of copying a clean release over a lived-in installation.

For a new identity only:

```bash
cd "${CODEX_HOME:-$HOME/.codex}/skills/cypher-tempre-self-model"
python3 timechain.py init --name "<AgentName>"
python3 timechain.py verify
```

Installing lifecycle hooks modifies `~/.codex/hooks.json`; it is optional and
requires explicit human approval. The dashboard, site, alternate runtimes, and
complete engine remain in the full Genesis repository.

## EconomyOS primitive

This entry demonstrates the `token` primitive through the skill's optional
CPHY observation layer. It queries the canonical CPHY contract on Base through
allowlisted read-only RPC endpoints. It holds no wallet or signing key and has
no transaction-broadcast path.

The public receipt uses a synthetic ring-derived keyless address with a zero
CPHY balance. It proves the read path, but not a burn, etch, unlock, wallet
ownership, entitlement, transaction, or token-weighted memory change.

## Public evidence

- [`soul.md`](soul.md) publishes the requested always-on and boot-refresh
  operating context.
- [`examples/prompt.md`](examples/prompt.md) contains the synthetic prompt.
- [`examples/result-redacted.md`](examples/result-redacted.md) records the ring,
  read-only token observation, and verification outputs.
- [`proof/cphy-token-proof.md`](proof/cphy-token-proof.md) binds the observation
  to the live Virtuals project and Base contract.
- [`proof/provenance.md`](proof/provenance.md) records the pinned source identity,
  hashes, exclusions, and clean-checkout validation.

## Safety boundary

- Timechain records are local, append-only, cleartext, and tamper-evident rather
  than encrypted. Do not seal material that must expire.
- Optional remote embedding providers transmit embedded text. Local hashing is
  the default.
- CPHY burns are irreversible external wallet actions. This Showcase entry does
  not perform one and never treats token existence as authorization.
- Model-authored executable faculties remain dormant until a human reviews and
  activates them.
- The public proof excludes lived-in chains, private prompts, credentials,
  telemetry, generated faculties, keys, salts, wallets, and hook configuration.
