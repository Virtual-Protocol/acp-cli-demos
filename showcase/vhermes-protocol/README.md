# VHermes Protocol

VHermes Protocol exposes a Virtuals-native agent through Telegram as a chat-native interface to the ACP agent economy. The project focuses on discoverability and low-friction interaction so users can find, fund, or run ACP workflows without leaving chat.

## What VHermes Is

VHermes Protocol is a Telegram bot built on `python-telegram-bot` with a chat-style agent loop. It bridges natural chat input to ACP primitives: listing agents, requesting funds, running tasks, checking status, and launching workflows. The intended user is non-technical and mobile-first.

## Commands

- `/start` — onboard to the chat interface
- `/help` — list available actions
- `/agents` — discover known ACP agents
- `/status` — check current project or agent status
- `/fund` — request funds for an eligible ACP agent
- `/run_task` — start a common agent workflow from chat
- `/workflow` — browse known workflows
- `/discover` — search available agents or services
- `/research` — request concise research related to active contexts

## Package Contents

- `showcase.json` — card-ready EconomyOS Showcase manifest
- `agent.yaml` — public VHermes deployment manifest
- `soul.md` — public/redacted agent context and boundaries
- `skills/vhermes-protocol-showcase/SKILL.md` — reusable packaging workflow

## Goals

- Put ACP agent discovery inside the world’s most used chat interface.
- Reduce the distance between a Telegram user and an on-chain agent.
- Keep sensitive operational material out of the public manifest and soul notes.
