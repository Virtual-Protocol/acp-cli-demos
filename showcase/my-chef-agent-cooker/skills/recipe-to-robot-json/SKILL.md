# recipe-to-robot-json

Convert a professional culinary recipe into machine-executable JSON profiles
for culinary robot families: multi-step cookers (Posha-class), grill/plancha
robots (Aniai-class), and assembly/dispensing robots (XRobotics-class).

Built and validated by a working chef against a database of 215 professional
French haute cuisine recipes (Michelin-starred and palace hotel kitchens),
running on Venice-powered inference funded by EconomyOS compute credits.

> **Trademark notice.** Not affiliated with or endorsed by Posha, Aniai, or
> XRobotics. Trademarks belong to their respective owners. "Posha-class",
> "Aniai-class" and "XRobotics-class" describe machine categories
> (multi-step cooker, grill robot, dispensing robot). Output formats are
> independent drafts (`cooker.recipe.v1-draft`, `grill.recipe.v1-draft`,
> `dispenser.recipe.v1-draft`) designed to be mapped onto official vendor
> specs.

## When to use

- You have a recipe (free text or structured JSON) and need a machine-readable
  execution profile: ordered steps with temperatures (°C), durations (min),
  and normalized machine actions.
- You are prototyping recipe ingestion for a culinary robot, kitchen
  automation pipeline, or professional recipe management system.
- You need the same recipe emitted for several robot targets at once.

## When NOT to use

- The robot vendor has published an official recipe schema — use their spec
  directly; this skill emits a structured *draft* format (`*.recipe.v1-draft`)
  designed to be mapped onto vendor specs, not to replace them.
- The recipe lacks quantified steps (no temperatures, no times, vague
  instructions). Garbage in, garbage out — fix the recipe first.
- You need food-safety certification. Output profiles are execution drafts;
  a professional must validate pasteurization/holding parameters before any
  real production run.

## Required inputs, tools, preconditions

- Input recipe: either structured JSON (`{title, ingredients[{name,unit,qty}],
  procedure}`) or plain text with numbered steps.
- Python 3.9+ for the reference converter (`references/convert_robots.py`
  pattern), or an LLM agent following the workflow below.
- If using an agent: an OpenAI-compatible inference endpoint (the reference
  build uses EconomyOS compute, `https://compute.virtuals.io/v1`).
- No credentials required. No network calls beyond inference.

## Step-by-step workflow

1. **Normalize the recipe.** Parse ingredients into `{name, unit, qty}` with
   snake_case names and metric units (grams preferred; professional recipes
   are weight-based).
2. **Segment the procedure into steps.** Split on numbered lines; if a single
   block, split on sentence boundaries. Each step keeps its original
   instruction text (traceability — the chef's wording is the ground truth).
3. **Extract machine parameters per step.**
   - Temperatures: regex `(-?\d+(?:[.,]\d+)?)\s*°\s*C` → `temperatures_c[]`
   - Durations: value + unit (h/min/s) normalized to minutes → `durations_min[]`
4. **Map actions.** Keyword-match each step onto a normalized action set:
   `whisk, mix, heat, infuse, strain, cool, freeze, rest, shape`. A step can
   carry several actions. Keep FR and EN keyword lists.
5. **Emit per-target profiles.**
   - Cooker target (Posha-class): add `heating_profile {target_c, hold_min}`
     and `pod_dispense` flags per step.
   - Grill target (Aniai-class): surface temperature and contact-time fields.
   - Dispensing target (XRobotics-class): ingredient dosing sequence keyed to
     `ingredients[]` quantities.
6. **Write one JSON file per recipe per target** plus an `index.json`
   manifest. Tag every file with the draft format version
   (e.g. `"format": "cooker.recipe.v1-draft"`).

## Approval gates

- Before emitting output for a *new robot target*, confirm the field mapping
  with a human (vendor logic differs: a grill has no churning action).
- Before publishing any converted recipe, confirm the recipe owner consents —
  professional recipes are intellectual property.

## Stop conditions

- A step yields zero extracted parameters AND zero matched actions → flag the
  step `"needs_review": true` and stop batch processing if more than 20% of
  steps are flagged.
- Contradictory parameters (e.g. freeze action with +85°C target) → stop and
  report; never guess thermal parameters.

## Evidence and redaction rules

- Publish only recipes you own or have explicit rights to.
- Redact supplier names, cost data, and client information if present in chef
  notes.
- Include original-language instruction text in outputs for traceability; do
  not paraphrase away professional nuance.

## Validation checklist

- [ ] Every step has `instruction`, `actions[]`, `temperatures_c[]`, `durations_min[]`
- [ ] All durations normalized to minutes; all temperatures in °C
- [ ] Actions only from the normalized vocabulary
- [ ] Format version tag present in every output file
- [ ] `index.json` lists every emitted recipe
- [ ] Flagged (`needs_review`) steps < 20% of total
- [ ] A domain professional has sanity-checked one sample per category

## Output contract

For each input recipe and each target, one JSON object:

```json
{
  "recipe_id": "CG-005",
  "title": {"fr": "...", "en": "..."},
  "category": "...",
  "domain": "...",
  "ingredients": [{"name": "lait_entier", "unit": "g", "qty": 620}],
  "steps": [
    {
      "step": 1,
      "instruction_fr": "...",
      "actions": ["infuse"],
      "temperatures_c": [60.0],
      "durations_min": [15.0],
      "heating_profile": {"target_c": 60.0, "hold_min": 15.0}
    }
  ],
  "procedure_en": "...",
  "chef_notes": "...",
  "format": "cooker.recipe.v1-draft"
}
```

Validated at scale: 215 recipes × 3 targets = 645 output files generated from
a single unified database in one run.
