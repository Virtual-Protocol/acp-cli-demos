# Validation and Source Provenance

## Source identity

- Upstream repository: `cyberphysicsai/cypher-tempre-genesis`
- Upstream tag: `v3.28.0`
- Dereferenced tag commit: `bf88caa814d0a6f2abe45a325fa32056e99da65d`
- Upstream Codex skill tree: `28ff752fcc37ab633e6d39bdb2dd8c72c792bf06`
- Showcase edition: `3.28.0-showcase.1`
- License: MIT, retained in the skill folder

The upstream Codex runtime was extracted with `git archive` from the tagged
skill subtree, so dashboard, site, downloads, other runtime variants, Git data,
and untracked local state were never copied.

## Showcase-specific changes

The edition keeps the v3.28.0 Python runtime, base registries, contract source,
Codex hook files, `AGENTS.md`, agent metadata, and license. It then:

- Replaces the 1,158-line entrypoint with a 299-line Showcase operating contract.
- Uses only `name` and `description` in `SKILL.md` frontmatter.
- Makes retention, inputs, network behavior, approval gates, stop conditions,
  redaction, validation, and output fields explicit.
- Removes the obsolete v3.16 lexical-jailbreak appendix and nonexistent command.
- Corrects the Codex subagent path.
- Stops `recall.py turn` before recall, network observation, growth, or sealing
  when the root is uninitialized or chain verification fails.
- Adds a hermetic bundle-local smoke test.
- Routes optional CPHY and layer detail through `references/`.

## Content identity

- Skill files: `62`
- Relative-path content-manifest SHA-256:
  `95584413b287bf8a5607f7fcb978488d0caa25088e90564a18fd4fc65970f4c3`
- `SKILL.md` SHA-256:
  `b75962785607564856674e51e6e1e32c3dbb4870272c6d2b80dcf5bbdaf7f09f`
- `recall.py` SHA-256:
  `33e677b0322dba8c4b62a8b70bbe6508321d0246843490323617d68a204f1a96`
- `recall_cli.py` SHA-256:
  `f33aedd49887cd81e79fda8bfa33695fcc642cd9963902667aad0bd377373062`
- `cphy.py` SHA-256:
  `f7e76c5690bd8cfb998960df3827c326967e9e6084b34ffa4210e9a4ca101732`

The content-manifest digest hashes sorted SHA-256 lines for every relative path
under the skill directory. It must be regenerated if any skill file changes.

## Validation results

All checks ran on `2026-07-11`:

- Showcase skill quick validation: `PASS`
- Bundle-local synthetic smoke test: `SHOWCASE SMOKE: PASS`
- Independent cold-start synthetic run: `PASS`
- Empty-root fail-closed test: expected exit `2`, no ring sealed
- Tampered-chain fail-closed test: expected exit `2`, no new ring sealed
- Packaged CPHY module: `SELFTEST PASS 57 checks`
- Packaged CPHY ledger: `AUDIT: PASS`
- Packaged synthetic Timechain: `VERIFY: PASS`
- Upstream full architecture suite: `SELFTEST: PASS`
- Upstream smoke suite: `106 passed, 0 failed`
- Upstream gate-discrimination suite: `12 passed, 0 failed`

The current `acp-cli-demos` validator passed before adding this manifest with 23
existing entries. The final count is recorded in the pull request after this
package is validated.

The cold-start run exposed that automatic faculty growth can create auxiliary
rings and generated registries during a turn. The operating contract and demo
now explicitly disable growth, maintenance, and telemetry when an exact-one-ring
public receipt is required; normal persisted operation retains the feature.

## Exclusions and redaction

The skill contains no `chain/`, task roots, blockspace, telemetry, learned
registries, CPHY vault, private rotation salt, active model-authored operation,
cache, `.env`, API key, private key, wallet material, hook configuration, or
absolute user path.

The public proof uses a synthetic chain and normalizes its temporary root as
`$DEMO_ROOT`. It intentionally publishes only synthetic ring hashes, a public
keyless derived address, public token metadata, bounded read-only output, and
validation results.
