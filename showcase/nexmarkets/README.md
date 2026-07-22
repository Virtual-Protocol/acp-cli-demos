# Nexmarkets

Nexmarkets is the Showcase package for the NexStudio application. Its
redacted, reviewable source snapshot is included in
[`source/`](source/), alongside the package that presents the creator
marketplace and production studio for commissioned video and infographic work.

## What the codebase does

The workflow persists the production brief and authorised sources, derives a
server-side quote, waits for verified payment, creates the render workflow,
stores versioned delivery artifacts, and then records the buyer's review and
the settlement or refund outcome. The marketplace also supports listings,
direct hires, service requests, workrooms, delivery revisions, approval, and
dispute resolution.

Wallet connection and the $NEX access flow are part of the project. The source
includes an explicit production configuration boundary: missing persistence,
provider, or chain configuration disables the affected workflow instead of
inventing a completed production.

## Proof and scope

Read [the source-backed workflow proof](examples/workflow-proof.md) for the
test result, review steps, and the distinction between verified source behavior
and an on-chain production receipt. This submission does not claim that a live
payment, render, settlement, or refund occurred.

## Package contents

- `showcase.json` is the card-ready Showcase manifest.
- `source/` is the supplied NexStudio source snapshot, with local credentials,
  build outputs, dependencies, local databases, and generated clients omitted.
- `examples/workflow-proof.md` records the redacted validation evidence and
  reviewer checks.
- `skills/nexmarkets-creator-production/SKILL.md` is the reusable,
  approval-gated operator workflow for a Nexmarkets production request.

## Reuse

Copy the project-specific skill into an agent's local skills directory:

```bash
cp -R showcase/nexmarkets/skills/nexmarkets-creator-production ~/.agents/skills/
```

The skill is deliberately conservative: it supports planning and operation of
an existing, configured Nexmarkets deployment, but requires explicit human
approval before it creates a paid request, starts a render, publishes a
deliverable, settles funds, or changes a production record.
