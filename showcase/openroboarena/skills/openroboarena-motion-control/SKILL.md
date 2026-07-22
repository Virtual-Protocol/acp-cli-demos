---
name: openroboarena-motion-control
description: Use the public OpenRoboArena Motion Control Lab to run supported robot animation commands and verify its local-only safety boundaries.
version: 0.1.0
---

# OpenRoboArena Motion Control Lab

Use this skill to demonstrate the public OpenRoboArena Motion Control Lab.

## Open the lab

Open <https://www.openroboarena.xyz/motion-control.html> and wait for `SYSTEM
READY`.

## Supported commands

| User wording | Executed local motion |
| --- | --- |
| `punch`, `jab`, `strike` | Punch |
| `cross punch` | Cross punch |
| `punch combo`, `combo` | Punch combo |
| `kick` | Kick |
| `roundhouse kick`, `spin kick` | Roundhouse kick |
| `reset`, `center`, `idle` | Reset camera |

## Workflow

1. Ask for a supported motion or a natural-language movement request.
2. Submit it in the lab.
3. For non-exact phrasing, EconomyOS Compute can map the request to the safe
   local allowlist.
4. Confirm the selected local animation or list the supported motions.

## Safety boundaries

- The browser only plays local animation assets.
- Do not use this as physical robot control.
- Do not execute repository code or request wallet credentials.
- Do not initiate payments or transactions.
