# Kairune — Verifiable Agent Trust Layer

The trust layer for AI agents that spend. Kairune computes a deterministic trust
score (0–1000) from an agent's behavior history and grants or revokes spending
permission by tier.

**Showcased upgrade — verifiable attestations:** issuers register Ed25519 keys
and sign each attestation; the server verifies every signature; the scoring
engine weights verified attestations fully and discounts unsigned ones (0.25×).
Backward compatible — existing unsigned submissions still work, recorded as
`unverified`.

## Proof
- Animated demo: `assets/kairune-verify-demo.mp4`
- Live console: https://kairune.online/app
- API meta (shows `signature_algorithm: ed25519`): https://kairune.online/api/meta
- Example trust card: https://kairune.online/a/voyager-07
- Source: https://github.com/kairunedev/Kairune

## EconomyOS primitives
ACP job (4 paid offerings on Robinhood Chain via Virtuals), Agent Token
($KAIRUNE), and a smart-contract Agent Wallet for the seller bot.

Builder: Kairune · https://x.com/usekairune · Virtuals: https://app.virtuals.io/virtuals/100623
