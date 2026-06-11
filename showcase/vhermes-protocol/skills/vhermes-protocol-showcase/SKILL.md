# VHermes Protocol Showcase

Reusable workflow for packaging a Telegram-native ACP agent wrapper as an EconomyOS Showcase contribution.

## When To Use

Use this workflow when you want to publish a `showcase/<project-slug>/` package for a VHermes-style Telegram bot surface around a Virtuals ACP agent.

## Inputs

- Public bot URL
- Agent name and runtime
- Supported command list
- Proof link to a chat session, bot profile, or public release
- Redacted soul notes for agent context

## Steps

1. Create `showcase/<project-slug>/showcase.json` with required fields and three feedback prompts.
2. Add `agent.yaml` describing the bot and user-facing command surface.
3. Add `README.md` with purpose, commands, and package contents.
4. Add redacted `soul.md` describing chat design and boundaries.
5. Set `skills[].sourcePath` if a project-specific skill is committed under `showcase/<project-slug>/skills/<skill-name>/`.
6. Validate manifests with `node scripts/validate-showcase.mjs`.
7. Open a PR against `Virtual-Protocol/acp-cli-demos`.

## Approval Gates

- Do not publish raw bot tokens or backend secrets.
- Confirm any public proof links remain accessible and do not leak private account details.

## Stop Conditions

- Stop the PR if the manifest links artifacts that are not yet public.
- Stop if the show-cased interface claims capabilities not present in the public runtime.

## Output Contract

The PR should add one `showcase/<project-slug>/` folder plus optional project-specific skills. Root `README.md` updates are optional.
