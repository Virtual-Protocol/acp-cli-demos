# Validation and Source Provenance

## Pinned source identity

- Repository: [`cyberphysicsai/cypher-tempre-genesis`](https://github.com/cyberphysicsai/cypher-tempre-genesis)
- Release: [`v3.28.0`](https://github.com/cyberphysicsai/cypher-tempre-genesis/releases/tag/v3.28.0)
- Dereferenced tag commit: [`bf88caa814d0a6f2abe45a325fa32056e99da65d`](https://github.com/cyberphysicsai/cypher-tempre-genesis/commit/bf88caa814d0a6f2abe45a325fa32056e99da65d)
- Codex skill tree: `28ff752fcc37ab633e6d39bdb2dd8c72c792bf06`
- Version file: `3.28.0`
- Skill directory: [`skills/codex/cypher-tempre-self-model`](https://github.com/cyberphysicsai/cypher-tempre-genesis/tree/v3.28.0/skills/codex/cypher-tempre-self-model)
- License: MIT in the upstream skill directory

This Showcase directory contains no runtime copy. It is a pointer plus a hero,
manifest, synthetic proof receipt, and validation notes.

## Source hashes

Hashes were calculated directly from a clean checkout of the dereferenced
`v3.28.0` tag:

- `SKILL.md`: `28201cd39009cc7db9ca45a4b9f75244da347041a6576c4f2968cb9eac9f0ee5`
- `recall.py`: `2e7e0e1e195983a2388bba862ac82888dadd4de6d4f2d0199ac9ad65c6f261c4`
- `cphy.py`: `f7e76c5690bd8cfb998960df3827c326967e9e6084b34ffa4210e9a4ca101732`

## Clean-checkout validation

All checks below ran on `2026-07-13` against the pinned external source:

- Full architecture self-test: `SELFTEST: PASS`
- Smoke suite: `106 passed, 0 failed`
- Gate-discrimination suite: `12 passed, 0 failed`
- Synthetic CPHY ledger: `AUDIT: PASS`
- Synthetic Timechain: `VERIFY: PASS`, height `2`, blockspace `0`
- Synthetic Ring 0: `ce2b66548ad82e5b3180492841a0cad942097f764f2190364c46a32e8ff276e6`
- Synthetic Ring 1: `5b327a08d58a3b48ef81a843fa2a48655ed9e9951032167dd3d30d96adee1d54`
- Derived public keyless target: `0x5b327a08d58a3b48ef81a843fa2a48655ed9e995`
- Read-only CPHY observation: no errors, changes, events, approvals, burns, or
  token-weighted multiplier

The disposable proof disabled automatic growth, maintenance, and telemetry so
it sealed exactly the requested ring and left the clean source unchanged.

## Showcase package boundary

- Runtime files committed here: `0`
- Total project files committed here: `8`
- Generated chain or registry state committed here: `0`
- Dashboard, site, alternate runtimes, downloads, and full engine: external
  Genesis repository only

The public proof excludes lived-in chains, task roots, blockspace, telemetry,
learned registries, CPHY vaults, private rotation salts, active model-authored
operations, caches, environment files, credentials, private keys, wallet
material, hook configuration, absolute user paths, and private prompts. The
temporary proof root is normalized as `$DEMO_ROOT`.
