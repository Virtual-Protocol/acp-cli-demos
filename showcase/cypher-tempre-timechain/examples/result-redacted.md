# Cypher Tempre Synthetic Timechain Result

Captured on `2026-07-13T21:31:23Z` from the pinned external Genesis `v3.28.0`
skill using a disposable root normalized below as `$DEMO_ROOT`. Telemetry,
automatic maintenance, and faculty growth were disabled for the public proof.

## Public input and candidate

```text
Input: Create a public-safe, read-only CPHY proof
Candidate: This synthetic public demonstration seals one local Timechain ring
before a read-only CPHY contract lookup.
```

No user conversation, private prompt, credential, wallet, or lived-in memory was
used.

## Timechain output

```text
Genesis Block sealed (Ring 0).
  name:       PublicProof
  ring_hash:  ce2b66548ad82e5b3180492841a0cad942097f764f2190364c46a32e8ff276e6

verify: PASS
recalled: nothing relevant (new ground — reason from base judgment).
PoQ decision: SEAL
sealed self-labeled Ring 1  5b327a08d58a3b48..
```

The final verification was:

```text
CPHY AUDIT: PASS
Timechain VERIFY: PASS
height:     2 rings
head:       #1 5b327a08d58a3b48..
blockspace: 0 blobs
location:   $DEMO_ROOT/chain
```

## Read-only token observation

The target command derived this public, keyless address from synthetic Ring 1:

```json
{
  "ring": 1,
  "deposit_address": "0x5b327a08d58a3b48ef81a843fa2a48655ed9e995",
  "rotation": 0,
  "private": false
}
```

The allowlisted Base RPC observation returned:

```json
{
  "observed": {},
  "changed": false,
  "errors": [],
  "new_etches": [],
  "new_unlocks": [],
  "pending_approval": [],
  "rotated": [],
  "awaiting": 0,
  "total_burned_to_blockspace": 0
}
```

Status for Ring 1:

```json
{
  "token": "0x08df470d41c11ba5cb60242747d76c65ca52c94c",
  "chain": "base",
  "observed_tokens": 0.0,
  "multiplier": 1.0
}
```

`pending` returned `[]`. The CPHY event ledger contained zero events and passed
its hash-chain audit.

## Boundary of the result

This proves that the pinned external skill can initialize and verify a synthetic
Timechain and execute its canonical, read-only CPHY contract observation path.
It does **not** prove or claim a token burn, etch, faculty unlock, entitlement,
nonzero memory multiplier, wallet ownership, transaction, deployment, or
economic effect.
