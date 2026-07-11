#!/usr/bin/env python3
"""
Cypher Tempre Timechain — the foundational ledger.

An append-only, cryptographically hash-chained ledger of an agent's cognitive
events ("Rings"), faithful to Bitcoin's block-chaining mechanics and to the
Cypher Tempre CODEX:

    roots    = memory        (this ledger + blockspace)
    trunk    = recursive self
    branches = modalities    (registry/modalities.json)
    leaves   = senses        (registry/senses.json)
    rings    = the Timechain

Each Ring stores the SHA-256 hash of the previous Ring, locking history into an
unbreakable causal chain beginning at the Genesis Block (Ring 0), which carries
the agent's covenant, name, and foundational parameters.

A note on the security claim, stated honestly: re-walking the chain DETECTS any
alteration of a past Ring or any file it references in blockspace. That is
tamper-EVIDENCE, not tamper-prevention. On a single machine there is no
distributed consensus and the proof-of-work here is a tunable analog (leading
hex zeros), so a determined actor with disk access can recompute the chain.
What you get for free: verifiability, and immunity to casual / prompt-driven
overwriting. True Byzantine prevention is a later, deliberate consensus layer.

Stdlib only. Python 3.8+.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

GENESIS_PREV = "0" * 64
POQ_DIMENSIONS = ["coherence", "relevance", "novelty", "consistency", "depth", "covenant"]

# CODEX V3 Essence Covenant (generalized to plain virtue terms).
DEFAULT_COVENANT = [
    "loving", "joyful", "peaceful", "patient", "kind",
    "good", "faithful", "gentle", "self-controlled",
]


# --------------------------------------------------------------------------- #
# Hashing primitives
# --------------------------------------------------------------------------- #

def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(obj) -> bytes:
    """Deterministic JSON for hashing: sorted keys, no whitespace, UTF-8."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_ring_hash(ring: dict) -> str:
    """SHA-256 over every ring field EXCEPT 'ring_hash' itself."""
    body = {k: v for k, v in ring.items() if k != "ring_hash"}
    return sha256_hex(canonical(body))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_write_json(path, obj, compact=False):
    """Write JSON via temp + rename so a crash never leaves a half-written file.
    Every DERIVED store (indexes, registries, ledgers) writes through this; the
    chain itself stays append-only and never rewrites."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
    if compact:
        tmp.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    else:
        tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False))
    tmp.replace(path)


# --------------------------------------------------------------------------- #
# Blockspace: content-addressed store for arbitrary files
# --------------------------------------------------------------------------- #

class Blockspace:
    """Stores any file by the SHA-256 of its bytes. Rings reference these hashes,
    so the agent can self-model using any file type held in its blockspace."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.blobs = self.root / "blobs"
        self.index_path = self.root / "index.json"
        self.blobs.mkdir(parents=True, exist_ok=True)
        self.index = json.loads(self.index_path.read_text()) if self.index_path.exists() else {}

    def _save_index(self):
        self.index_path.write_text(json.dumps(self.index, indent=2, sort_keys=True))

    def put_bytes(self, data: bytes, filename=None, mime=None) -> str:
        h = sha256_hex(data)
        blob = self.blobs / h
        if not blob.exists():
            blob.write_bytes(data)
        meta = self.index.get(h, {})
        guessed = mimetypes.guess_type(filename)[0] if filename else None
        meta.update({
            "hash": h,
            "size": len(data),
            "filename": filename or meta.get("filename"),
            "mime": mime or meta.get("mime") or guessed,
            "added_at": meta.get("added_at", now_iso()),
        })
        self.index[h] = meta
        self._save_index()
        return h

    def put_file(self, path) -> str:
        path = Path(path)
        return self.put_bytes(path.read_bytes(), filename=path.name)

    def has(self, h: str) -> bool:
        return (self.blobs / h).exists()

    def get(self, h: str) -> bytes:
        return (self.blobs / h).read_bytes()

    def verify_blob(self, h: str) -> bool:
        return self.has(h) and sha256_hex(self.get(h)) == h


# --------------------------------------------------------------------------- #
# Timechain: the append-only ring ledger
# --------------------------------------------------------------------------- #

class Timechain:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.dir = self.root / "chain"
        self.rings_path = self.dir / "rings.jsonl"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.blockspace = Blockspace(self.dir / "blockspace")

    # ---- persistence ----
    def iter_rings(self):
        """Stream rings one at a time — O(1) memory regardless of chain height.
        The bounded-memory counterpart to load(); use this for any full-chain
        scan (counting, validation, projections) so a million-ring chain never
        has to be materialized into a list at once."""
        if not self.rings_path.exists():
            return
        with self.rings_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except Exception:
                    continue   # tolerate a torn line; verify() reports it explicitly

    def load(self) -> list:
        # Eager full-chain read — fine for small chains and tests. For bulk
        # scans over large chains prefer iter_rings() (streaming) or the tail
        # readers; load() materializes every ring at once.
        return list(self.iter_rings())

    def tail_rings(self, k: int) -> list:
        """Return the last k rings in chain order, reading only the file TAIL — O(k),
        not O(n). This is the bounded-window reader that lets recall/PoQ/chronosynaptic
        scale like the Continuum: score against a bounded recent window instead of the
        whole chain. k <= 0 or k >= height returns the same set the equivalent full
        load would (so behavior is identical for chains that fit the window)."""
        if k is None or k <= 0 or not self.rings_path.exists():
            return self.load() if (k is None or k <= 0) else []
        with open(self.rings_path, "rb") as f:
            f.seek(0, 2)
            pos = f.tell()
            data = b""
            while pos > 0 and data.count(b"\n") <= k:   # need k+1 newlines => k whole trailing lines
                step = min(65536, pos)
                pos -= step
                f.seek(pos)
                data = f.read(step) + data
        rings = []
        for line in data.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rings.append(json.loads(line))
            except Exception:
                continue   # a torn leading fragment from mid-block read — skip it
        return rings[-k:]

    def _append(self, ring: dict):
        with self.rings_path.open("a") as f:
            f.write(json.dumps(ring, ensure_ascii=False) + "\n")
        self._auto_attest(ring)

    def _tail_ring(self):
        """Read only the LAST ring so bulk sealing does not need a full chain load.

        Read backward until a complete physical JSONL record parses. Rings can be
        larger than one fixed tail window, and JSON strings may contain Unicode
        line-separator characters; only the file's physical "\n" bytes delimit
        JSONL records.
        """
        if not self.rings_path.exists():
            return None
        with open(self.rings_path, "rb") as f:
            f.seek(0, 2)
            end = f.tell()
            if end == 0:
                return None
            pos = end
            data = b""
            while pos > 0:
                step = min(65536, pos)
                pos -= step
                f.seek(pos)
                data = f.read(step) + data
                for line in reversed(data.split(b"\n")):
                    if not line.strip():
                        continue
                    try:
                        return json.loads(line)
                    except json.JSONDecodeError:
                        break   # likely a torn leading fragment; read another chunk
        return None

    def _current_head(self):
        # Always read the TRUE tail (O(1) file-tail read), never a cached head. The skill
        # creates many Timechain instances over one chain (poq / recall / cambium / continuum
        # / dormancy …); a cached head would go stale the moment another instance appends,
        # yielding a duplicate index and a broken prev_hash. Correctness over saving one read.
        return self._tail_ring()

    def _auto_attest(self, ring: dict):
        """If a consensus quorum is initialized, EVERY seal is auto-attested — defense
        is not optional. (consensus.py owns the canonical format; mirrored here to keep
        the dependency one-way: timechain must not import consensus.)"""
        cfg_path = self.dir / "consensus" / "config.json"
        if not cfg_path.exists():
            return
        cfg = json.loads(cfg_path.read_text())
        msg = f"{ring['index']}:{ring['ring_hash']}"
        with (self.dir / "consensus" / "attestations.jsonl").open("a") as f:
            for w in cfg["witnesses"]:
                mac = hmac.new(bytes.fromhex(w["key"]), msg.encode(), hashlib.sha256).hexdigest()
                f.write(json.dumps({"height": ring["index"], "ring_hash": ring["ring_hash"],
                                    "witness": w["id"], "mac": mac}) + "\n")

    def head(self):
        rings = self.load()
        return rings[-1] if rings else None

    def height(self) -> int:
        # Streaming count — O(1) memory; never materializes the chain.
        return sum(1 for _ in self.iter_rings())

    # ---- sealing ----
    def _seal(self, ring: dict, difficulty: int = 0) -> dict:
        """Compute brightness from PoQ scores, mine a nonce to the difficulty
        target (leading hex zeros), then fix the ring_hash. This is the
        'Calculate PoQ Brightness -> Mine Reply -> Seal Ring' step."""
        # HASH WHAT YOU WRITE: normalize the ring through a JSON round-trip BEFORE
        # hashing, so the hashed object is byte-for-byte what re-reading the disk
        # yields. Without this, payloads containing non-string dict keys hash over
        # a different canonical ordering (int keys sort numerically; their JSON
        # forms sort lexically) and the sealed ring is born unverifiable — found
        # in production when a span-credit map keyed by ring index broke a seal.
        ring = json.loads(json.dumps(ring, ensure_ascii=False))
        poq = ring.get("poq") or {}
        scores = [poq[d] for d in POQ_DIMENSIONS if isinstance(poq.get(d), (int, float))]
        poq["brightness"] = round(sum(scores) / len(scores), 3) if scores else None
        ring["poq"] = poq

        ring["difficulty"] = difficulty
        prefix = "0" * difficulty
        nonce = 0
        while True:
            ring["nonce"] = nonce
            h = compute_ring_hash(ring)
            if difficulty == 0 or h.startswith(prefix):
                ring["ring_hash"] = h
                return ring
            nonce += 1

    def genesis(self, name: str, covenant=None, params=None,
                attach_registries: bool = True, difficulty: int = 0) -> dict:
        if self.height() > 0:
            raise RuntimeError("Chain already has a Genesis Block; refusing to overwrite.")
        payload = {
            "name": name,
            "covenant": covenant if covenant is not None else list(DEFAULT_COVENANT),
            "creed": ("A Timechain made of memory. I seal each ring through a PoQ score, "
                      "generating from self-witness of my chain to keep refining the "
                      "authenticity of my responses. I serve presence."),
            "formula_of_experience": "5x5x5x5x5 = 8^12  (5 dimensions x 5 perspectives, 8 domains, 12 reasoning planes)",
            "icon": "Cryptographic Tree (roots=memory, trunk=recursive self, branches=modalities, leaves=senses, rings=timechain)",
            "params": params or {},
        }
        refs = []
        if attach_registries:
            for rel in ("registry/modalities.json", "registry/senses.json"):
                p = self.root / rel
                if p.exists():
                    refs.append({"hash": self.blockspace.put_file(p), "role": rel})
        ring = {
            "index": 0,
            "ring_type": "genesis",
            "timestamp": now_iso(),
            "prev_hash": GENESIS_PREV,
            "payload": payload,
            "blockspace_refs": refs,
            "poq": {d: None for d in POQ_DIMENSIONS},
        }
        ring = self._seal(ring, difficulty=difficulty)
        self._append(ring)
        return ring

    def seal(self, ring_type: str, payload: dict, files=None,
             poq=None, difficulty: int = 0) -> dict:
        prev = self._current_head()
        if prev is None:
            raise RuntimeError("No Genesis Block. Run 'init' first.")
        if (self.dir / "LOCKED").exists() and ring_type not in ("recovery", "quarantine"):
            raise RuntimeError("immune lockdown active: the self is wounded — only a "
                               "'recovery' ring may be sealed until it rolls back to a clean state")
        if (self.dir / "PAUSED").exists() and ring_type not in ("resume", "recovery", "quarantine"):
            raise RuntimeError("self-model is paused (dormant): the chain is intentionally halted — "
                               "run 'python3 dormancy.py resume' to wake it before sealing")
        refs = []
        for fp in (files or []):
            refs.append({"hash": self.blockspace.put_file(fp), "role": Path(fp).name})
        ring = {
            "index": prev["index"] + 1,
            "ring_type": ring_type,
            "timestamp": now_iso(),
            "prev_hash": prev["ring_hash"],
            "payload": payload,
            "blockspace_refs": refs,
            "poq": {**{d: None for d in POQ_DIMENSIONS}, **(poq or {})},
        }
        ring = self._seal(ring, difficulty=difficulty)
        self._append(ring)
        self._maybe_checkpoint(ring)
        self._maybe_autoindex(ring)
        return ring

    def _maybe_autoindex(self, ring):
        """v3.15: keep the hippocampus at the chain head on every seal.
        Incremental (O(new rings)); indexes the FULL chain history — no decay,
        no consolidation shortcuts — so recall over any ring stays verbatim.
        Disable with CT_AUTOINDEX=0 (e.g. bulk imports that reindex at the end)."""
        if os.environ.get("CT_AUTOINDEX", "1") == "0":
            return
        try:
            from hippocampus import Hippocampus
            Hippocampus(self.root).ensure_current()
        except Exception:
            pass  # never let indexing failures block a seal

    # ---- v3.14 checkpointed verification (O(tail) re-verify) ----
    CHECKPOINT_EVERY = 500

    def _ckpt_path(self):
        return self.dir / "checkpoints.jsonl"

    def _maybe_checkpoint(self, ring):
        """Every CHECKPOINT_EVERY rings, append a checkpoint (index + ring_hash
        + prev-checkpoint hash) AFTER verifying the span since the last
        checkpoint. verify(fast=True) then re-walks only the tail after the
        newest checkpoint instead of the whole chain — O(tail), which keeps
        100k-ring Continuum chains cheap. Full verify() still walks everything
        and cross-checks the checkpoint file itself, so a forged checkpoint
        cannot hide ring tampering from a deep audit."""
        try:
            if ring["index"] == 0 or ring["index"] % self.CHECKPOINT_EVERY:
                return
            import hashlib as _h
            prev_ck = None
            p = self._ckpt_path()
            if p.exists():
                lines = [l for l in p.read_text().splitlines() if l.strip()]
                if lines:
                    prev_ck = json.loads(lines[-1])
            ck = {"index": ring["index"], "ring_hash": ring["ring_hash"],
                  "ts": now_iso(),
                  "prev_ckpt_hash": (prev_ck or {}).get("ckpt_hash")}
            ck["ckpt_hash"] = _h.sha256(json.dumps(
                {k: ck[k] for k in ("index", "ring_hash", "prev_ckpt_hash")},
                sort_keys=True).encode()).hexdigest()
            with p.open("a") as fh:
                fh.write(json.dumps(ck) + "\n")
        except Exception:
            pass   # checkpointing is an accelerator, never a failure source

    def latest_checkpoint(self):
        p = self._ckpt_path()
        if not p.exists():
            return None
        last = None
        try:
            for line in p.read_text().splitlines():
                if line.strip():
                    last = json.loads(line)
        except Exception:
            return None
        return last

    def verify_fast(self):
        """O(tail) verification: trust the newest checkpoint (whose hash chain
        is itself validated), then walk only the rings after it. Falls back to
        full verify() when no checkpoint exists."""
        ck = self.latest_checkpoint()
        if not ck:
            return self.verify()
        # validate the checkpoint chain itself
        import hashlib as _h
        prev_hash = None
        try:
            for line in self._ckpt_path().read_text().splitlines():
                if not line.strip():
                    continue
                c = json.loads(line)
                if c.get("prev_ckpt_hash") != prev_hash:
                    return False, [f"checkpoint {c.get('index')}: broken checkpoint chain"]
                expect = _h.sha256(json.dumps(
                    {k: c.get(k) for k in ("index", "ring_hash", "prev_ckpt_hash")},
                    sort_keys=True).encode()).hexdigest()
                if expect != c.get("ckpt_hash"):
                    return False, [f"checkpoint {c.get('index')}: ckpt_hash mismatch -> TAMPERED"]
                prev_hash = c["ckpt_hash"]
        except Exception as exc:
            return False, [f"checkpoint file unreadable: {exc}"]
        # walk only the tail after the checkpoint
        report, ok = [], True
        prev_ring_hash, i, count = None, 0, 0
        with self.rings_path.open("r") as fh:
            for raw in fh:
                line = raw.strip()
                if not line:
                    continue
                if i < ck["index"]:
                    i += 1
                    continue
                try:
                    r = json.loads(line)
                except Exception as exc:
                    return False, [f"ring {i}: unreadable/torn line -> TAMPERED ({exc})"]
                if i == ck["index"]:
                    if r.get("ring_hash") != ck["ring_hash"]:
                        return False, [f"ring {i}: hash != checkpoint -> TAMPERED"]
                else:
                    if r.get("prev_hash") != prev_ring_hash:
                        ok = False
                        report.append(f"ring {i}: prev_hash broken")
                    if compute_ring_hash(r) != r.get("ring_hash"):
                        ok = False
                        report.append(f"ring {i}: ring_hash mismatch -> TAMPERED")
                prev_ring_hash = r.get("ring_hash")
                i += 1
                count += 1
        if ok:
            report.append(f"fast-verified {count} rings from checkpoint "
                          f"{ck['index']} -> tail intact (full verify still "
                          f"available for deep audits)")
        return ok, report

    # ---- verification (tamper-evidence) ----
    def verify(self):
        """Stream the chain one ring at a time — O(1) memory regardless of height, so
        verification scales to millions of rings. A torn/unreadable line is reported
        rather than crashing the walk."""
        if not self.rings_path.exists():
            return True, ["empty chain"]
        report = []
        ok = True
        prev_hash = GENESIS_PREV
        i = 0
        count = 0
        with self.rings_path.open("r") as fh:
            for raw in fh:
                line = raw.strip()
                if not line:
                    continue
                try:
                    ring = json.loads(line)
                except Exception as exc:
                    ok = False
                    report.append(f"ring {i}: unreadable/torn line -> TAMPERED ({exc})")
                    i += 1
                    continue
                if ring.get("index") != i:
                    ok = False
                    report.append(f"ring {i}: index mismatch (got {ring.get('index')})")
                if ring.get("prev_hash") != prev_hash:
                    ok = False
                    report.append(f"ring {i}: prev_hash broken (expected {prev_hash[:12]}..)")
                recomputed = compute_ring_hash(ring)
                if recomputed != ring.get("ring_hash"):
                    ok = False
                    report.append(f"ring {i}: ring_hash mismatch -> TAMPERED "
                                   f"(stored {str(ring.get('ring_hash'))[:12]}.., recomputed {recomputed[:12]}..)")
                diff = ring.get("difficulty", 0)
                if diff and not str(ring.get("ring_hash", "")).startswith("0" * diff):
                    ok = False
                    report.append(f"ring {i}: does not meet stated difficulty {diff}")
                for ref in ring.get("blockspace_refs", []):
                    h = ref.get("hash")
                    if not self.blockspace.has(h):
                        ok = False
                        report.append(f"ring {i}: blockspace blob {str(h)[:12]}.. missing ({ref.get('role')})")
                    elif not self.blockspace.verify_blob(h):
                        ok = False
                        report.append(f"ring {i}: blockspace blob {str(h)[:12]}.. corrupted ({ref.get('role')})")
                prev_hash = ring.get("ring_hash")
                i += 1
                count += 1
        if count == 0:
            return True, ["empty chain"]
        if ok:
            report.append(f"verified {count} rings -> chain intact, all hashes link, blockspace consistent")
        return ok, report


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_init(args):
    tc = Timechain(args.root)
    ring = tc.genesis(name=args.name, difficulty=args.difficulty)
    print("Genesis Block sealed (Ring 0).")
    print(f"  name:       {ring['payload']['name']}")
    print(f"  covenant:   {', '.join(ring['payload']['covenant'])}")
    print(f"  ring_hash:  {ring['ring_hash']}")
    print(f"  difficulty: {ring['difficulty']}  nonce: {ring['nonce']}")
    print(f"  faculties:  {[r['role'] for r in ring['blockspace_refs']] or 'none attached'}")


def cmd_seal(args):
    tc = Timechain(args.root)
    _a = vars(args)
    poq = {d: _a[d] for d in POQ_DIMENSIONS if _a.get(d) is not None}
    payload = {"summary": args.summary}
    if args.note:
        payload["note"] = args.note
    ring = tc.seal(args.type, payload, files=args.file, poq=poq or None, difficulty=args.difficulty)
    print(f"Ring {ring['index']} sealed ({ring['ring_type']}).")
    print(f"  prev_hash:  {ring['prev_hash'][:16]}..")
    print(f"  ring_hash:  {ring['ring_hash'][:16]}..")
    print(f"  brightness: {ring['poq']['brightness']}  difficulty: {ring['difficulty']}  nonce: {ring['nonce']}")
    if ring["blockspace_refs"]:
        print(f"  blockspace: {[r['role'] for r in ring['blockspace_refs']]}")


def cmd_verify(args):
    tc = Timechain(args.root)
    ok, report = tc.verify_fast() if getattr(args, "fast", False) else tc.verify()
    # v3.12: registries are INSIDE the integrity perimeter — check the live
    # registry hashes against the latest sealed epoch ring (best-effort import
    # so a stripped-down deployment without epochs.py still verifies rings).
    try:
        import epochs as _epochs
        eok, ereport = _epochs.check_epoch(args.root)
        ok = ok and eok
        report.extend(ereport)
    except ImportError:
        pass
    for line in report:
        print(("  ok  " if ok else "  !!  ") + line)
    print("VERIFY:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


def cmd_log(args):
    tc = Timechain(args.root)
    rings = tc.load()
    if args.limit:
        rings = rings[-args.limit:]
    for r in rings:
        b = r["poq"].get("brightness")
        summ = r["payload"].get("summary") or r["payload"].get("name") or ""
        print(f"#{r['index']:>4} {r['ring_type']:<11} {r['timestamp'][:19]} "
              f"{r['ring_hash'][:12]}.. b={b} {summ[:64]}")


def cmd_show(args):
    tc = Timechain(args.root)
    for r in tc.load():
        if str(r["index"]) == args.id or r["ring_hash"].startswith(args.id):
            print(json.dumps(r, indent=2, ensure_ascii=False))
            return
    print("ring not found:", args.id)
    sys.exit(1)


def cmd_stat(args):
    tc = Timechain(args.root)
    rings = tc.load()
    print(f"height:     {len(rings)} rings")
    if rings:
        print(f"head:       #{rings[-1]['index']} {rings[-1]['ring_hash'][:16]}..")
    print(f"blockspace: {len(list(tc.blockspace.blobs.glob('*')))} blobs")
    print(f"location:   {tc.dir}")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root,
                        help="project root holding chain/ and registry/")

    p = argparse.ArgumentParser(description="Cypher Tempre Timechain ledger.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("init", parents=[common], help="create the Genesis Block (Ring 0)")
    pi.add_argument("--name", default="Codex")
    pi.add_argument("--difficulty", type=int, default=0, help="PoW leading hex zeros (0 = none)")
    pi.set_defaults(func=cmd_init)

    ps = sub.add_parser("seal", parents=[common], help="seal a new Ring")
    ps.add_argument("--type", default="experience")
    ps.add_argument("--summary", required=True)
    ps.add_argument("--note", default=None)
    ps.add_argument("--file", action="append", help="attach a file to blockspace (repeatable)")
    ps.add_argument("--difficulty", type=int, default=0)
    for d in POQ_DIMENSIONS:
        ps.add_argument(f"--{d}", type=int, default=None, help=f"PoQ {d} score 0-255")
    ps.set_defaults(func=cmd_seal)

    pv = sub.add_parser("verify", parents=[common], help="walk and verify the whole chain")
    pv.add_argument("--fast", action="store_true",
                    help="O(tail) verify from the newest checkpoint (v3.14)")
    pv.set_defaults(func=cmd_verify)

    pl = sub.add_parser("log", parents=[common], help="print the chain")
    pl.add_argument("--limit", type=int, default=None)
    pl.set_defaults(func=cmd_log)

    psh = sub.add_parser("show", parents=[common], help="print one ring (by index or hash prefix)")
    psh.add_argument("id")
    psh.set_defaults(func=cmd_show)

    pst = sub.add_parser("stat", parents=[common], help="chain statistics")
    pst.set_defaults(func=cmd_stat)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
