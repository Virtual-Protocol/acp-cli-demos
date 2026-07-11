# Layered architecture (v3.14)

The unworn audit pass found the skill welds three products together, so a
skeptic who would love the ledger bounces off the mythology. The modules now
declare their layer; each layer is usable without the ones above it.

## Layer 1 - ct-ledger (cryptographic guarantees)
Append-only hash-chained persistence. Zero opinions about cognition.
- timechain.py (rings, blockspace, verify, checkpoints)
- epochs.py (registry content-hash anchoring)
- consensus.py (k-of-n witness attestation)

Use alone when you want: tamper-evident logs, verifiable history.

## Layer 2 - ct-discipline (cognitive hygiene, depends on Layer 1)
The conscience and the membrane. Opinionated but mechanical.
- poq.py (six-dimension gate, FORCE_UNCERTAINTY, effort floor)
- guard.py (span-level grounding, credit maps)
- immune.py (chain-integrity recovery, covenant-score seam, lockdown/rollback)
- conjecture.py (speculation channel with mandatory scoring)
- telemetry.py, policy.py, doctor.py, watchdog.py (observability + enforcement)

Use alone when you want: anti-hallucination gating over any ledger.

## Layer 3 - ct-mind (self-model, depends on Layers 1+2)
The differentiated, growing self.
- recall.py (the loop: label, recall, seal; routing via router.py)
- cambium.py, faculties.py, modality_ops.py (growth, junk guard, prune, rent)
- chronosynaptic.py (MCTS perspective forks)
- dream.py, learner.py, lens.py, extractor.py, hippocampus.py, replay.py,
  almanac.py, continuum.py, task.py, dormancy.py (sleep, learning, memory)
- autobiography.py (living self-portrait)
- enforce.py + hooks + openclaw-plugin (harness enforcement spines)

The guarantees differ BY LAYER and the trust label must too: Layer 1 claims
are cryptographic; Layer 2 claims are mechanical proxies with model seams;
Layer 3 claims are aspirational scaffolding that the telemetry must earn.
