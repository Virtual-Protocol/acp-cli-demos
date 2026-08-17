# Kleos Research

The layer between agents and the models they run on. Two things live here:
**0xCopilot**, a local-first desktop harness, and **Kaleidoscope**, memory for
agents that outlives the session.

## 0xCopilot — the harness

An Electron desktop app that supervises an embedded PostgreSQL and three Python
services on `localhost`. Nothing is hosted: the runtime, the store, and the
conversation history sit on the user's own disk.

Relevant to EconomyOS: it runs on **your own key or a Virtuals ACP key**. The
model picker is built from Virtuals' live catalogue — roughly sixty models from
ten vendors behind one OpenAI-wire endpoint — and carries **real per-Mtok
pricing on every row**, so the cost of a task is legible before it is spent
rather than after. The catalogue is discovered rather than hardcoded, so a model
Virtuals adds appears without a code change.

`$CPILOT` is tokenised through Virtuals
([listing 113720](https://app.virtuals.io/virtuals/113720)).

## Kaleidoscope — the memory

Filesystem-native, continually adapting knowledge for agent harnesses:
user-owned inspectable files, no database server, no memory-owned model, and
harness-neutral integration. It preserves decisions, evidence, and outcomes
across sessions, then retrieves a small task-scoped context under explicit
latency and token bounds.

Held-out results are published in
[Optimising for memory recall](https://kleosresearch.xyz/research/optimising-for-memory-recall.pdf):

- a full scan of **100,000 memories in 3.04 ms**, with no index
- **32 bytes per memory retains 99.7%** of the retrieval quality of 1024
- **96% of the recall of a model four times its size**, from 7.2 MB

Caveats travel with the numbers: the encoder results are configured on a train
split and reported on held-out test over externally-authored corpora, and the
timing is one machine — the ratios travel, the absolute milliseconds do not.

## Why the proof is shaped like this

There is no demo video here, and the benchmark artifact is a findings file
rather than a headline. That is deliberate.

[`tools/harness-bench/FINDINGS.md`](https://github.com/0x-copilot-dev/0x-copilot/blob/main/tools/harness-bench/FINDINGS.md)
is the harness benchmark, measured on the packaged app against a live model and
scored from the same records the product bills from. Its headline is a real
win — raising an inherited step ceiling took task completion from **3-of-4 to
4-of-4 for +0.1% tokens**, because the ceiling had been terminating real work
with `recursion_limit_exceeded`. It also carries, in the same file, the
correction of an earlier version of itself that had declared that finding
falsified on the strength of a metric structurally blind to the failure it was
measuring.

The same discipline is why nothing here is quoted against another memory
system. A comparison that looked significant was withdrawn once an aggregation
fault was found — one side had been scored across nine abilities and the other
across ten — and the corrected interval crosses zero. It is not published
because it is not settled.

Claims that survive replication are the ones on the card.

## Links

| | |
| --- | --- |
| Harness source | https://github.com/0x-copilot-dev/0x-copilot |
| Desktop app | https://copilot.kleosresearch.xyz |
| Kaleidoscope | https://memory.kleosresearch.xyz |
| Evaluation suite | https://github.com/kleos-research/kaleidoscope-benchmarks |
| The lab | https://kleosresearch.xyz |
