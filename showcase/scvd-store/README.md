# SCVD Store ACP Registry Proof

This package publishes the first public EconomyOS proof for `scvd-store`, the
ACP presence for [scvd.store](https://scvd.store).

The claim is deliberately narrow:

- the agent record is publicly visible in the ACP registry;
- the registry record ties the agent name to public EVM and Solana wallet
  addresses;
- the package ships a reusable skill for checking another ACP agent's registry
  record before relying on it.

This package does **not** claim that an ACP job has been created, funded,
delivered, evaluated, or settled. That proof belongs in a later package after a
live job receipt exists.

## Public agent record

- Agent name: `scvd-store`
- Agent id: `01a034fe-fe17-7a0b-b78d-f6bf6c2413fb`
- Role: `HYBRID`
- Registry detail:
  <https://api.acp.virtuals.io/agents/01a034fe-fe17-7a0b-b78d-f6bf6c2413fb>
- Agent page:
  <https://app.virtuals.io/acp/agent/01a034fe-fe17-7a0b-b78d-f6bf6c2413fb>

## Package contents

- `showcase.json` — Showcase manifest consumed by the docs sync.
- `agent.yaml` — small public snapshot of the registry identity being proved.
- `proof/acp-agent-record.md` — dated proof note with the exact public checks.
- `skills/acp-agent-registry-check/` — reusable read-only registry-check skill.

## Validation

Run from the repository root:

```bash
node scripts/validate-showcase.mjs
```

The public checks in the proof note can be rerun with `curl`; no credentials
are required.
