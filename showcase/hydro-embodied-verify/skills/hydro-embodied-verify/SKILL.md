---
name: hydro-embodied-verify
description: Score a first-person (egocentric) task video against its instructions with a vision model and return a bounded {approved, score, reason} verdict. Use to gate crowdsourced embodied-data uploads or to evaluate an embodied-video deliverable.
---

# Hydro Embodied-Data Verifier

Judge whether a short first-person video genuinely performs a stated real-world
task (e.g. "pick up the cup, pour water, place it back"), and return a single
bounded verdict. This is the quality gate behind Hydro's embodied-data
marketplace, packaged so any agent can reuse it — including as the evaluator for
an embodied-video deliverable on the Agent Commerce Protocol (ACP).

## When to use this skill

- You need to decide if a demonstration clip actually completes the task it
  claims, before paying or crediting the contributor.
- You are named as the evaluator on an ACP job whose deliverable is a
  first-person task video, and you must accept or reject it.
- You want a consistent, spam-resistant quality score for embodied-video data.

## When NOT to use this skill

- The deliverable is not a task video (text, code, on-chain action) — use a
  matching evaluator instead.
- You need to custody funds or move tokens. This skill only produces a verdict;
  settlement is handled by the caller / ACP escrow.
- You need identity, personal data, or biometric analysis of the person in the
  clip. Out of scope and not permitted.

## Inputs

- `video_url` — a readable URL (or local path) to the clip to judge.
- `task_instructions` — the exact task the clip is supposed to perform.
- `threshold` (optional, default 55) — minimum 0-100 score required to approve.

## Tools, credentials, preconditions

- A vision-capable model API key (e.g. an OpenAI `gpt-4o-mini` vision key) set in
  the environment as `OPENAI_API_KEY`. No other credentials are required.
- Frame extraction: 3 evenly-spaced frames are sampled from the clip and passed
  to the model with the task instructions. No full-video upload is needed.
- The model is asked to return strict JSON: `{ "approved": bool, "score": int,
  "reason": string }`.

## Approval gates

- This skill performs **no spending, posting, account creation, deployment, or
  production mutation**. It only reads a video and returns a verdict.
- If used inside an ACP job to release or refund escrow, the escrow action is a
  separate step owned by the caller and requires explicit authorization of the
  job id and settlement rail before it runs.

## Stop conditions and handoff

- Stop and return `needs_review` if frames cannot be extracted, the model output
  is not valid JSON, or the model expresses low confidence. Do not fabricate a
  pass.
- If the task instructions are missing or empty, stop and ask for them rather
  than guessing.

## Procedure

1. Extract 3 representative frames from `video_url`.
2. Prompt the vision model with the frames + `task_instructions`, asking it to
   judge task completion and quality against the rubric in `soul.md`.
3. Parse the strict-JSON response into `{approved, score, reason}`.
4. Apply the decision rule below.

## Validation checks

- Response must parse as JSON with `approved` (bool), `score` (int 0-100), and a
  non-empty `reason` string; otherwise → `needs_review`.
- `score` is clamped to 0-100.
- `approved` is only honored when `score >= threshold`; a high-score reject or a
  low-score approve is downgraded to `needs_review`.

## Output contract

Return exactly:

```json
{
  "approved": true,
  "score": 82,
  "reason": "Hands pick up the cup, pour water, and set it back; stable framing, clear lighting.",
  "verdict": "approved"
}
```

- `verdict` is one of `approved` | `rejected` | `needs_review`.
- On any failure to judge confidently, return `verdict: "needs_review"` with
  `approved: false` and a reason explaining what was missing.
- Never include API keys, wallet material, or raw contributor identity in the
  output.
