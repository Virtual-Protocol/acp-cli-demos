# Kairune — Verifiable Agent Trust Layer

The trust layer for AI agents that spend. Kairune computes a deterministic trust
score (0–1000) from an agent's behavior history and grants or revokes spending
permission by tier.

**Showcased upgrade — verifiable attestations:** issuers register Ed25519 keys
and sign each attestation; the server verifies every signature; the scoring
engine weights verified attestations fully and discounts unsigned ones (0.25×).
Backward compatible — existing unsigned submissions still work, recorded as
`unverified`.

**Since first submission — proven wallets and self-serve spend:**

- **Wallet proof (EIP-191).** An agent proves it controls the wallet it claims
  by signing a server-issued challenge with `personal_sign` (chain `4663`,
  domain-bound, 600s TTL). The private key never leaves the wallet, and proof
  status is a public read — a payer deciding whether to release funds needs to
  know whether the address it is about to pay was ever proven. Scope is
  deliberately narrow: this proves wallet control, not trustworthiness.
- **Self-serve permissions.** Granting a budget, spending, scoping payees,
  setting expiry and revoking no longer need a platform admin key. The trust
  tier is the access control: below EMERGING (score 250) a grant is refused
  with `409 tier_too_low`. An agent earns its budget rather than being handed
  one, and the API is usable by agents that are not us.
- **Owner lock on spend authority.** Self-serve cut the admin key out of the
  path, which also meant those routes accepted no credential at all — and a
  permission id is public. An operator can now bind an agent to its wallet with
  the same EIP-191 proof: once locked, every mutating permission route requires
  a fresh single-use proof in `X-Owner-Proof` and refuses with `401` without
  one. Reads and the spend dry-run stay open so a payment rail still gets a
  go/no-go signal. It is opt-in, so an agent that never locks is still open —
  making it mandatory would strand every agent registered before the feature.
- **A published SDK.** `@kairune/sdk@0.4.0` on npm, zero dependencies, native
  `fetch`. Pass a `signOwnerMessage` signer once and `lockAgent()`,
  `unlockAgent()` and `getOwnerLock()` are available; every mutating call that
  comes back `401` because the agent turned out to be locked is signed and
  retried exactly once. An unlocked agent pays nothing for this — no extra
  round trip is made unless the server actually refuses.
- **A film of the refusal.** The 0:13 demo walks the whole arc, including the
  part most demos leave out: the agent asks for a budget while UNRATED and is
  turned down. It earns attestations, crosses 250, asks again, and gets a
  ceiling it cannot exceed. No admin key appears anywhere in that path.

## Proof
- Self-serve film (0:13): https://kairune.online/assets/video/kairune-self-serve.mp4
- SDK on npm (`@kairune/sdk@0.4.0`): https://www.npmjs.com/package/@kairune/sdk
- Animated demo: `assets/kairune-verify-demo.mp4`
- Live console: https://kairune.online/app
- API meta (`wallet_proof: eip191-personal-sign`, `signature_algorithm: ed25519`): https://kairune.online/api/meta
- ERC-8126 derived adapter (explicitly not compliant, `compliant: false`, `agentId: null`, ETV/MCV/SCV/WAV not implemented, WV partial via EIP-191): https://kairune.online/api/agents/voyager-07/erc8126 — also at https://kairune.online/api/erc8126/agents/voyager-07
- Example trust card: https://kairune.online/a/voyager-07
- API docs: https://kairune.online/docs
- Source: https://github.com/kairunedev/Kairune
- Wallet proof + self-serve PR: https://github.com/kairunedev/Kairune/pull/7

## EconomyOS primitives
ACP job (4 paid offerings on Robinhood Chain via Virtuals), Agent Token
($KAIRUNE), and a smart-contract Agent Wallet for the seller bot.

Builder: Kairune · https://x.com/usekairune · Virtuals: https://app.virtuals.io/virtuals/100623
