# Nexmarkets source-backed workflow proof

## Evidence type

This is a source-validation record for the supplied
[NexStudio source snapshot](../source/). It is not a claim that an on-chain
payment, a live render, a settlement, or a refund has completed. No
credentials, wallet material, personal data, payment details, or private source
content are included here.

## Local validation snapshot

On 2026-07-22, the project test suite was run from the `nexstudio` directory:

```text
Command: npm test
Result: 9 test files passed; 19 tests passed
Duration: 1.97s
```

The source repository's README documents the production workflow and its
failure-closed provider and chain boundaries. Reviewers can inspect the source
at the repository link above, then reproduce the test run with:

```bash
cd nexstudio
npm install
npm test
```

## Workflow represented

1. A creator or buyer supplies an approved brief and authorised sources.
2. The server derives a quote and the client submits a payment transaction.
3. Production proceeds only after the payment is confirmed and required
   provider, destination, and rendering configuration is available.
4. The resulting artifact is versioned for buyer review.
5. Review leads to a recorded approval, revision, settlement, refund request,
   dispute, or resolution state as applicable.

Marketplace work follows the same evidence-first approach: chain-dependent
state is applied only after the matching event reaches its configured
confirmation depth, and is recomputed if an indexed event is orphaned.

## Reviewer checks

- Inspect the linked NexStudio source and its `README.md` workflow boundaries.
- Run `npm test` from the source directory; the result above is a reproducible
  code-validation snapshot, not a substitute for a production receipt.
- Confirm this Showcase package contains no operational secrets or claims of
  unobserved live transactions.
