# 0xCopilot local workspace on Virtuals compute

Stand up a local-first agent workspace on the operator's own machine and point
it at Virtuals compute, so agent work runs on EconomyOS credits instead of a
personal provider bill — with the model catalogue carrying live per-Mtok pricing
so the cost of a task is legible before it is spent.

## When to use this

- The operator has Virtuals credits (or their own provider key) and wants a
  local harness rather than a hosted one.
- Conversations, runs, and artifacts must stay on the operator's disk.
- You are asked to verify or repair an existing 0xCopilot install.

## When NOT to use this

- **You need a headless, scriptable agent run.** This CLI is a launcher and
  installer, not a batch runner — there is no `copilot run "<task>"`. Work is
  given to the agent in the app. If you need automation, drive the product's
  HTTP API instead; do not pretend this skill gives you a pipeline.
- The target is Linux, or Windows on ARM. Not supported.
- The operator wants a shared/multi-tenant deployment. This is single-user and
  local by design.

## Preconditions

| | |
| --- | --- |
| Node.js | 20+ |
| OS | macOS (Apple Silicon or Intel) or Windows x64 |
| Network | required on first launch |
| Disk | several hundred MB for the runtime, plus app data |
| Credential | a Virtuals ACP key, or an OpenAI / Anthropic / Google key |

## Approval gates — stop and ask before each

1. **First install downloads several hundred megabytes.** Get explicit consent
   before running `copilot` or `copilot install` on a metered or constrained
   connection.
2. **Running agent tasks spends credits.** Virtuals compute draws down the
   operator's balance. Confirm a budget before starting work, not after.
3. **`copilot uninstall` deletes all local 0xCopilot data** — conversations,
   runs, artifacts. It is not recoverable. Never run it to "clean up" without an
   explicit instruction naming the consequence. Prefer `copilot repair`, which
   recovers a stuck launch while keeping data.
4. **Never type, echo, or store the operator's provider key.** It is entered by
   a human, in the app, and lives in the OS keychain.

## Steps

```bash
npm install -g @0x-copilot/cli   # or: bun add -g @0x-copilot/cli
copilot                          # prepares the runtime, then launches the app
```

Then **hand off to the human** for two steps an agent must not perform:

1. Sign in (wallet, or Google where enabled).
2. **Settings → Models & keys → Provider keys** → add the Virtuals key. Selecting
   Virtuals as the provider exposes its catalogue — roughly sixty models across
   ten vendors behind one endpoint, each row carrying real per-Mtok pricing.

Give the agent a goal in the composer once a key is saved.

## Stop conditions

- `copilot doctor` reports an unmet requirement → report its output verbatim and
  stop. Do not attempt to work around a missing runtime.
- The launch hangs → `copilot repair` (keeps data). Add `--session` only if the
  operator agrees to clear saved sign-ins. Escalate rather than reinstalling.
- A run fails with a provider or service error → this is a credential or
  upstream-availability problem, not a task problem. Re-check the key before
  retrying, and never retry in a loop against a paid endpoint.

## Validation

```bash
copilot version    # prints the installed version
copilot doctor     # diagnoses the setup and prints what it finds
```

The install is good when `doctor` reports no unmet requirements and the app
launches to a workspace. The *key* is good when the composer's model pill
resolves to a real model rather than a placeholder — a saved key is not proof of
a working one, because the catalogue endpoint answers publicly and says nothing
about your credential.

## Output contract

On success, report:

- installed CLI version,
- `doctor` verdict (unmet requirements, if any),
- whether a provider key is configured — **as a boolean, never the value**,
- the local data location, so the operator knows what `uninstall` would remove.

On failure, report the failing command, its exact output, and which stop
condition above was hit. Do not summarise an error into prose — the product's
typed errors are more precise than a paraphrase of them.

## Links

- CLI package — https://www.npmjs.com/package/@0x-copilot/cli
- Source — https://github.com/0x-copilot-dev/0x-copilot
- App — https://copilot.kleosresearch.xyz
