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
