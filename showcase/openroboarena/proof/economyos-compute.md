# EconomyOS Compute proof

## Live workflow

OpenRoboArena sends unsupported natural-language movement phrasing to a
server-side EconomyOS Compute classifier. The classifier is limited to this
local animation allowlist: `punch`, `cross`, `combo`, `kick`, `roundhouse`,
`reset`, and `unknown`.

The selected label activates a local FBX animation. No repository is executed,
no physical hardware is controlled, and no blockchain transaction is requested.

## Redacted verification

- Live endpoint: <https://www.openroboarena.xyz/api/motion-plan>
- Request method: `POST`
- Test input: `perform a whirling martial arts strike`
- Result: HTTP `200`
- Returned command: `roundhouse`
- Date: 2026-07-22

The Compute API key is stored only as the Vercel Production environment variable
`VIRTUALS_API_KEY`. It is not included in source control, browser code, or this
proof file.

## Primitives disclosure

The OpenRoboArena agent has EconomyOS `wallet` and `email` primitives
provisioned for its public identity. This proof and the demonstrated Motion Lab
workflow do not invoke either primitive, do not request credentials, and do not
make a payment or transaction. The only live service used here is EconomyOS
Compute, which returns a bounded local animation label.
