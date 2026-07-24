# Source review boundary

The newer NexMarkets application, including its Studio implementation, is
maintained in the public
[NexID repository](https://github.com/Domistro16/NexID/tree/main/nexstudio).
The application source is intentionally linked rather than copied into this
Showcase package, keeping `acp-cli-demos` focused on the showcase manifest,
review evidence, and reusable skill.

Reviewers can inspect the NexMarkets application, contracts, Prisma schema, rendering
integration, configuration template, and tests at that source link.

The local validation recorded in
[`examples/workflow-proof.md`](examples/workflow-proof.md) is source-level
evidence only. It does not prove a live payment, provider render, settlement,
or refund. Operational credentials, local databases, uploads, generated
clients, caches, and build outputs are not part of this Showcase package.
