---
name: blueagent-b20-verify
description: Verify whether a token on Base is a genuine B20 (Beryl Native Token Standard) before trusting or trading it. Use whenever a token claims to be a B20, sits at a 0xB200… address, or appears in a B20 launch feed. Reads state directly from chain via the B20 Factory precompile and multicall — never guesses.
---

# B20 Verify — grounded, never guessed

## The trap

Real B20 tokens live at `0xB200…` addresses. That prefix is **CREATE2 vanity** — it is
cosmetic and it can be faked. Plain ERC-20 contracts already squat `0xB200…` addresses
and name themselves "B20." Holder counts, token names, and address prefixes are all
forgeable.

**The address proves nothing. Only `isB20()` on the Factory proves authenticity.**

Any tool that infers "this is a B20" from the address prefix, the token name, or a
language model's impression of the contract is guessing. Guesses get people rugged.

## Verify order (never skip step 1)

### 1. Ask the Factory

The B20 Factory is a protocol precompile at the same address on every Base network:

```
B20 Factory:         0xB20f000000000000000000000000000000000000
Activation Registry: 0x8453000000000000000000000000000000000001
Policy Registry:     0x8453000000000000000000000000000000000002
```

Call `isB20(address)` on the Factory.

- `false` → **stop.** It is not a B20, whatever it calls itself. Report that plainly.
- `true` → continue.

### 2. Multicall the token state

Only after `isB20()` returns true, batch-read the real state from chain:

- **variant** — ASSET (configurable decimals) or STABLECOIN (fixed decimals, currency code)
- **supply** and **supply cap** — note the no-cap sentinel is `type(uint128).max`,
  not `MaxUint256`
- **roles** — role-based access control holders (mint, pause, policy admin)
- **pause state** — per-feature, not a single global flag
- **policies** — per-scope transfer policies from the Policy Registry

### 3. Report what the chain said

Return the values as read. Do not smooth over gaps, do not infer missing fields, and
do not fabricate a verdict the reads do not support. If a call reverts or an RPC fails,
say so — an honest "unknown" beats a confident wrong answer.

## Activation gating

B20 deployment is gated on-chain by the Activation Registry. Do not hardcode activation
dates — read `isActivated()` from the registry. Before activation, a deploy reverts with
`FeatureNotActivated`. An RPC failure should degrade to `unknown`, never to `active`.

## Boundaries

- **Read-only.** This skill verifies; it does not sign, transfer, or deploy.
- **No fabrication.** Every field reported must come from an actual chain read.
- **No custody.** Nothing here holds user funds or keys.

## Why this pattern generalizes

Any chain-native token standard with a factory or registry can be verified this way:
ask the authority contract first, then read state, then report only what was read.
The failure mode to design against is always the same — a cosmetic signal (address,
name, holder count) that looks like proof but is trivially forgeable.
