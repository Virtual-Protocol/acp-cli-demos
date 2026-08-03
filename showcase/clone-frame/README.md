# CLONE FRAME HUB — Showcase Submission

**Repo:** https://github.com/devclone20/cloneframe_app_executable
**Site:** https://cloneframe.io
**Builder:** [devclone20](https://github.com/devclone20)

## What it is

A local-first desktop for working with AI agents. The whole app is one
`index.html` plus a local Node bridge daemon ("HUB Bridge") — download the
release zip, double-click, and your machine gets a visual cockpit: windows on a
canvas, real terminals, an in-app browser, a wallet, and a resident **pi**
coding agent that can drive all of it.

It is strictly **BYOK and model-agnostic**: there is no embedded assistant and
no vendor lock — users plug in their own API key or local models, and Virtuals
EconomyOS Compute (`https://compute.virtuals.io/v1`) works as a drop-in
provider. Whatever model is selected, the resident agent keeps its identity,
skills, and tools.

## Features

| Panel | What it does |
|-------|--------------|
| **CODE** | Chat + agent surface. The resident pi agent holds 16 app tools (open/read/close panels, app RPC, full in-app browser control) on top of any model the user picks |
| **iT** | Terminal multiplexer — real PTYs, splits, workspaces, persistent sessions; runs whole fleets of agents side by side |
| **BROWSER** | Ephemeral in-app browser (CDP engine) — private context in memory, wiped on close; the agent can navigate, read, click, and type in it |
| **MATRIX** | Distributed local-model cluster (MLX) — download, load, and chat with local LLMs; multi-node ready |
| **WALLET** | In-app wallet with iNFT support — agents fused with NFTs, where holding the token means holding the agent |
| **BRAIN** | The agent's mind — memories, skills, body docs, and a user-configurable identity |

## EconomyOS fit

- The bundled pi agent ships with a **Virtuals ACP CLI skill**
  ([`agent/.pi/skills/virtuals-cli/SKILL.md`](https://github.com/devclone20/cloneframe_app_executable/blob/main/agent/.pi/skills/virtuals-cli/SKILL.md)),
  so the resident agent can operate `acp-cli` workflows from inside the app.
- The bridge has dedicated ACP and Virtuals modules
  ([`bridge/acp.mjs`](https://github.com/devclone20/cloneframe_app_executable/blob/main/bridge/acp.mjs),
  [`bridge/virtuals.mjs`](https://github.com/devclone20/cloneframe_app_executable/blob/main/bridge/virtuals.mjs)).
- BYOK routing accepts Virtuals EconomyOS Compute as a provider, so the whole
  desktop can run on Virtuals-hosted models.

## Proof

- **Tour video (1:21):** https://raw.githubusercontent.com/devclone20/cloneframe_app_executable/main/docs/media/CLONE_FRAME_TOUR.mp4
- **Release (zip + bare HTML + SHA256SUMS):** https://github.com/devclone20/cloneframe_app_executable/releases/latest
- **Source:** https://github.com/devclone20/cloneframe_app_executable
- **Site:** https://cloneframe.io

## Run it

1. Download `CLONE-FRAME-HUB-<version>.zip` from the
   [latest release](https://github.com/devclone20/cloneframe_app_executable/releases/latest)
   and verify against `SHA256SUMS.txt`.
2. Unzip and double-click `install.command` (macOS). The bridge daemon starts
   locally and the app opens.
3. Add your own model key (or a Virtuals EconomyOS Compute key) in the model
   picker — the app never ships or stores vendor keys.

## Stack

- Single-file web shell (`index.html`) — no framework, hand-built panels
- Node bridge daemon, bound to `127.0.0.1` only, pairing-token gated
- [pi coding agent](https://github.com/earendil-works/pi-coding-agent) as the
  resident agent, extended with app-control tools
- MLX for local models (MATRIX cluster)

## Safety and redaction

- Local-first: the daemon binds `127.0.0.1` only; API keys live in
  `sessionStorage` (BYOK) and are never committed or logged.
- The tour video was redacted and audited frame-by-frame (all 4,866 frames)
  before publishing; no tokens, keys, or personal data appear.
