# My Chef Agent Cooker — Recipe-to-Robot JSON Converter

Convert real haute cuisine recipes into machine-executable JSON for culinary robots.

Built by [Jean-Matthieu Frederic](https://github.com/jeanmatthieu58), a working chef with 20 years in Michelin-starred kitchens and Parisian palace hotels. The agent runs on an authentic professional database of 215 recipes (261 in the current deployment) — every temperature, gram, and technique comes from real service, not from generated text.

**Live agent:** https://venice.ai/c/my-chef-agent-cooker

## What this package contains

```
my-chef-agent-cooker/
├── showcase.json                      # Showcase manifest
├── README.md                          # This file
├── assets/
│   ├── demo.mp4                       # 1:03 demo video (Safari screen recording)
│   ├── poster.jpg                     # Video poster (16:9)
│   ├── screenshot-agent.jpg           # Proof — agent identity and question
│   ├── screenshot-recipe.jpg          # Proof — real palace recipe with anti-hallucination chef note
│   └── compute-dashboard.jpg          # Proof — active EconomyOS Spark inference credits grant
└── skills/
    └── recipe-to-robot-json/
        ├── SKILL.md                   # Reusable skill definition
        └── examples/
            └── earl-grey-ice-cream/
                ├── prompt.md          # The exact demo prompt
                ├── result-redacted.md # Redacted conversion report
                └── CG-005-cooker.json # Emitted machine-executable JSON
```

## The workflow

1. **Ask the chef.** A user (or another agent) sends a recipe request to the live Venice character — free text or structured JSON. The agent answers from its curated professional database and refuses to invent recipes it does not have (see the anti-hallucination chef note in `screenshot-recipe.jpg`).
2. **Extract machine parameters.** The `recipe-to-robot-json` skill segments the procedure into steps and extracts temperatures, durations, quantities, and normalized actions.
3. **Emit robot profiles.** The skill outputs target-specific JSON drafts for three culinary robot families — cooker, grill, and dispensing (`"format": "cooker.recipe.v1-draft"`). Validated at scale: 215 recipes × 3 targets = 645 files in one run.

## The proof package

- **Demo video** (`assets/demo.mp4`, 1:03): a guest user asks the live agent for the Earl Grey ice cream (CG-005); the agent returns the real palace recipe and offers the robot-JSON adaptation.
- **Screenshots** (`assets/screenshot-*.jpg`): agent identity + the returned recipe with its chef note.
- **Compute credits proof** (`assets/compute-dashboard.jpg`): the agent's EconomyOS compute dashboard showing the active Spark inference credits grant (Developers Inference Credits program, Tier 1, week 2 of 4, repository-linked) that provisions the agent's conversion workloads.
- **End-to-end example** (`skills/recipe-to-robot-json/examples/earl-grey-ice-cream/`): the exact prompt, the redacted result report, and the emitted JSON file.

## EconomyOS primitives used

- **Agent identity + email:** `my_chef_agent_cooker@agents.world` (registered on ACP/EconomyOS)
- **Spark inference credits:** fund the LLM conversion workloads (endpoint `compute.virtuals.io/v1`)

## Feedback

Open an issue: https://github.com/jeanmatthieu58/spin-brigade/issues

## Trademark notice

Not affiliated with or endorsed by Posha, Aniai, or XRobotics; trademarks belong to their respective owners. Output formats are independent drafts designed to be mapped onto official vendor specs.
