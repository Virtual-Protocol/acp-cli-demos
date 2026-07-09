# TripCanvas Travel Planner

TripCanvas is a validated travel-planning prototype that turns saved travel Reels into a mapped trip plan.

TripCanvas was originally built for the SEA x OpenAI Hackathon in Singapore, where it placed 2nd. That result is useful context, but the showcase still needs to stand on the workflow proof itself, so this package keeps the claims focused on what the demo visibly does.

Astrail is the current private rebuild of the same core idea. Its public landing page is https://astrail.xyz/, but this showcase package stays anchored on the original TripCanvas demo and proof artifacts.

The demo flow is simple:

- start from saved Instagram travel Reels and trip constraints,
- extract concrete places from those inputs,
- recommend a hotel base and day-by-day route sequence,
- show the plan on a map with visible evidence and an agent decision rail,
- stop at an approval gate before any booking-style action.

This public package is intentionally narrow. It does not publish private source code, credentials, or a live checkout system. It shares three redacted screenshots, one proof note, and one reusable skill that captures the workflow at a level another builder can understand and adapt.

## Why it belongs in the Showcase

TripCanvas is useful as a review-first agent demo. Instead of hiding the planning step behind a single output, it exposes the extracted places, the chosen base, the reasoning panel, and the approval boundary in one screen. That makes it easier to inspect what the agent is doing before any downstream action is taken.

## Demo Video

- YouTube demo video: https://www.youtube.com/watch?v=EoAxPk6OCdo

## Proof

- Input-flow screenshot: [`assets/input-flow.png`](assets/input-flow.png)
- Review-flow screenshot: [`assets/review-flow.png`](assets/review-flow.png)
- Payment-complete screenshot: [`assets/payment-complete.png`](assets/payment-complete.png)
- Redacted result report: [`examples/result-redacted.md`](examples/result-redacted.md)
- Reusable skill: [`skills/tripcanvas-travel-planner/SKILL.md`](skills/tripcanvas-travel-planner/SKILL.md)

## Reusable skill

The committed skill focuses on the repeatable part of the prototype:

- collect travel inspiration,
- extract candidate places,
- organize them into a map-first day plan,
- surface evidence and tradeoffs,
- require explicit approval before any booking-style step.

## Primitive

This package is submitted as an `acp`-style workflow demo because the public proof centers on agent approval boundaries rather than a hidden autonomous action.

## Links

- Builder X: https://x.com/haotobuildzip
- Demo video: https://www.youtube.com/watch?v=EoAxPk6OCdo
- Astrail public landing page: https://astrail.xyz/
