---
name: openroboarena-motion-control
description: Run or verify a bounded OpenRoboArena browser Motion Control Lab command and return the selected local animation without controlling hardware, code, wallets, or payments.
version: 1.0.0
---

# OpenRoboArena Motion Control Lab

Use the public OpenRoboArena Motion Control Lab to demonstrate a small,
browser-rendered robot movement or to verify that its command boundary remains
safe. This skill maps language to **local FBX animation playback only**; it is
not a physical-robot control interface.

## When to use this skill

- A user wants to see one of the supported MX-01 motions in the public Motion
  Control Lab.
- A reviewer needs a repeatable check that a movement command resolves to a
  bounded local animation.
- A caller wants to document the distinction between deterministic local
  commands and the optional EconomyOS Compute classification path.

## When NOT to use this skill

- To control a physical robot, drone, actuator, or any real-world device.
- To run, inspect, alter, or sandbox a submitted GitHub repository.
- To request wallet credentials, send a transaction, or make a payment.
- To interpret arbitrary commands as an authorization to perform an external
  action. The only permitted result is a local animation label.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `command` | yes | A supported movement phrase, or a short natural-language movement request. |
| `lab_url` | no | Defaults to `https://www.openroboarena.xyz/motion-control.html`. |
| `allow_compute_classification` | no | Defaults to `false`. When `true`, the caller explicitly permits the live lab to use its server-side Compute classifier for unsupported phrasing. |

Supported local mappings:

| User wording | Local result |
| --- | --- |
| `punch`, `jab`, `strike` | `punch` |
| `cross punch` | `cross` |
| `punch combo`, `combo` | `combo` |
| `kick` | `kick` |
| `roundhouse kick`, `spin kick` | `roundhouse` |
| `reset`, `center`, `idle` | `reset` |

## Tools, credentials, and preconditions

- A browser capable of opening the public lab URL and observing the visible
  command result.
- Wait until the page shows `SYSTEM READY` and the MX-01 assets finish loading.
- No wallet, email, GitHub credential, or API key is accepted or needed by this
  skill.
- The optional Compute path is configured server-side by OpenRoboArena. Its
  `VIRTUALS_API_KEY` remains in Vercel Production only and must never be
  requested, displayed, logged, or committed.
- The public agent has EconomyOS wallet and email primitives provisioned, but
  this Motion Lab workflow does **not** invoke either primitive.

## Approval gates

- Supported local commands only play a browser animation and require no spend
  or transaction approval.
- This skill must not spend funds, post content, create accounts, deploy code,
  mutate production configuration, submit repositories, or initiate a wallet
  action.
- Keep `allow_compute_classification` false unless the caller explicitly
  approves it. The server-side classifier can consume the project's Compute
  allocation; it still returns only a bounded animation label.
- Any request that would cross one of the prohibited boundaries is out of scope
  and must be handed back to the caller for separate, explicit authorization.

## Procedure

1. Open `lab_url` and confirm `SYSTEM READY` is visible.
2. Normalize `command` against the supported local table.
3. If a local mapping exists, submit it and observe the selected movement in
   the command terminal.
4. If no local mapping exists and `allow_compute_classification` is `false`, do
   not submit it to Compute. Return `needs_approval` with the supported list.
5. If the caller approved classification, submit the short movement request in
   the live lab. Accept only an allowlisted result: `punch`, `cross`, `combo`,
   `kick`, `roundhouse`, `reset`, or `unknown`.
6. Report the visible selected label and whether it was local or
   EconomyOS-classified. Never claim physical execution.

## Stop conditions and handoff

- Stop with `needs_review` if `SYSTEM READY` does not appear, assets fail to
  load, or the visible command result is missing.
- Stop with `needs_approval` when an unsupported request would need Compute and
  `allow_compute_classification` is not explicitly true.
- Stop with `out_of_scope` for physical control, source-code execution,
  credentials, spending, posting, deployment, or production mutations.
- Handoff infrastructure failures to the OpenRoboArena maintainer with the lab
  URL, requested command, timestamp, and redacted visible error only.

## Validation checks

- [ ] The public lab loaded and `SYSTEM READY` was visible.
- [ ] The requested output is one of the seven allowlisted labels.
- [ ] The command terminal visibly reports the selected local movement or
      `unknown`.
- [ ] No API key, wallet material, account data, repository content, or private
      prompt appears in the result.
- [ ] The result is described as browser animation playback, not physical robot
      control.

## Output contract

Return only this redacted shape:

```json
{
  "status": "completed",
  "requested_command": "roundhouse kick",
  "selected_motion": "roundhouse",
  "execution_mode": "local",
  "lab_url": "https://www.openroboarena.xyz/motion-control.html",
  "evidence": "Visible terminal result: ROUNDHOUSE KICK",
  "safety_boundary": "Local browser FBX animation only; no hardware, repository code, wallet, or payment action."
}
```

`status` is one of `completed`, `needs_approval`, `needs_review`, or
`out_of_scope`. On a non-completed result, set `selected_motion` to `null` and
state the redacted reason in `evidence`.

## Public examples

- [Supported-command prompt](../../examples/prompt.md)
- [Redacted result](../../examples/result-redacted.md)
