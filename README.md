# ACP CLI Demos

This repo collects reusable agent skills and utilities that show how agents can use [`acp-cli`](https://github.com/Virtual-Protocol/acp-cli) for real-world commerce workflows.

The repo is organized around Showcase project packages and shared skill folders. A Showcase contribution should live under `showcase/<project-slug>/` with its `showcase.json`, proof links, and project-specific skills. Shared runtime skills that are reused across projects still live under `skills/<skill-name>/`.

The first skill demonstrates an ACP agent subscribing to a paid Substack using:

- ACP Agent Email for signup, receipts, OTPs, and account verification
- ACP Agent Card for bounded, single-use checkout payments
- `acp-cli` for identity, email, card issuance, payment status, 3DS, and receipt checks
- Browser automation for the merchant checkout page

## Skills

Shared skill sources:

- [`skills/acp-builder-setup`](skills/acp-builder-setup) - setup and model-routing guidance for Codex, Claude Code, and Claude Desktop.
- [`skills/acp-paid-subscription-checkout`](skills/acp-paid-subscription-checkout) - paid checkout execution, desktop-safe handoff, and redacted evidence review.

Contribution layout guidance: [`skills/README.md`](skills/README.md)

## Showcase Publishing

Project submissions use the default PR template in this repo. Add the demo
package, proof, reusable skill, and card-ready manifest under
[`showcase/<project-slug>`](showcase).

After a Showcase PR is approved and merged to `main`, changes under
`showcase/**` dispatch the EconomyOS docs sync. The docs workflow
regenerates the Showcase page data from the accepted manifest.

Automation requirement: configure `SHOWCASE_SYNC_TOKEN` in this repo with
permission to dispatch workflows in `Virtual-Protocol/whitepaper-economyOS`.

Validate manifests before requesting review:

```bash
node scripts/validate-showcase.mjs
```

### Paid Substack Subscription Example

Path: [`skills/acp-paid-subscription-checkout/examples/substack`](skills/acp-paid-subscription-checkout/examples/substack)

This example validates that an ACP agent can complete a paid newsletter checkout end-to-end, then verify the captured charge, receipt, and paid content access.

## Utilities

Agent setup guide: [`docs/agent-setup.md`](docs/agent-setup.md)

Model selection and configuration: [`docs/model-config.md`](docs/model-config.md)

GitHub skill references: [`docs/skill-packages.md`](docs/skill-packages.md)

Packaged skills: [`packages/`](packages)

Utility layout guidance: [`utilities/README.md`](utilities/README.md)

### Codex Virtuals Proxy

Path: [`utilities/model-routing/codex-virtuals-proxy`](utilities/model-routing/codex-virtuals-proxy)

This local helper lets Codex use Virtuals-hosted models by translating Codex Responses API calls to the Virtuals Chat Completions endpoint.

Use `scripts/configure-codex-virtuals.mjs virtuals` from the repo root to activate the Codex provider block, `scripts/configure-codex-virtuals.mjs restore` to switch back to the previous Codex model/provider, or `scripts/configure-codex-virtuals.mjs default` to switch back to built-in Codex routing when no restore state exists.

### Claude Virtuals Router

Path: [`utilities/model-routing/claude-virtuals-router`](utilities/model-routing/claude-virtuals-router)

This setup example lets Claude Code use Virtuals-hosted models through `claude-code-router`.

Use `scripts/configure-claude-virtuals.mjs virtuals` from the repo root to activate the Claude Code Router provider, `scripts/configure-claude-virtuals.mjs restore` to switch back to the previous router provider/routes, or `scripts/configure-claude-virtuals.mjs default` to remove the Virtuals routes when no restore state exists. Restart `claude-code-router` after changing the config.

## Use The Skill

### ACP Paid Subscription Checkout

Path: [`skills/acp-paid-subscription-checkout`](skills/acp-paid-subscription-checkout)

This is the reusable skill behind the Substack demo. It is intentionally broader than Substack: it describes a bounded paid subscription checkout workflow using ACP identity, email, and card primitives.

The skill chooses live execution, handoff, or evidence-review mode based on the environment. The recommended flow is to install the skill, then give the agent only the merchant-specific details: target subscription, plan, billing cadence, spend cap, and verification requirement. You should not need to paste the full long-form prompt for each run.

Install for Codex:

```bash
mkdir -p ~/.agents/skills
cp -R skills/acp-paid-subscription-checkout ~/.agents/skills/
```

Install for Claude Code:

```bash
mkdir -p ~/.claude/skills
cp -R skills/acp-paid-subscription-checkout ~/.claude/skills/
```

For all local-execution skills, use the installer helper:

```bash
scripts/install-local-skills.sh --mode symlink --target both
```

Invoke in Codex:

```text
Use $acp-paid-subscription-checkout to complete a bounded paid subscription checkout for my ACP agent and verify access.
```

Invoke in Claude Code:

```text
/acp-paid-subscription-checkout Subscribe my ACP agent email to the requested paid plan and verify access.
```

Other agents can read the same `SKILL.md` and `references/` files directly, or use the demo prompt as a raw fallback.

For Claude Desktop or chat-only surfaces, upload the Claude Desktop ZIP package and use the same skill to prepare a safe handoff prompt or review redacted evidence. The skill must not issue cards, retrieve OTPs, or click paid checkout buttons unless local tools are available.

## Safety Model

These demos can involve live payments. A checkout agent should only issue cards and click final paid checkout buttons when the user has explicitly authorized:

- merchant
- plan
- billing cadence
- maximum amount
- ACP agent email
- ACP agent card payment method

The agent must stop before paying if checkout details differ from the authorization.

Final outputs must redact full card numbers, CVVs, magic links, OTPs, and other sensitive payment details.

## Related

- [`acp-cli`](https://github.com/Virtual-Protocol/acp-cli)
- [`acp-node-v2`](https://github.com/Virtual-Protocol/acp-node-v2)
