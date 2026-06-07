# Paid Substack Subscription Showcase Package

This folder is the public Showcase package for the Paid Substack Subscription
Agent.

- `showcase.json` contains the card metadata consumed by the EconomyOS docs
  sync workflow.
- The reusable skill for this example is shared at
  `skills/acp-paid-subscription-checkout`.
- The Substack proof package lives at
  `skills/acp-paid-subscription-checkout/examples/substack`.

New Showcase submissions can keep project-specific skills directly in the
package:

```text
showcase/<project-slug>/
  showcase.json
  skills/<skill-name>/
    SKILL.md
    examples/
```

Use top-level `skills/<skill-name>/` only when the skill should be reused across
multiple showcase projects or installed as a shared runtime package.
