# TripCanvas review-flow proof

## What this proof is

This note documents the public proof included with the TripCanvas showcase package. It is intentionally redacted and limited to what the screenshots show.

## Demo setup

- Destination: Tokyo, Japan
- Dates: `2026-06-10` to `2026-06-13`
- Input style: saved travel Reels plus trip preferences
- Visible preference context: ramen, onsen, walkable neighborhoods, good hotel value

## What the screenshots prove

- `assets/input-flow.png` shows the intake step:
  - Reel URL input,
  - dates,
  - budget,
  - origin city,
  - travel preferences,
  - and a generate-trip action.

- `assets/review-flow.png` shows the review step:
  - the left rail shows a proposed hotel base in `Shiodome / Shimbashi`,
  - the extracted-places panel lists concrete places the system pulled into the plan, including `Tokyo Dream Park`, `Grand Hyatt Tokyo`, `Harry Potter Cafe`, `Sando Lab Tokyo`, and `Popo`,
  - the center map view focuses the currently selected place and keeps the route context visible,
  - the right rail exposes the agent decision instead of hiding it:
    - `Places: 8`
    - `Source: Cache`
    - `Dates: 06-10-06-13`
    - `Budget: Mid Range`
    - a short decision statement,
    - a visible evidence quote,
    - a next-action approval boundary before the booking-style step.

- `assets/payment-complete.png` shows the post-approval state:
  - the same mapped trip context remains visible,
  - the right rail switches into a payment-complete panel,
  - the x402/payment state is explicitly marked as simulated,
  - and the receipt-style fields are presented as prototype output rather than hidden side effects.

## Redaction and scope

- This package does not publish the underlying private source code.
- This package does not claim a live production booking or payment integration.
- The screenshot is used as product-flow proof for the prototype's review and approval experience.
