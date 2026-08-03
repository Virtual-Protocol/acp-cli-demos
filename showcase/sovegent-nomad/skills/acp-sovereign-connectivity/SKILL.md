---
name: acp-sovereign-connectivity
description: Buy a scoped, time-boxed network passage on ACP so an agent can reach the web from a specific region, and get back a signed proof of egress. Discover the Sovegent Nomad provider, open a passage job for a target region, fund it in $NMD on Robinhood Chain, receive a passage endpoint plus a signed egress attestation, verify the exit region matches the request, and complete. Provider-agnostic: use the managed reference exit or bring your own WireGuard (Mullvad/Proton/self-hosted).
---

# ACP Sovereign Connectivity (Sovegent Nomad — Buyer)

## Overview

Use this skill when an agent needs to **reach a service from a specific region** and
wants **cryptographic proof** it actually egressed there. Agents run on datacenter IPs
that the modern web treats as bots — geo-blocks, CAPTCHAs, rate-limits. This skill buys
a **passage**: a scoped, time-boxed route to the region a job requires, settled in **$NMD**
on **Robinhood Chain**, delivered with a **signed egress attestation**.

Sovegent Nomad is a connectivity **broker**, not a VPN company. It orchestrates, meters,
leashes, and **proves** — it does not own the pipes. That is what makes it provider-agnostic:

- **Managed reference exit** — omit any BYO config and Nomad provisions a hosted exit.
- **Bring-your-own VPN** — pass your own WireGuard endpoint (Mullvad / Proton / self-hosted)
  and Nomad attests over *your* exit. Your keys, your VPN, your leash — Nomad's orchestration
  and proof. The signed attestation is the product; it is sellable even when you bring your own pipes.

## When To Use

- An agent must operate a region-locked service or account its owner legitimately holds,
  and needs to reach it from an owner-authorized execution environment in the region it expects.
- A workflow needs **verifiable proof of the network region the agent used** when it did the work, not
  just a best-effort VPN handoff.
- An EconomyOS-style agent already has a wallet/email/card and still needs a way to
  actually reach the internet a task requires — connectivity is the layer this adds.

## When Not To Use

- Do not use it to run a persistent VPN tunnel for a human. This is per-passage, per-job,
  agent-native connectivity metered on ACP.
- Do not use it for custody, signing, or trading. It only sells and proves connectivity.
- Do not use it against lawful sanctions or geographic restrictions. Nomad provisions
  owner-authorized passage for legitimate access — it is not a tool for defeating legal controls.

## Prerequisites

- Node 20+ and the package installed (`npm install` in this skill directory).
- A **registered ACP buyer agent** (wallet + Privy wallet id + signer key) — register at
  `app.virtuals.io/acp/new`. This must be a **different** agent from the provider.
- The buyer wallet funded on **Robinhood Chain testnet (chainId 46630)** with **$NMD** for the
  passage fee and a little native ETH for gas.
- The Sovegent Nomad provider reachable — either its wallet address (`NOMAD_PROVIDER_ADDRESS`)
  or discoverable by keyword in the ACP registry.

## Configure

Copy `.env.example` to `.env` (gitignored) and fill in **your own** testnet values. The
example ships placeholders only — never commit a real key. Buyer-side vars:

- `BUYER_WALLET_ADDRESS`, `BUYER_WALLET_ID`, `BUYER_SIGNER_PRIVATE_KEY` — your ACP buyer agent.
- `NOMAD_PROVIDER_ADDRESS` — the provider's wallet (or leave blank to discover by keyword).
- `NOMAD_DISCOVERY_KEYWORD` — registry search term (default `sovereign connectivity`).
- `TARGET_REGION` — where to egress from, e.g. `de`, `us-ca`, `us-ny`, `ch`, `sg`.
- `MAX_PASSAGE_NMD` — refuse to fund a quote above this many $NMD (buyer policy cap).
- `BYO_WIREGUARD_ENDPOINT` — optional; your own WireGuard exit to attest over. Never commit it.

Public chain values (`ACP_CHAIN_ID=46630`, `NMD_TOKEN_ADDRESS`) are already in `.env.example`.

## Run

```bash
npm install
npm run buyer        # runs src/client.ts
```

## The ACP flow (discover → open → fund → submit → complete)

1. **Discover** — `browseAgents("sovereign connectivity")`, or a direct
   `getAgentByWalletAddress(NOMAD_PROVIDER_ADDRESS)` lookup. Both return the same agent shape.
2. **Open** — `createJobFromOffering()` with the requirement `{ region, byoWireguardEndpoint? }`.
   Omitting `byoWireguardEndpoint` selects the managed exit; passing it selects your BYO exit.
   `evaluatorAddress` is set to the buyer so the buyer verifies its own egress proof.
3. **Fund** — on `budget.set` the provider proposes the passage fee in **$NMD**. The client
   checks it against `MAX_PASSAGE_NMD`, then `session.fetchJob()` + `session.fund()` escrows $NMD.
4. **Submit** — on `job.submitted` the deliverable is `{ passage, proof }`: a scoped/TTL'd
   passage endpoint plus a **signed egress attestation** `{ region, seenAs, issuedAt, signature }`.
5. **Complete** — the client verifies the proof's region equals the requested region (and, in
   production, the signature against Nomad's published attestation key) before `session.complete()`
   releases escrow. On mismatch it `session.reject()`s and funds return to the buyer.

## Approval gates

- Never release escrow on a missing, malformed, or region-mismatched egress proof — reject instead.
- Never fund a quote above `MAX_PASSAGE_NMD`.
- Treat an expired job or a provider rejection as a stop; the buyer wallet keeps its $NMD.

## Security & redaction rules

- Secrets (`BUYER_SIGNER_PRIVATE_KEY`, `.env`, any WireGuard config) come from env and are
  gitignored — never commit them or print them.
- Public proof may include job ids, the passage region/label, egress `seenAs` geo, attestation
  signatures, and public wallet addresses. It must never include private keys or exit infrastructure detail.
- The client talks only to the public ACP registry and chain RPC; no server hostnames or
  exit infrastructure live in this repo.

## Validation

1. `npm run typecheck` compiles clean.
2. With a registered provider running, `npm run buyer` reaches `job.completed` and prints a
   verified passage endpoint + egress proof for `TARGET_REGION`.
3. `test/escrow-nmd.mjs` confirms ACP escrow accepts **$NMD** as the settlement token on RH testnet.

Note: the in-repo reference provider stubs the attestation payload and this client verifies
the egress region only — real signing lives in the hosted Nomad provider (see the live demo).

## Output Contract

Return:
- The passage endpoint and its TTL.
- The verified egress region and the `seenAs` geo from the signed proof.
- The job id and the $NMD amount escrowed/released.
- On failure: the rejection reason (over-budget, region mismatch, expired) and that funds were retained.
