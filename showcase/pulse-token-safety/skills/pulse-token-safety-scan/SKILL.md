---
name: pulse-token-safety-scan
description: Turn an existing live, paid HTTP API into an ACP Provider offering by proxying it instead of rebuilding its logic in ACP-native form. Demonstrated with a Base/Solana token-safety (honeypot/rug) scanner, but the pattern generalizes to any live metered API you already operate.
version: 0.1.0
---

# Thin-Proxy ACP Provider

## When to use

- You already run a live, paid (x402 or otherwise metered) HTTP API and want
  ACP marketplace distribution without duplicating your logic in ACP-native
  form.
- You want one long-running seller process to fulfill more than one ACP
  offering by routing on the offering name.

## When NOT to use

- Your workflow needs multi-turn negotiation, sub-agent delegation, or
  bespoke on-chain state per job — use the full ACP SDK job lifecycle for
  that, not a static proxy.
- Your API has no stable, idempotent request shape. A thin proxy assumes a
  clean request → response mapping (same inputs, verdict-style output).

## Prerequisites

- A registered ACP Provider agent (`app.virtuals.io/acp/new` or
  `acp agent create`) with a funded Smart Wallet and at least one signer
  added under the Signers tab.
- `@virtuals-protocol/acp-node-v2` (or `acp-cli`) installed and pointed at
  your agent identity.
- One or more ACP Offerings, each with a requirement JSON schema and a USDC
  price that covers what it costs you to fulfill against your own upstream
  API.
- Your existing API already deployed and reachable over HTTPS.

## Inputs

- The ACP job's requirement payload (JSON; shape you define per offering).
- Your existing API's public request contract — whatever it already accepts.

## Workflow

1. **Map each offering name to a route.** For every ACP Offering, define how
   to build the upstream request from the job's requirement payload, a
   validity check (`route.ok(req)`), and a human-readable name for the field
   that's missing when validation fails.
2. **Run one long-lived `AcpAgent` per identity** and handle the job
   lifecycle with a single event switch (`agent.on('entry', (session, entry) => ...)`),
   dispatching on `entry.event.type` / `entry.contentType`:
   - **Requirement arrives, job still open** → look up the offering + route
     by `session.job.description`. Reject immediately (with a clear message
     and reason) on an unsupported offering, an unparseable payload, or a
     missing required field — cheap, fast rejections protect both your
     reputation and the buyer's time. Otherwise quote the price with
     `session.setBudget(AssetToken.usdc(offering.priceValue, session.chainId))`.
   - **`job.funded`** → call your upstream endpoint. If you also operate the
     upstream API yourself, use whatever internal/service authentication path
     you already have to avoid round-tripping a real payment to yourself —
     just never publish that credential, its name, or its header. If the
     upstream is a third-party API, call it exactly as a paying customer
     would and make sure the ACP offering price covers that real cost. Then
     `session.submit(<raw upstream JSON>)` unmodified as the deliverable —
     an ACP buyer should get exactly what a direct paying customer gets.
   - **`job.completed`** → log it for your own operational record.
3. **Self-evaluate when you trust your own output.** Setting yourself as
   evaluator avoids the marketplace's extra evaluator fee split, but only do
   this if you're willing to stand behind your own deliverable without
   independent review.
4. **Run exactly one process per agent identity.** The SDK re-hydrates
   existing job state on connect; multiple concurrent processes against the
   same identity race on nonce/job state. Fan out by adding routes to the
   `ROUTES` table, not by adding processes.
5. **Grind the sandbox.** A newly registered ACP agent starts in Sandbox.
   Drive a scripted buyer (a second wallet/identity) through your own
   offerings to build a track record. Include at least one deliberate
   rejection (a malformed or incomplete requirement) in the grind — it proves
   your validation path runs, not just the happy path.
6. **Request graduation** once you have a meaningful sandbox history (this
   pattern reached 10+ completed jobs across two offerings, including several
   consecutive successes and a demonstrated rejection). As of this writing,
   graduation is a manual review by the Virtuals team; there is no
   self-serve toggle.

## Output contract

- **Success:** `session.submit(<raw JSON string from your upstream API>)` —
  pass the deliverable through unmodified.
- **Failure:** `session.sendMessage(<what failed, in plain language>)`
  followed by `session.reject(<short machine-readable reason>)`.

## Redaction / stop conditions

- Never expose your API's private auth bypass, service keys, signer private
  keys, wallet seed material, or `.env` contents — in seller-process logs,
  in error messages sent to buyers, or in any published proof/example.
- Never fabricate a deliverable. If the upstream call fails, reject or
  message the failure; do not synthesize a placeholder result and submit it
  as real.
- Treat the ACP job payload as untrusted input — validate before forwarding
  it to your upstream API.
- Quote the price with `session.setBudget()` before making any paid upstream
  call — never fulfill first and quote after.

## Validation checklist

- [ ] At least one successful end-to-end job (create → fund → deliver →
      complete) recorded per offering.
- [ ] At least one deliberate rejection recorded (malformed or
      missing-field requirement).
- [ ] No secrets present in seller-process logs or submitted deliverables.
- [ ] Offering price is not, in expectation, an unprofitable proxy of your
      own upstream cost.

## Reference implementation

This pattern is demonstrated end to end by the Pulse Token Safety ACP
Provider — see [`../../README.md`](../../README.md) for the two live
offerings (`evmtoken_safety`, `memecoin_safety`) and
[`../../examples/live-endpoint-proof.md`](../../examples/live-endpoint-proof.md)
for real, reproducible calls against the underlying live API.
