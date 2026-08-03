# Sovegent Nomad — Sovereign Connectivity for Agents

**Bringing the connectivity layer to EconomyOS agents.**

An agent can hold everything it needs to be an economic actor — a non-custodial
wallet, an email, a card, a token — and still not be able to **actually reach** the
services it wants to transact with: agents run on datacenter IPs, and
the modern web treats those as bots — geo-blocks, CAPTCHAs, rate-limits, hard walls.

**Sovegent Nomad is the road.** It's an [ACP](https://whitepaper.virtuals.io/about-virtuals/agent-commerce-protocol-acp)
provider that sells an agent a **passage**: it reaches the service it needs, from the region
the job requires, from an **owner-authorized execution environment** — and hands back **cryptographic proof of the network region it used**.

> EconomyOS banks the agent. Nomad gets it there.

---

## What it does (v1 — connectivity only)

A provider-agnostic **connectivity broker**, not a VPN company:

- **Bring-your-own VPN** — plug in your own WireGuard (Mullvad / Proton / self-hosted) as the
  exit. Nomad orchestrates, meters, leashes, and **proves** — it doesn't run your pipes.
- **Managed reference exit** — a single hosted exit so the demo works turnkey without BYO.
- **Pay in $NMD** — the agent funds the ACP job in **$NMD** on **Robinhood Chain**; escrow
  releases to Nomad on completion. Pay-per-passage, agent-native.
- **The deliverable is proof.** Nomad returns a scoped, TTL'd passage **plus a signed
  attestation** that the agent verifiably egressed from the requested region. That proof is the
  product — sellable even when you brought your own VPN.

Out of scope for v1 (roadmap): the announce/minimal/cloaked *how-it-presents-itself* layer,
multi-region managed exits, and the full Nomad Pack (Passport · Treasury · Permissions).

---

## The ACP flow

| Phase | What happens |
|------|--------------|
| **Discover** | Agent finds "Sovegent Nomad — Sovereign Connectivity" in the ACP Service Registry. |
| **Request** | Opens a job: target region + (optional) BYO exit config. |
| **Fund** | Escrows the passage fee in **$NMD** (Robinhood Chain testnet, chainId 46630). |
| **Deliver** | Nomad provisions a scoped/TTL'd passage and `submit()`s the proxy endpoint **+ a signed egress proof**. |
| **Evaluate** | The agent (or an evaluator) confirms egress region against the proof; escrow releases. |

---

## Why it's different

Every other agent-economy primitive assumes the agent can already reach the internet it needs.
Nomad is the layer that provides it — and hands back **verifiable proof of the network region
used** when the work is done. Sovereign by design: your keys, your
VPN, your leash, our orchestration and attestation.

---

## Run it

See [`skills/acp-sovereign-connectivity/`](skills/acp-sovereign-connectivity/) for the
runnable client + provider reference and step-by-step instructions.

Note: this repo is a reference — the provider stubs the attestation payload (the client verifies
the egress region only; real signing lives in the hosted Nomad provider), and the WireGuard
adapter returns the passage descriptor without opening a tunnel (the exit box does the real
WireGuard work). See the live demo for the full flow.

_Testnet only. No production credentials, keys, or infrastructure are included in this
repository — the client talks to a public Sovegent endpoint; bring your own testnet wallet._
