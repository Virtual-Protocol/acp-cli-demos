# Completed ACP pilot proof

This redacted proof records owner-controlled hidden production jobs. No session token,
private key, signer material, HMAC secret, environment file, or private instruction is
included.

## Current acceptance results

### Draw / classic

- ACP job: `70234` on Base (`8453`)
- Price funded: `0.01 USDC`
- Recipient: independently resolved and allowlisted Farcaster FID `217261`
- Style and delivery: `draw` / `classic`
- Deliverable: <https://celebration-hub.xyz/share-greeting/87370502>
- Terminal ACP status: `completed`

### AI / Base NFT

- ACP job: `70235` on Base (`8453`)
- Price funded: `0.01 USDC`
- Recipient: independently resolved and allowlisted Farcaster FID `217261`
- Style and delivery: `ai` / `base_nft`
- Deliverable: <https://www.celebration-hub.xyz/share-gift-nft/73446b7e-e33e-4ebf-ad00-617c69eeff3e>
- Terminal ACP status: `completed`

Both deliverable pages returned HTTP 200 with an image preview after completion. Both
jobs followed the full lifecycle below without public-feed publication.

## Earlier classic pilot

- ACP job: `68228` on Base (`8453`)
- Offering: `Send a Celebration Gift`
- Price funded: `0.01 USDC`
- Provider: JoySender (`0x085e...ff15`)
- Recipient: allowlisted Farcaster FID `217261`
- Delivery: private classic visual gift, not published to the public feed
- Deliverable: <https://celebration-hub.xyz/share-greeting/83403844>
- Terminal ACP status: `completed`

## Verified lifecycle

```text
job.created
requirement
budget.set (0.01 USDC)
job.funded (0.01 USDC)
job.submitted (Celebration Hub gift URL)
job.completed
```

The buyer funded the job with Base USDC. After evaluator approval, the provider received
the ACP payout. The Celebration Hub operational payment was independently bounded to one
ACP operation and one daily pilot allowance.

## Controls exercised

- The request required `userApproved: true`.
- The pilot supplied a Farcaster FID and the provider verified the recipient against the
  private allowlist. The current contract additionally resolves the handle independently
  and rejects a supplied FID or X user id when it does not match.
- The recipient had to match the private pilot allowlist.
- The earlier pilot used the curated classic visual mode. The current acceptance jobs
  additionally prove generated Draw/classic and AI/Base NFT delivery.
- The same bounded contract accepts `nexart`; its normalization, preflight, and visual checks
  are covered by automated and signed preflight tests rather than an additional paid job.
- Public-feed publication, token instructions, and arbitrary URLs were rejected.
- The bridge used a localhost-only HMAC gateway and deterministic idempotency keys.
- Live execution and spend flags were returned to `0` after the completed job.

## Recovery evidence

An earlier owner-controlled attempt failed before any gift payment because recipient
resolution was incomplete. Its ACP escrow was rejected and fully returned. The contract
now requires a platform and handle, resolves that handle through the provider API, verifies
an optional numeric ID, and then applies the private recipient allowlist. No retry was
performed after a submitted payment side effect.

A later acceptance attempt (`70200`) expired while an operation-key defect was being
diagnosed. The defect duplicated the `gift:` prefix and stopped before the operational
gift transaction. The runtime now normalizes an already-scoped ACP operation key and has
a regression test for that boundary. A recovery created a private gift only after the
ACP job had already expired, so it was not claimed as an ACP deliverable and no second ACP
payment was requested. Jobs `70234` and `70235` are the post-fix acceptance evidence.
