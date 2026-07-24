# NexMarkets

The NexMarkets Showcase package presents the newer NexMarkets application: an
open-source creator marketplace with Studio production for commissioned video
and infographic work. The maintained implementation lives in the
[NexMarkets source repository](https://github.com/Domistro16/NexID/tree/main/nexstudio);
this demos repository contains only the card manifest, review documentation,
workflow proof, and reusable production skill.

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

[SOURCE_SNAPSHOT.md](SOURCE_SNAPSHOT.md) records the external source boundary
used for review without duplicating the application in this repository.

## Package contents

- `showcase.json` is the card-ready Showcase manifest.
- `SOURCE_SNAPSHOT.md` links to the maintained NexMarkets source repository and
  documents the validation boundary.
- `examples/workflow-proof.md` records the redacted validation evidence and
  reviewer checks.
- `skills/nexmarkets-creator-production/SKILL.md` is the reusable,
  approval-gated operator workflow for a NexMarkets production request.

## Reuse

Copy the project-specific skill into an agent's local skills directory:

```bash
cp -R showcase/nexmarkets/skills/nexmarkets-creator-production ~/.agents/skills/
```

The skill is deliberately conservative: it supports planning and operation of
an existing, configured NexMarkets deployment, but requires explicit human
approval before it creates a paid request, starts a render, publishes a
deliverable, settles funds, or changes a production record.
