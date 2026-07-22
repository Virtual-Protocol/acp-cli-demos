---
name: joysender-celebration-gift
description: Prepare a bounded ACP request for one approved Celebration Hub gift to a Farcaster or X recipient.
---

# JoySender Celebration Gift

Use this skill when a user explicitly asks to create one social celebration gift through
the JoySender ACP offering.

## Tools, credentials, and preconditions

- Use the official Virtuals ACP CLI for the ACP job lifecycle.
- The provider bridge must already be configured with its ACP agent id and a signed,
  localhost-only Hermes gateway. The skill never asks for those credentials.
- The user must identify one Farcaster or X recipient and approve one final normalized
  requirement. Do not proceed from an inferred recipient or a draft message.

## Required inputs

- Platform: `farcaster` or `x`.
- Recipient platform and handle. A Farcaster FID or numeric X user id is optional evidence,
  not something to guess.
- Occasion: birthday, celebration, milestone, or custom.
- Style: `ai`, `draw`, or `nexart`.
- Delivery: `classic` for an offchain gift, or `base_nft` for a Base collectible gift.
- Short message and a visual prompt. The prompt is required for every style so the
  provider can validate and reproduce the approved visual intent.
- Explicit confirmation that the user wants the gift created now.

## Approval gate

Show the normalized recipient, message, style, and delivery to the user before creating
the ACP job. Set `userApproved: true` only after the user confirms that exact request.
Changing the recipient, visual mode, message, or delivery requires a new confirmation.

## Prepare the requirement

Return a JSON object matching this shape:

```json
{
  "platform": "farcaster",
  "recipient": { "handle": "example.eth" },
  "occasion": "birthday",
  "style": "draw",
  "message": "Happy birthday!",
  "prompt": "A joyful birthday cake with violet confetti",
  "delivery": "classic",
  "publicFeed": false,
  "userApproved": true
}
```

## Stop conditions

Stop and ask the user when the recipient is ambiguous, the user has not approved the
final action, or the request asks for token transfers, public posting, multiple
recipients, unsafe content, arbitrary links, or direct wallet/key operations.

Do not substitute a guessed FID or X user id. The provider resolves the handle through
the platform API, maps it to a canonical Celebration Hub recipient, and rejects a supplied
id when it does not match. Do not convert between `classic` and `base_nft` after approval.
Do not retry a job after an ambiguous payment, mint, or delivery result.

Choose exactly one visual mode:

- `ai`: a polished generated image. Always provide a concrete visual prompt with subject,
  mood, colors, and occasion.
- `draw`: a personal sketch or hand-drawn note. Use simple drawable objects and composition.
- `nexart`: more stylized generative artwork. Use when the user explicitly asks for NexArt
  or a highly stylized visual.

Do not silently change the requested mode. If the request says only "a gift" and gives no
visual preference, propose `ai`, show the normalized requirement, and obtain confirmation
before setting `userApproved: true`. If the user does not choose delivery, use `classic`.
Use `base_nft` only when the user explicitly asks for an NFT, collectible, or onchain Base
gift. Before a gift job is created, Hermes runs a signed, read-only preflight that
independently resolves the recipient and confirms the selected style and delivery. The
worker verifies the selected visual before funding or minting the gift.

## Recipient examples

Farcaster by handle:

```json
{ "platform": "farcaster", "recipient": { "handle": "duckfacts.eth" } }
```

X by handle:

```json
{ "platform": "x", "recipient": { "handle": "celesteanglm" } }
```

Include `platformUserId` only when it comes from authoritative platform context. The
provider still resolves the handle independently and rejects a mismatch.

## Verify the deliverable

The provider deliverable must be a Celebration Hub HTTPS gift URL. Report the normalized
platform, handle, canonical Celebration Hub FID, recipient resolution status, selected
style, delivery, and delivered status.
Confirm that the URL resolves and its visual is available.
Never print ACP credentials, HMAC secrets, environment
variables, social tokens, wallet material, cookies, or internal service output.

## Output and handoff

Return the final Celebration Hub URL and the normalized recipient, style, and delivery.
If the provider reports `ambiguous` or `failed_final`, stop and hand the job to an operator;
do not create a replacement job or ask the user to pay again.
