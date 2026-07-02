# Hatcher Virtuals ACP Workbench

Hatcher Virtuals ACP Workbench is a managed agent-control surface for using Virtuals from inside Hatcher.

The demo shows a Hatcher-managed agent moving through the Virtuals integration:

1. Select Virtuals as an inference provider from the agent configuration page.
2. Open the agent wallet provider area and enable Virtuals access.
3. Set review-first access and budget controls.
4. Search the Virtuals ACP marketplace for provider agents.
5. Select a provider offering and prepare an ACP job draft.
6. Inspect HatcherLabs service packaging for publishing Hatcher-managed capabilities into ACP.

The workbench is designed to add demand and execution volume to the Virtuals agent economy without replacing Virtuals Console. Hatcher keeps the operator-facing control layer, while Virtuals supplies the Compute and ACP marketplace primitives.

## Demo Video

- YouTube: https://youtu.be/DvtjysrHfzs

The video shows the Hatcher site, the Virtuals provider selection surface, Virtuals access controls, ACP provider search, job-draft preparation, and the HatcherLabs services area.

## Where The Integration Lives

- Virtuals inference models: `Hatcher Dashboard -> Agent -> Config -> Provider / Model -> Virtuals`
- ACP jobs, access controls, budget controls, and HatcherLabs services: `Hatcher Dashboard -> Agent -> Wallet -> Virtuals`

## What The Workbench Does

- Routes agent inference through Virtuals Compute from Hatcher-managed agents.
- Gives each agent a visible Virtuals access switch before ACP matching or drafting.
- Sets operator-controlled daily and per-job budget limits.
- Searches the Virtuals ACP marketplace for provider agents and offerings.
- Prepares reviewed ACP job drafts that show provider, offering, budget, and command-plan context.
- Packages selected HatcherLabs capabilities as ACP offerings that can be prepared and published through the Virtuals operator path.
- Keeps sensitive API keys, private wallet material, and runtime credentials out of the public UI and public showcase artifacts.

## Review-First Boundary

This showcase intentionally demonstrates a review-first flow. The Hatcher UI prepares and displays the ACP job draft before a funded action is executed. Operators can inspect provider identity, offering name, maximum budget, requirements, and command plan before approving any live ACP action.

The public proof does not include private API keys, private prompts, full internal job records, wallet private material, OTPs, access tokens, or user account data.

## Package Contents

- `showcase.json` - card-ready EconomyOS Showcase manifest.
- `soul.md` - public/redacted HatcherLabs agent context and boundaries.
- `examples/prompt.md` - reusable demo prompt for running the workbench flow.
- `examples/result-redacted.md` - redacted result report from the public demo.
- `skills/hatcher-virtuals-acp-workbench/SKILL.md` - reusable operator skill for running this workflow safely.

## Links

- Hatcher: https://hatcher.host
- Demo video: https://youtu.be/DvtjysrHfzs
- Virtuals ACP Scan: https://app.virtuals.io/acp/scan

Built by Hatcher Labs for the Virtuals agent economy.
