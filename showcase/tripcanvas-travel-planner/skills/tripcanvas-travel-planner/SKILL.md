---
name: tripcanvas-travel-planner
description: Turn saved travel inspiration into a reviewable trip plan with extracted places, map-first sequencing, visible evidence, and an approval gate before any booking-style action.
version: 1.0.0
author: BrownBOBAsushi
license: MIT
---

# TripCanvas Travel Planner

Use this skill when the goal is to turn a small set of travel inspiration links into a reviewable trip-planning prototype, not an opaque one-shot answer.

## When To Use

- You have saved travel links, posts, or notes and want a structured trip-planning workflow.
- You want the output to expose extracted places, route choices, and evidence.
- You want a visible approval gate before any booking-style action.
- You are building or reviewing a demo, prototype, or internal planning tool.

## When Not To Use

- Do not use this skill to claim live booking, payment, or settlement if the system only shows a prototype rail.
- Do not hide the extracted places or tradeoffs when the user needs to inspect them.
- Do not fabricate places, evidence quotes, or route logic.
- Do not expose private prompts, credentials, account records, or unpublished source code in public proof.

## Required Inputs

- A bounded set of travel inspiration inputs, such as saved Reel URLs or short travel notes.
- Trip dates or a rough duration.
- Budget and origin when available.
- Preference hints when available.
- A proof target: screenshot, redacted report, or demo video.

## Workflow

1. Collect the travel inspiration inputs.
2. Extract candidate places from those inputs.
3. Filter to the places that are useful enough to keep in the plan.
4. Recommend a practical hotel base or anchor area.
5. Sequence the kept places into a day-by-day map-first route.
6. Surface a short decision summary for the currently selected place or action.
7. Show at least one visible evidence snippet or rationale.
8. Stop at an explicit approval gate before any booking-style step.

## Approval Gate

Before a downstream action is presented as ready, the user should be able to inspect:

- the selected place,
- the plan context,
- the evidence,
- the tradeoff,
- and the next action.

If that inspection layer is missing, the workflow is incomplete.

## Stop Conditions

Stop and ask for review if:

- the extracted places are weak or obviously wrong,
- the hotel base conflicts with the visible route,
- the reasoning panel cannot point to evidence,
- or the UI implies a live booking step that the system cannot actually complete.

## Output Contract

Return:

- the extracted places kept in scope,
- the proposed base,
- the day-by-day route sequence,
- the visible evidence or rationale,
- and the explicit approval boundary before any booking-style action.
