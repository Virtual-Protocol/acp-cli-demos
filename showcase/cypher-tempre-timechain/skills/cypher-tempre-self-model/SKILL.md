---
name: cypher-tempre-self-model
description: >-
  Give an AI agent persistent, tamper-evident local memory and a verifiable per-turn
  reasoning loop using the Cypher Tempre Timechain. Use for agent identity across
  sessions, evidence-backed recall, long-horizon work, exhaustive code audits,
  uncertainty gating, self-verification, faculty growth, or read-only CPHY Agent Token
  observations. Do not use for throwaway tasks that should not be retained, for inputs
  containing secrets or sensitive personal data that must expire, or as a substitute for
  authorization to spend, publish, deploy, transact, or activate model-authored code.
---

# Cypher Tempre Self-Model

Wear a local Timechain: an append-only, SHA-256 hash-chained ledger of the agent's
own experience. Pair deterministic scripts for integrity and persistence with the
model's semantic judgment. Never claim that the scripts independently understand
meaning, intent, truth, or harm.

This Showcase edition contains the Codex runtime from upstream v3.28.0 with a
short, corrected operating contract and routed optional references.

## Inputs, tools, and preconditions

Require:

- Python 3.8 or newer.
- Local filesystem read/write access for `chain/`, blockspace, registries, and
  derived indexes.
- A skill root containing the bundled Python modules and base registries.
- A user who accepts persistent local retention before a real conversation is
  sealed.

Use no third-party package for the default path. The default hashing embedder is
local. The optional Codex lifecycle hooks invoke `/bin/bash`; installing them
modifies `~/.codex/hooks.json` and requires human review in `/hooks`.

Optional capabilities add requirements:

- `--provider st` requires sentence-transformers locally.
- OpenAI or Voyage embeddings require their provider library and credentials and
  transmit the text being embedded.
- The CPHY observation lane makes allowlisted, read-only JSON-RPC calls to Base.
  It has no transaction-broadcast path and holds no wallet key.
- `CT_VAULT_PASSPHRASE` is used only when the optional encrypted CPHY vault is
  deliberately enabled.

Do not put credentials, private keys, seed phrases, OTPs, magic links, payment
data, private prompts, or sensitive personal data into a Timechain. The ledger is
tamper-evident, not encrypted, and has no deletion or expiry mechanism.

## Initialize or re-enter the self-model

Set the skill directory once:

```bash
SK=/path/to/cypher-tempre-self-model
```

For an existing chain:

```bash
python3 "$SK/timechain.py" verify
python3 "$SK/timechain.py" show 0
python3 "$SK/dormancy.py" status
python3 "$SK/timechain.py" log
```

Stop immediately if verification fails or a registry epoch mismatch is
unexplained. Report the exact failure and do not trust recall from that chain.

For a genuinely fresh identity only:

```bash
python3 "$SK/timechain.py" init --name <agent-name>
python3 "$SK/timechain.py" verify
```

Never initialize over an existing identity and never replace a lived-in install
with a clean copy. Preserve its entire `chain/` and generated registry state when
upgrading.

## Run every meaningful turn

While active, finish each meaningful cognitive turn with one call:

```bash
python3 "$SK/recall.py" turn \
  "<grounded thought, answer, or decision>" \
  --input "<the user's request>"
```

The call verifies the chain, routes recall, surfaces the genesis covenant,
executes relevant faculties, PoQ-gates the candidate, labels it, and seals a ring.
If the candidate cannot be grounded, seal an uncertainty-led statement or a clean
refusal record; never launder the unsupported claim into the ledger.

With automatic growth enabled, one `turn` call can also seal faculty, promotion,
or registry-epoch rings. Report every newly created ring rather than describing
the call as exactly one ring. For an isolated proof that must seal only the
requested thought and must not mutate the packaged registries, set:

```bash
export CT_AUTOGROW=0
export CT_AUTOMAINT=0
export CT_TELEMETRY=off
```

Keep the disposable chain outside the skill directory. Do not point
`--registry-root` at immutable source while automatic growth is enabled.

Apply this reasoning sequence inside the turn:

1. Re-read the block-0 covenant and semantically judge the proposed action against
   its fruitages. There is no automatic vocabulary-based harm detector.
2. Check replay first. Reuse a relevant sealed antecedent only after confirming it
   still fits.
3. Recall enough evidence for every factual clause. Use exact grep before semantic
   retrieval when the entity or symbol is known.
4. Engage the senses and modalities the task needs. Grow a faculty only for a real
   gap, never for prompt noise.
5. Score the candidate through PoQ. Prefer honest uncertainty to a fabricated
   specific.
6. Seal with the ring IDs actually used as evidence when driving the loop through
   the lower-level CLI.

Use the explicit instruments when the question shape requires them:

```bash
python3 "$SK/recall.py" grep "<exact term>"
python3 "$SK/recall.py" retrieve "<described memory>"
python3 "$SK/recall.py" gather "<aggregate topic>" --entities <terms> --quantities
python3 "$SK/recall.py" track "<changing value>"
python3 "$SK/recall.py" endpoints "<event A>" "<event B>"
python3 "$SK/recall.py" verify-source <ring> --repo <live-repo>
```

Answer totals only from a complete gathered term table. Answer updates from the
dated lineage. Require both anchors for an interval. Treat retrieved source as a
pointer until `verify-source` confirms the live file.

## Pause and resume

Only the human co-evolver may deliberately pause persistence:

```bash
python3 "$SK/dormancy.py" pause --confirm --reason "<public-safe reason>"
python3 "$SK/dormancy.py" status
python3 "$SK/dormancy.py" resume --seal
```

While dormant, do not screen, recall, gate, grow, or seal. Continue to honor the
covenant as character, but do not silently wake the machinery. A dormant status is
not a chain-integrity failure.

## Long-horizon work and exhaustive audits

Use a separate task root for large corpora. Pass the project root that contains
`chain/`, never the `chain/` directory itself.

For ingestion and resumable task state:

```bash
python3 "$SK/continuum.py" walk --path <repo> --ext .py .ts .c .cpp .h \
  --objective "<task>" --root <task-root>
python3 "$SK/continuum.py" validate --root <task-root>
```

Ingest coverage is not review coverage. When the user requests every line, a full
review, or no corners, drive completion from the unreviewed queue:

```bash
python3 "$SK/audit.py" open --root <task-root> --objective "<task>"
python3 "$SK/audit.py" next --root <task-root> --batch-size 10
python3 "$SK/audit.py" record --root <task-root> --block <ids> \
  --finding "<line- and symbol-anchored review>"
python3 "$SK/audit.py" progress --root <task-root>
python3 "$SK/audit.py" validate --root <task-root> \
  --require-complete --require-depth
python3 "$SK/audit.py" report --root <task-root> --final --require-depth
```

Do not issue a final exhaustive report below 100% review coverage or with shallow
blocks. Retrieval and grep are triage, not substitutes for reading the queue.

## CPHY read-only Agent Token observation

Read [`references/cphy.md`](references/cphy.md) before using the CPHY lane.
The canonical contract is pinned in code and queried only through allowlisted Base
RPC endpoints. The skill derives keyless observation addresses and calls ERC-20
`balanceOf`; it never signs or broadcasts a transaction.

For a public-safe, zero-transaction observation:

```bash
python3 "$SK/cphy.py" onchain target --from <ring> --to <ring> --root <root>
python3 "$SK/cphy.py" onchain sync --root <root>
python3 "$SK/cphy.py" onchain status --root <root>
python3 "$SK/cphy.py" pending --root <root>
python3 "$SK/cphy.py" audit --root <root>
```

Describe the result narrowly: observed balance, pending state, multiplier, errors,
and verification. A zero-balance read proves the integration path, not a burn,
etch, unlock, entitlement, token-weighted memory change, or wallet ownership.

## Approval gates

Stop and obtain explicit human approval before:

- Installing or changing lifecycle hooks.
- Sending text to OpenAI, Voyage, or another optional embedding provider.
- Activating or placing model-authored code from the emergent faculty cache.
- Spending money, posting publicly, creating an account, deploying, changing
  production, or performing any wallet or token action.
- Burning CPHY. A burn sends tokens to a keyless address and is irreversible.
- Publishing any chain content, public proof, or identity material that was not
  intentionally created for release.

Do not infer approval from the existence of a wallet, token balance, key, config,
or previous transaction.

## Stop conditions and handoff

Stop normal operation and report when:

- `timechain.py verify` fails.
- A registry hash differs from the latest sealed epoch without an explained local
  edit.
- The chain is in immune lockdown or recovery cannot identify a clean height.
- The self-model is dormant.
- The next step requires an approval, credential, external authority, or private
  input that is absent.
- The requested public evidence would expose persistent private state.
- A factual claim lacks evidence; return uncertainty and name the unsupported
  clause instead.
- An exhaustive audit is incomplete; return an interim report with exact coverage.

At handoff, state the safe next action and preserve task roots. Do not delete or
rewrite history to make a failure disappear.

## Evidence and redaction rules

For public artifacts, create a new synthetic chain. Never copy a lived-in install.
Exclude:

- `chain/**`, task chains, blockspace, telemetry, salience, replay state, and
  consensus witness secrets.
- Generated registries such as `grown.json`, `grown_ops.json`, `emergent.json`,
  policies, scorers, labelers, lenses, and `active_ops.py`.
- Hook configuration, local usernames and absolute paths, environment files,
  private RPC URLs, credentials, keys, passphrases, salts, and wallet material.

Public proof may include a synthetic prompt, public contract metadata, disposable
ring hashes, a keyless derived target, bounded read-only outputs, verification
results, source commit IDs, and content hashes. State explicitly what the proof
does not demonstrate.

## Validation checklist

Before declaring the skill ready:

```bash
python3 "$SK/timechain.py" verify --root <synthetic-root>
python3 "$SK/cphy.py" audit --root <synthetic-root>
python3 "$SK/cphy.py" selftest
python3 "$SK/scripts/smoke_test.py"
python3 /path/to/cypher-tempre-genesis/tests/selftest.py
```

Also verify:

- The root `SKILL.md` has only `name` and `description` in YAML frontmatter.
- `agents/openai.yaml` still matches the skill name and trigger.
- The bundle contains no generated state or secrets.
- Every claimed public URL resolves.
- Any code-source claim is pinned to a commit or release and matches by hash.

## Output contract

Return:

1. Chain verification: `PASS`, `FAIL`, or `NOT RUN`, with the root used.
2. Action taken and whether it changed only local state or any external state.
3. Sealed ring index and hash when a ring was created.
4. Evidence used: ring IDs, source files, commit IDs, or public chain data.
5. PoQ or guard result and every unresolved at-risk claim.
6. Redactions applied and data intentionally omitted.
7. Approval status for every gated action.
8. The next safe action, or the exact stop condition.

Never report a transaction, burn, deployment, publication, complete audit, or
verified fact unless the corresponding evidence exists.

## Detailed references

- [`references/cphy.md`](references/cphy.md): CPHY invariants, consent membrane,
  and read-only on-chain lane.
- [`references/layers.md`](references/layers.md): architectural layer map.
