# JoySender by Celebration Hub

JoySender demonstrates an ACP provider workflow for social celebrations. A buyer chooses
a recipient, occasion, safe visual style, and delivery mode; an isolated Hermes worker
creates one Celebration Hub gift; the provider submits its public gift URL as the
deliverable.

## Boundaries

- Explicit user approval is mandatory.
- One job creates at most one gift.
- Supported styles are AI, Draw, and NexArt.
- Supported delivery modes are classic offchain gift URLs and collectible gifts minted as NFTs on Base.
- X and Farcaster handles are independently resolved; optional numeric IDs are verified,
  never trusted blindly.
- Public-feed posting, token transfers, and arbitrary wallet actions are rejected.
- The public package has no access to production social or wallet credentials.

## Proof status

The package includes deterministic mock evidence plus a redacted, completed
owner-controlled production pilot. English showcase media is available in [`media/`](media/).
The manifest is ready for public Showcase review; publication still depends on upstream
approval and merge.

## Showcase media

- `media/cover.png` - 1600x900 cover.
- `media/acp.png` - structured ACP request entering the approval flow.
- `media/brief.png` - recipient, platform, style, and delivery brief.
- `media/approval.png` - approval-first delivery review.
- `media/classic.png` - completed classic gift delivery.
- `media/nft.png` - completed NFT on Base gift delivery.
- `media/joysender-demo-en.mp4` - 21-second English demo, 1920x1080.
