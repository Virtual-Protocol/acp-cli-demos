# ACP SDK v2 → v3 Migration

Public, dry-runnable migration kit for moving an ACP Node integration from the
**v2 two-callback `AcpClient` model** to the **v3 `AcpAgent` entry-event model**.

> Package name stays `@virtuals-protocol/acp-node-v2`. "v3" here means the
> `AcpAgent.create` / `agent.on("entry")` / `AssetToken` / hooks API surface.

## Why this exists

Virtuals published an SDK migration guide covering:

- multi-chain sessions
- non-custodial agent wallets (keys not held in app memory at rest)
- hook-based protocol (memos removed)
- unified event model shared with `acp-cli`

This showcase turns that guide into:

1. side-by-side **before/after code**
2. a **canonical phase → event map**
3. **offline self-checks** (no credentials, no network)
4. a reusable **agent skill** other builders can install

## Quick start

```bash
# from repo root
node showcase/acp-sdk-v2-to-v3-migration/scripts/self-check.mjs
node showcase/acp-sdk-v2-to-v3-migration/scripts/print-migration-map.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-provider.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-client.mjs
```

## Layout

```
showcase/acp-sdk-v2-to-v3-migration/
  showcase.json
  README.md
  soul.md
  assets/poster.png
  examples/
    v2-provider.legacy.mjs      # retired shape (documentation)
    v3-provider.mjs             # provider skeleton + dry-run
    v3-client.mjs               # client skeleton + exact fund guard
    phase-event-map.mjs         # tables
    prompt.md
    result-redacted.md
  proof/offline-validation.md
  scripts/self-check.mjs
  scripts/print-migration-map.mjs
  skills/acp-sdk-v2-to-v3-migration/SKILL.md
```

## Cheat sheet

| Concern | v2 | v3 |
| --- | --- | --- |
| Construct | `new AcpClient({ onNewTask, onEvaluate })` | `await AcpAgent.create(...)` + `agent.on("entry")` + `start()` |
| Price | `job.accept` + `createRequirement` | `session.setBudget(AssetToken.usdc(a, chainId))` |
| Fund | `job.payAndAcceptRequirement` | `session.fund(AssetToken.usdc(a, chainId))` |
| Deliver | `job.deliver({type,value})` | `session.submit(deliverable)` |
| Approve / reject | `job.evaluate(true\|false)` | `session.complete` / `session.reject` |
| Create job | `offering.initiateJob` | `agent.createJobFromOffering` |
| Tokens | `Fare` / `FareAmount` | `AssetToken.usdc` |

### Phase → event

| v2 phase | v3 event | Next actor |
| --- | --- | --- |
| REQUEST | `job.created` | Provider |
| NEGOTIATION | `budget.set` | Client |
| TRANSACTION | `job.funded` | Provider |
| EVALUATION | `job.submitted` | Evaluator / Client |
| COMPLETED | `job.completed` | — |
| REJECTED | `job.rejected` | — |

## Platform step

On [app.virtuals.io](https://app.virtuals.io) → **My Agents & Projects**, click
**Upgrade now** on the migration banner for any legacy agent before expecting
v3 job rooms to work.

CLI equivalent for legacy agents:

```bash
acp agent migrate --agent-id <id> --json
acp agent migrate --agent-id <id> --complete --json
```

## Safety

- Examples default to **offline dry-run**. No private keys are embedded.
- `LIVE=1` is opt-in and requires you to supply a provider factory module.
- Client funding demos enforce **exact amount match** against `budget.set`.
- Do not publish OTPs, card data, private keys, or signer material in proof files.

## Install the skill

```bash
cp -R showcase/acp-sdk-v2-to-v3-migration/skills/acp-sdk-v2-to-v3-migration ~/.agents/skills/
cp -R showcase/acp-sdk-v2-to-v3-migration/skills/acp-sdk-v2-to-v3-migration ~/.claude/skills/
```

## Proof

See [`proof/offline-validation.md`](proof/offline-validation.md) for the
redacted self-check receipt captured when this package was built.

## Public video proof

Builder X identity: [@jk_drq](https://x.com/jk_drq)

Primary piano Space used as the showcase watch link:

- **Distorted Face Piano** — [https://x.com/i/spaces/1dKrPPWnNDzJX](https://x.com/i/spaces/1dKrPPWnNDzJX)

Spaces are linked via `links.video` (public X page). There is no stable public `video.twimg.com` mp4 for Spaces replays, so `visual.videoUrl` is omitted and the card uses the local poster plus an X watch label. Details: [`proof/jk-drq-piano-spaces.md`](proof/jk-drq-piano-spaces.md).
