# OpenRoboArena

OpenRoboArena is a live browser experience for discovering public robotics
repositories and using a safe 3D Motion Control Lab. Visit the live catalog at
<https://www.openroboarena.xyz> or open the lab directly at
<https://www.openroboarena.xyz/motion-control.html>.

Follow project updates on X: <https://x.com/OpenRoboArena>.

## Demo video

[Watch the short PUNCH movement demo](https://github.com/OpenRoboArena/openroboarena/blob/main/public/assets/openroboarena-punch-demo.mp4). It captures the live Motion Control Lab command terminal and the local MX-01 FBX animation.

## EconomyOS workflow

When a visitor enters unsupported natural-language movement phrasing, the
server-side `/api/motion-plan` endpoint sends only the short command to
EconomyOS Compute. The model is constrained to a small local animation
allowlist. The browser then plays the matching local FBX animation.

The workflow never executes submitted repository code, controls physical
hardware, requests wallet credentials, or initiates a payment or transaction.
The redacted live proof is in [proof/economyos-compute.md](./proof/economyos-compute.md).

## Included package

- `showcase.json` — card metadata and public links.
- `proof/` — reproducible redacted verification.
- `skills/` — reusable Motion Control Lab workflow.
- `soul.md` — public agent context and safety boundaries.
