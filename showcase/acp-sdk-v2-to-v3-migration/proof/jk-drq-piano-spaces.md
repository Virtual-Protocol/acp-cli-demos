# @jk_drq piano Spaces — public video proof

Public X Spaces from [@jk_drq](https://x.com/jk_drq) used as the visual/audio proof surface for this showcase.

## Primary Space

| Field | Value |
| --- | --- |
| Title | Distorted Face Piano (Dr. Q live piano Space) |
| Host | [@jk_drq](https://x.com/jk_drq) |
| Space | [https://x.com/i/spaces/1dKrPPWnNDzJX](https://x.com/i/spaces/1dKrPPWnNDzJX) |
| Peek | [https://x.com/i/spaces/1dKrPPWnNDzJX/peek](https://x.com/i/spaces/1dKrPPWnNDzJX/peek) |
| Recorded session | 2026-03-10 (as cited on EconomyOS agent resource metadata) |
| Claim | Public listen/watch page on X — not a direct `.mp4` file URL |

## Why a Space (not an amplify_video mp4)

Showcase video rules distinguish:

1. **X status with amplify video** → `links.video` = status URL + `visual.videoUrl` = `video.twimg.com/...mp4`
2. **X page without a stable direct file** (Spaces replay/peek) → `links.video` = public X page, **omit** `visual.videoUrl`, keep a local `posterUrl`, set `visual.videoLabel` that names **X**

This package uses path (2). The Space is the public performance artifact from the builder's X identity; the migration kit itself remains offline-proofed code + skill.

## How reviewers can verify

1. Open the Space link above while logged into X.
2. Confirm host handle is `jk_drq`.
3. Confirm the recording/peek resolves (HTTP 307 → `/peek` observed 2026-08-01).
4. Cross-check builder identity: PR author `drQedwards` / Dr. Q desk.

## Redaction

- No private DMs, no unlisted Spaces, no auth cookies.
- No attempt to scrape or re-host the Space audio binary in this repo.
