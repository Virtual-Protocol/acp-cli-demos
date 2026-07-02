# Showcase Manifests

Showcase projects are published from this repo into the EconomyOS Community
Showcase after the contribution PR is approved and merged.

Each public entry lives in `showcase/<project-slug>/`. The manifest is
`showcase/<project-slug>/showcase.json`, and the same folder can contain the
proof notes, project-specific skill, artifacts, image assets, and reviewer
context needed by the docs site.

New here? Read [End-To-End Flow](#end-to-end-flow), fill in the
[Field Reference](#field-reference), then run the
[Contributor Checklist](#contributor-checklist) before opening your PR.
Copy [`paid-substack-subscription/showcase.json`](paid-substack-subscription/showcase.json)
as a starting point.

## End-To-End Flow

1. Build a real EconomyOS workflow and capture public proof.
2. Add the project package under `showcase/<project-slug>/`. The folder name
   **must** match the manifest `slug`.
3. Add a project-specific reusable skill under
   `showcase/<project-slug>/skills/<skill-name>/` when the workflow can be
   repeated. Use top-level `skills/<skill-name>/` only when the skill is shared
   across projects.
4. Validate locally: `node scripts/validate-showcase.mjs`.
5. Open a PR against `Virtual-Protocol/acp-cli-demos`.
6. Reviewers check the demo package, redaction, skill quality, and manifest
   (see [What Reviewers Check](#what-reviewers-check)).
7. After merge to `main`, the sync workflow publishes the manifest into the
   EconomyOS docs Showcase data. Confirm it landed — see
   [Confirming Your Card Went Live](#confirming-your-card-went-live).

The publish step requires the `SHOWCASE_SYNC_TOKEN` repository secret to be set
in `acp-cli-demos`. It should be a GitHub token that can create a repository
dispatch event in `Virtual-Protocol/whitepaper-economyOS`.

## Field Reference

This table is the source of truth for the manifest shape. Every rule here is
enforced by [`scripts/validate-showcase.mjs`](../scripts/validate-showcase.mjs);
run it before requesting review.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `slug` | yes | string | Lowercase kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`). **Must equal the folder name** `showcase/<slug>/`. **Globally unique** across all manifests. This is the card's identity key — do not rename it later (see [Updating a Published Showcase](#updating-a-published-showcase)). |
| `title` | yes | string | Display name of the project. |
| `tagline` | yes | string | One line. See [Copy and Style Conventions](#copy-and-style-conventions). |
| `description` | yes | string | 2–4 sentences. See [Copy and Style Conventions](#copy-and-style-conventions). |
| `status` | yes | string | Free text, e.g. `live`, `active`, `validated demo`. |
| `topic` | yes | string | Single primary category. Current values in use: `agents`, `skills`, `commerce`, `security`. Pick the closest one. |
| `topics` | yes | string[] | Non-empty list of search/filter tags. Distinct from `topic` — these are the free-form tags; `topic` is the one primary bucket. |
| `builder.name` | yes | string | |
| `builder.url` | yes | URL | `http(s)://` |
| `links.repo` | yes | URL | Source or package location. |
| `links.share` | yes | URL | The post/page to share. |
| `links.feedback` | yes | URL | Where feedback goes (issue link is fine). |
| `links.demo` | no | URL | Optional live demo / proof link. |
| `links.video` | no | URL | Public watch page. Setting this makes `visual.videoLabel` required. See [Video Fields](#video-fields). |
| `primitives` | yes | string[] | Non-empty. Allowed: `wallet`, `email`, `card`, `token`, `acp`. |
| `visual.kind` | yes | string | Short descriptor of the card kind. |
| `visual.eyebrow` | yes | string | Small label above the title on the card. |
| `visual.title` | yes | string | Card headline. |
| `visual.posterUrl` | no | URL | Card hero image. See [Card Image](#card-image). |
| `visual.videoUrl` | no | URL | Direct video **file** only. See [Video Fields](#video-fields). |
| `visual.videoLabel` | conditional | string | Required when `links.video` is set; must name the platform. |
| `skills` | yes | object[] | Array (may be empty if there is no reusable skill). Each entry needs `name`, `href` (URL), `summary`, `install`. |
| `skills[].sourcePath` | no | relative path | When the skill is committed in this repo. Must stay inside the repo and contain a `SKILL.md`. |
| `artifacts` | yes | object[] | **Non-empty.** Each entry needs `label`, `href` (URL), `kind`. Include at least one inspectable proof. |
| `soul` | no | object | When publishing public agent context: `soul.href` (URL) + `soul.summary`. See [Optional Agent Context](#optional-agent-context). |
| `feedbackPrompts` | yes | string[] | **Exactly three** non-empty prompts. |
| `hidden` | no | boolean | `true` keeps the package valid but stops the docs sync from publishing the card. See [Visibility Control](#visibility-control). |

Proof matters more than polish. An X video is highly recommended when possible
because it is visual and easy to share, but it is not required. Use any
inspectable artifact that shows the project or workflow ran: screenshot, hosted
video, animated demo, live page, interactive demo, public PR, demo repo, or
redacted result report.

## Copy and Style Conventions

Keep card copy consistent with the projects already published:

- **Tagline** — lead with a verb / the offering, present tense, describe what
  the agent *does*. No "An X agent that…" preamble, and **no trailing period**.
  - Good: `Audits a public GitHub PR with two frontier models and reports only the findings both agree on, with SHA-pinned receipts`
  - Good: `Scans an ACP agent contract and returns a Trust Score grading six security dimensions from A to F`
  - Avoid: `An autonomous agent that runs reviews…` (buries the offering behind a preamble and reads like a meta-description).
- **Description** — 2–4 sentences. Say what it does, then what proof backs it
  (receipts, deliverable shape, on-chain identity). Plain language, no marketing
  filler.
- **`topic` vs `topics`** — `topic` is the single primary bucket used for
  grouping; `topics` are the free-form tags used for search. Don't duplicate the
  title in either.

## Card Image

`visual.posterUrl` is the card's hero image. It works **with or without a
video** — a poster set on a project that has no video renders as a static card
image, so this is how a no-video project gets a picture on its card.

- Must be an `https://` image URL. (Site-relative `/...` paths are
  maintainer-managed assets in the docs repo — **do not use them in contributor
  PRs**.)
- To ship the image inside this repo, commit it as
  `showcase/<slug>/assets/poster.jpg` and reference
  `https://raw.githubusercontent.com/Virtual-Protocol/acp-cli-demos/main/showcase/<slug>/assets/poster.jpg`.
  The `main` URL only resolves **after** the PR merges, so verify the same path
  on your fork or branch before requesting review.
- Use a **16:9** image sized for a card hero (e.g. 1280×720 or larger). Other
  aspect ratios get cropped; 4:3 thumbnails (like YouTube `hqdefault.jpg`) are
  visibly cut off.
- Verify it resolves: `curl -sI "<visual.posterUrl>"` should return `200` with
  an `image/...` content type.

If your project has a video, the poster is sourced from the video platform —
see [Video Fields](#video-fields) for the per-platform poster URLs (YouTube
thumbnail, X `amplify_video_thumb`, and so on).

## Video Fields

Use these rules whenever the submission includes a video. The docs site plays
a video inline when `visual.videoUrl` is a direct video file, embeds a
click-to-play YouTube player when `links.video` is a YouTube URL, and links
every other video page out to its own platform.

| Where the video lives | `links.video` | `visual.videoUrl` | `visual.posterUrl` (recommended, not required) | `visual.videoLabel` |
| --- | --- | --- | --- | --- |
| X post | the `x.com/<user>/status/<id>` post URL | the direct `https://video.twimg.com/....mp4` file URL | the `https://pbs.twimg.com/amplify_video_thumb/...` image from the same capture | `Watch the 1:50 demo on X` |
| YouTube | the watch or Shorts URL | omit — the docs site embeds the YouTube player from `links.video` | `https://img.youtube.com/vi/<video-id>/maxresdefault.jpg` | `Watch the 1:50 demo on YouTube` |
| Vimeo, TikTok, Loom, or another video page | the page URL | omit — page URLs cannot play inline, and tokenized CDN file URLs extracted from players expire | commit a captured frame under `showcase/<slug>/assets/` | `Watch the 1:50 demo on Vimeo` |
| Self-hosted file | a public page when one exists, otherwise the file URL | the direct `.mp4` file URL (see hosting notes below) | recommended | `Watch the 1:50 demo` |
| No video | omit | omit | optional — see [Card Image](#card-image); a poster without a video renders as a static image | omit |

Replace `1:50` with the real video duration.

Field meanings and what the validator enforces:

- `links.video` is the public watch page. Point `links.share` at the same post
  or page unless a separate announcement post should be shared. Also list the
  video under `artifacts` with kind `video` so it is reachable from the
  project detail view.
- `visual.videoUrl` must be a direct video file that a browser video tag can
  stream. `.mp4` (H.264) is strongly preferred because it plays everywhere;
  `.webm` does not play in older Safari, and `.mov`/`.m4v` are accepted but
  discouraged. The validator rejects video page URLs (YouTube, X, Vimeo,
  TikTok, Loom), repo pages (`github.com/.../blob/...`), and share or preview
  links (Dropbox, Google Drive, OneDrive, and similar) because they serve an
  HTML page instead of the file. For a file committed in a GitHub repo, use
  its `raw.githubusercontent.com` URL. For Dropbox, use a
  `dl.dropboxusercontent.com` URL. Do not use tokenized CDN URLs pulled out
  of Vimeo or similar players; they expire and silently break the card.
- `visual.posterUrl` for a video follows the [Card Image](#card-image) rules
  plus these per-platform sources. For YouTube, use the thumbnail
  `https://img.youtube.com/vi/<video-id>/maxresdefault.jpg`; the `<video-id>`
  is the `v=` query parameter on watch URLs or the last path segment of
  `youtube.com/shorts/<id>` and `youtu.be/<id>` links. If `maxresdefault.jpg`
  returns 404, use `sddefault.jpg`; `hqdefault.jpg` is 4:3 and gets visibly
  cropped on the 16:9 card. For X videos, copy the
  `https://pbs.twimg.com/amplify_video_thumb/...` image URL from the same
  devtools capture as the video file.
- `visual.videoLabel` is required whenever `links.video` is set. It is the
  watch-button text for featured builds and the accessible label on the
  card's play link, so it must name the platform the viewer lands on. The
  validator enforces the platform mention for YouTube, X, Vimeo, TikTok, and
  Loom links. For self-hosted files a plain `Watch the 1:50 demo` is correct.

To get the direct file URL from an X post: open the post in a browser, open
developer tools, filter network requests by `video.twimg.com`, play the video,
and copy the highest-resolution `.mp4` request URL.

## Visibility Control

- `hidden: true` keeps the package valid in this repo but prevents the EconomyOS
  docs sync from publishing the card. Remove it in a later PR when the showcase
  should go live.

## Optional Agent Context

- `soul.md` can be included when the builder intentionally wants to publish
  public agent context. Prefer committing the text as
  `showcase/<project-slug>/soul.md`; use a `soul/` folder only for multi-agent
  or multi-file context. Redact private instructions, credentials, account data,
  wallet material, and operational secrets before linking it from
  `showcase.json` as `soul.href` with a short `soul.summary`.

## Updating a Published Showcase

Editing a project that is already merged and published is the **same flow** as
adding one — there is no separate update path. The sync regenerates the whole
docs dataset from the source manifests, so your edit overwrites the old
published values automatically. Never hand-edit the generated file in the docs
repo.

1. Branch off `main`, edit the files under `showcase/<slug>/` in place
   (manifest, `README.md`, `soul.md`, skill, or `assets/`).
2. `node scripts/validate-showcase.mjs`.
3. Open a PR, merge, then confirm the sync ran (below).

**Do not change `slug`.** It is the card's identity key. Editing any other
field updates the existing card; changing the slug (and its folder) reads as a
brand-new project and orphans the old card. Rename only when you truly intend a
new entry.

## Confirming Your Card Went Live

Publishing is not automatic-and-silent — it depends on the sync workflow
actually running. After your PR merges to `main`:

1. In `acp-cli-demos` → **Actions**, confirm the **Dispatch Showcase Sync** run
   on your merge commit is green. A red run (usually a missing or expired
   `SHOWCASE_SYNC_TOKEN`) means the card will **not** appear.
2. The regenerated card data lands in `Virtual-Protocol/whitepaper-economyOS`.
   Check the Showcase page there once its docs build completes.

You cannot preview the rendered card before merge, so validate, confirm every
URL returns `200`, and double-check copy against
[Copy and Style Conventions](#copy-and-style-conventions) beforehand.

## Contributor Checklist

Before requesting review:

- [ ] Folder name equals `slug`, and `slug` is lowercase kebab-case and unique.
- [ ] All required [Field Reference](#field-reference) fields are present.
- [ ] `feedbackPrompts` has exactly three entries; `artifacts` has at least one.
- [ ] At least one inspectable proof artifact is included and redacted.
- [ ] Tagline/description follow [Copy and Style Conventions](#copy-and-style-conventions).
- [ ] Any `posterUrl` / `videoUrl` / image URL returns `200` (checked on your
      branch, since `main` raw URLs only resolve after merge).
- [ ] `node scripts/validate-showcase.mjs` passes.

```bash
# Expect HTTP 200 and content-type: video/...
# GitHub raw serves video files as application/octet-stream; in that case
# confirm playback by opening the URL in a browser instead.
curl -sI "<visual.videoUrl>"

# Expect HTTP 200 and content-type: image/...
# For a repo-committed poster, check the raw URL on your fork or branch;
# the main URL only resolves after merge.
curl -sI "<visual.posterUrl>"

node scripts/validate-showcase.mjs
```

## What Reviewers Check

- **Manifest** — passes the validator; slug/folder match; copy follows the
  conventions above.
- **Proof** — at least one artifact is inspectable and actually shows the
  workflow ran.
- **Redaction** — no credentials, private keys, wallet material, account data,
  or private instructions in the package, `soul.md`, or proof docs.
- **Skill quality** — any committed `SKILL.md` is clear, scoped, and reusable.
- **Media** — video/image URLs resolve and follow the field rules.

## Maintainers

The manifest schema is enforced by
[`scripts/validate-showcase.mjs`](../scripts/validate-showcase.mjs), and the
publish is driven by
[`.github/workflows/dispatch-showcase-sync.yml`](../.github/workflows/dispatch-showcase-sync.yml)
(which dispatches to `sync-showcase-projects.mjs` in
`Virtual-Protocol/whitepaper-economyOS`).

**If you change any of these, update this doc in the same PR so it stays the
source of truth:**

- Add/remove/rename a manifest field or change a validation rule in
  `validate-showcase.mjs` → update the [Field Reference](#field-reference) table
  and any affected section.
- Change the set of allowed `primitives`, `topic` values, or accepted video
  hosts → update the relevant rows/notes.
- Change how the sync is triggered or which repo/token it uses → update
  [End-To-End Flow](#end-to-end-flow) and
  [Confirming Your Card Went Live](#confirming-your-card-went-live).
- Change how the docs site renders the card (hero image, video, aspect ratio)
  → update [Card Image](#card-image) and [Video Fields](#video-fields).
