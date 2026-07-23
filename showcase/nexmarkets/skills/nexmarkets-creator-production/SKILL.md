---
name: nexmarkets-creator-production
description: Plan and operate an existing NexMarkets creator-production request with source, payment, render, delivery, and settlement approval gates.
version: 0.1.0
---

# NexMarkets Creator Production

Use this skill for an existing NexMarkets deployment when an operator needs to
prepare, inspect, or advance a commissioned video or infographic request. It
supports the production and marketplace lifecycle without treating browser
state, a client claim, or a provider response as proof of payment or delivery.

Do not use this skill to manufacture demo records, bypass a production gate,
or imply that a render, payment, settlement, or refund succeeded without the
corresponding persisted record and configured verification.

## Inputs

- Deployment base URL, or a local NexStudio checkout for source-level review.
- Production, listing, service-request, or workroom identifier when one
  already exists.
- Approved production brief and authorised source locations.
- The requested deliverable type, destination, and review criteria.
- For any paid or externally visible action: the user's explicit approval,
  amount or budget cap, and intended recipient or public destination.

## Preconditions

- The operator has access to the intended deployment and authenticated account.
- Persistence, chain, and required provider configuration are available for the
  action being requested.
- Source material is authorised for the requested use.
- The operator knows whether this is a source-level review, local development
  simulation, or a production action. A simulation is never evidence of a live
  transaction or delivery.

## Workflow

1. Identify the request and its current persisted state. Do not assume a
   listing, production, workroom, or payment record exists.
2. Confirm the brief, authorised sources, deliverable type, destination, and
   review criteria with the request owner.
3. Obtain the server-derived quote and present the amount, asset, recipient,
   and expected outcome before any payment is initiated.
4. Wait for the application's configured payment and chain verification before
   starting a paid production or treating workroom funds as available.
5. Start a render or delivery workflow only when its required provider and
   destination checks have passed. Preserve returned artifact identifiers and
   links as evidence; never replace a failure with a synthetic success.
6. Present the versioned output for review. Record revision, approval,
   cancellation, dispute, settlement, or refund actions only through the
   authorized application workflow.
7. Return a concise status report with the persisted identifier, current
   lifecycle state, validation evidence, next authorized action, and any block.

## Approval gates

Stop for explicit approval before any of the following:

- Authorising or uploading source material not already approved for the job.
- Initiating a payment, funding reserve, on-chain transaction, refund, or
  settlement.
- Starting a paid render or another provider action that incurs a charge.
- Sending a deliverable to Telegram, a customer, or any public destination.
- Publishing a listing, changing a service offer, resolving a dispute, or
  deleting a production or workroom record.

## Stop conditions

- The requested record cannot be found or its state does not permit the action.
- A quote, payment confirmation, wallet signature, chain event, provider
  configuration, or destination verification is missing.
- The requested payment amount, destination, or output scope differs from the
  user's approval.
- Source authorisation, authentication, or security validation fails.
- The only available result is a local development simulation but the request
  requires production proof.

## Validation and output contract

Before reporting completion, verify the persisted state and any required
payment, chain, provider, and delivery checks relevant to the action. Return:

- request identifier and lifecycle state;
- approved scope and any spending or publishing authorization used;
- redacted evidence links or identifiers for payment, render, delivery, and
  review where they actually exist;
- the next permitted action, or a precise blocking reason.

Never return private source content, wallet material, session tokens, API keys,
payment credentials, OTPs, or unredacted personal data.
