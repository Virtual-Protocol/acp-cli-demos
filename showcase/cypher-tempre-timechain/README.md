# Cypher Tempre Timechain

This package contributes the Cypher Tempre Timechain self-model as a separate,
Showcase-owned Codex skill. It contains no dashboard, public site, local bridge,
wallet material, or user-generated Timechain state.

## What it does

Cypher Tempre gives an AI agent a local append-only, hash-chained cognitive
ledger; evidence-aware recall; explicit PoQ uncertainty gates; resumable task and
audit ledgers; and locally persisted faculties. The Showcase entrypoint routes
optional detail into references while retaining the complete stdlib-first
v3.28.0 Codex runtime.

## EconomyOS primitive

This entry uses the `token` primitive through the optional CPHY observation
layer. The public Virtuals record identifies:

- Project: `Cypher Tempre`
- Symbol: `CPHY`
- Chain: Base
- Factory status: `BONDING`
- Contract: `0x08Df470d41C11Ba5Cb60242747D76C65Ca52c94c`

The skill queries the pinned contract through allowlisted, read-only Base RPC
endpoints. It holds no wallet or signing key and contains no transaction-
broadcast path. The proof uses a synthetic ring-derived keyless address with a
zero CPHY balance, so it demonstrates the integration path but no burn, etch,
unlock, wallet ownership, entitlement, or token-weighted memory change.

## Install

From the root of a clone of this repository:

```bash
test ! -e ~/.codex/skills/cypher-tempre-self-model
mkdir -p ~/.codex/skills
cp -R showcase/cypher-tempre-timechain/skills/cypher-tempre-self-model \
  ~/.codex/skills/
```

The first command fails closed when that name already exists. Preserve an
existing installation's entire `chain/` and generated registry state; do not
merge this clean Showcase snapshot over it.

For a new identity only:

```bash
cd ~/.codex/skills/cypher-tempre-self-model
python3 timechain.py init --name "<AgentName>"
python3 timechain.py verify
```

Installing lifecycle hooks modifies `~/.codex/hooks.json`; it is optional and
requires explicit human approval and review in `/hooks`. Never overwrite an
existing installation's `chain/` or generated registry state during an upgrade.

For a disposable proof that must seal only the requested ring and leave the
packaged registries unchanged, set `CT_AUTOGROW=0`, `CT_AUTOMAINT=0`, and
`CT_TELEMETRY=off` before invoking `recall.py turn`.

## Proof

- [`examples/prompt.md`](examples/prompt.md) is the complete synthetic input.
- [`examples/result-redacted.md`](examples/result-redacted.md) records the
  generated ring and verification outputs.
- [`proof/cphy-token-proof.md`](proof/cphy-token-proof.md) binds the skill's
  read-only lookup to the live Virtuals project and Base contract.
- [`proof/provenance.md`](proof/provenance.md) records source identity, hashes,
  modifications, exclusions, and validation.

## Safety and public/private boundaries

- Timechain records are local, append-only, cleartext, and tamper-evident rather
  than encrypted. Do not seal material that must expire.
- Optional OpenAI and Voyage embeddings transmit embedded text. The default
  hashing provider is local; sentence-transformers runs locally but may download
  model weights when first installed.
- CPHY burns are irreversible external wallet actions. This contribution does
  not perform one and never treats token existence as authorization.
- Model-authored executable faculties remain dormant until a human reviews and
  activates them.
- Public proof uses a disposable synthetic chain. Lived-in chains, task roots,
  telemetry, private prompts, learned registries, keys, salts, passphrases, and
  hook configuration are excluded.

No `soul.md` is included because the runtime covenant and public skill
instructions are not permission to publish private agent context.
