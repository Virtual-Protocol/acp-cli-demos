# Source snapshot boundary

`source/` is a reviewer-visible snapshot of the NexStudio application supplied
for this Showcase submission. It contains the application, contract, Prisma,
rendering, configuration-template, public-image, and test source needed to
inspect the documented workflow.

The snapshot intentionally excludes local and generated material that does not
belong in a public Showcase submission:

- `.env` files and other local credential material;
- `node_modules/`, `.next/`, caches, coverage, and TypeScript build state;
- local databases, uploads, renders, and deployment outputs; and
- generated Prisma clients.

Nonessential test helpers containing credential-shaped local test configuration
are also omitted.

Run the source-level test suite from `source/` with `npm install` followed by
`npm test`. A passing test suite is code-validation evidence only; it does not
prove a live payment, render, settlement, or refund.
