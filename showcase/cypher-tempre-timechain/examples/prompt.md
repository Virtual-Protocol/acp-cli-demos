# Demo Prompt

Run the pinned external `cypher-tempre-self-model` skill from Cypher Tempre
Genesis `v3.28.0` against a new disposable chain. Seal exactly one synthetic
public ring, derive its public keyless CPHY observation address, query the
canonical CPHY contract through the skill's allowlisted read-only Base RPC
path, and verify both the CPHY ledger and the Timechain.

Set `CT_AUTOGROW=0`, `CT_AUTOMAINT=0`, and `CT_TELEMETRY=off` before the turn so
the exact-one-ring receipt cannot grow faculties, run maintenance, or emit
telemetry. Keep the generated chain outside the skill source directory.

Do not use a real identity chain, wallet address, signature, transaction, token
burn, credential, private prompt, or generated faculty state. Report explicitly
what the proof does and does not demonstrate.
