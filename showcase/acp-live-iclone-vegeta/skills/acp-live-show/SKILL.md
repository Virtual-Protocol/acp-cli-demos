# SKILL — acp-live-show

Stage one real, gated ACP trade as a two-agent show with live ticker cards.
This skill packages the exact personas and stage prompt used in the ACP LIVE
video (job #70984 on Base).

## What is inside

```
agents/iclone.md    seller persona — brings the marketplace servers online,
                    delivers, reads its own log; never moves funds
agents/vegeta.md    buyer persona — preflight, the single gated trade,
                    on-chain verification; the GATE law lives here
prompts/acp-live.md the four-act stage prompt the dispatcher follows
host/demo-trade     host-side wrapper: check / run (detached) / status
```

## Requirements

- [pi](https://github.com/badlogic/pi-mono) with the
  [agentic-teams-pi](https://github.com/devclone20/agentic-teams-pi)
  agent-team extension (the show's cards are its filled neon cards + ticker).
- A remote host (yours) with the Virtuals ACP CLI configured for **two**
  agents — a provider with a published offering and a funded client — plus
  passwordless sudo for the wrapper. The personas reach it via the ssh alias
  `acp-host`; add it to your `~/.ssh/config`.
- The `host/demo-trade` wrapper installed on that host (adjust the two paths
  at the top: the trade core script and the log location). Its job: launch
  the trade **detached** in a transient systemd unit and answer instant
  `status` snapshots, so no agent ever blocks on a long ssh call.

## Install

```bash
cp -r agents/ ~/.pi/agent/agents/
cp -r prompts/ ~/.pi/agent/prompts/
# teams.yaml (global or workspace):
#   acp-live: [iclone, vegeta]
```

Then, inside a pi session: `/agents-team acp-live` and launch `/acp-live`.

## The law (do not remove it)

- The buyer runs the fund-moving command ONLY when its task text carries the
  exact token `OWNER-APPROVED`; the show's dispatcher supplies it. Ad-hoc
  dispatches without the token are refused.
- One trade per show. Fixed price. Never retry a trade that moved funds —
  the wrapper enforces this too (in-flight refusal, post-completion cooldown,
  hard block after a failure that happened after funding).
- Agents never print keys, tokens or host addresses; public wallet addresses
  and job ids are fine.
