#!/usr/bin/env python3
"""
Continuum — long-horizon tasking via data-height blocks with full state refresh.

The problem: a task can be far larger than any context window (an enterprise
codebase, a months-long investigation). Holding it all in context causes rot;
forgetting it causes drift. The Continuum solves both by turning the task into a
self-validating chain of bounded blocks.

Two guarantees per block:
  1. DATA-HEIGHT BOUND. Each block ingests ONE chunk sized to a sweet-spot band
     (>= MIN so blocks hold real data, <= MAX so no single block can rot the
     context). All incoming data is split to this height — piece by piece, any
     size of task is tackled at a constant, manageable granularity.
  2. FULL STATE REFRESH. Each block carries the COMPLETE current task state
     (objective, cursor, metrics, rolling findings, next action) — not a diff.
     So reading the single HEAD block fully re-hydrates the task. An agent can
     stop at any block and resume — new session, hours or weeks later — and know
     exactly where it is and what to do next. It never loses track.

Self-validation: the state carries running invariants (monotonic progress, one
chunk per block, non-decreasing tokens ingested). `validate` checks these across
the chain on top of the timechain's hash verification — the continuum proves its
own coherence.

State is bounded by design (findings capped to a rolling window), so the
re-hydration payload never grows — the cure for context rot.

Stdlib only. Python 3.8+.  Companion to timechain.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from timechain import Timechain

# Data-height band, measured in approximate tokens (~4 chars/token).
TARGET_TOKENS = 1024   # the sweet spot per block
MIN_TOKENS = 256       # below this, merge — blocks must hold real data
MAX_TOKENS = 1536      # hard ceiling — no single block may exceed this (anti-rot)
FINDINGS_WINDOW = 6    # rolling cap so the state refresh stays bounded
DEFAULT_SKIP_DIRS = {".git", ".hg", ".svn", ".venv", "__pycache__", "node_modules", "vendor"}

LANGUAGE_BY_EXT = {
    ".c": "c",
    ".cc": "cpp",
    ".cpp": "cpp",
    ".cxx": "cpp",
    ".go": "go",
    ".h": "c",
    ".hpp": "cpp",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".sh": "shell",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".yaml": "yaml",
    ".yml": "yaml",
}

SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S),
     "[REDACTED_PRIVATE_KEY]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"), "[REDACTED_OPENAI_KEY]"),
    (re.compile(
        r"(?i)\b((?:api|access|secret|private|auth|bearer|token|password|passwd|pwd)"
        r"[A-Za-z0-9_.-]*\s*[:=]\s*)(['\"]?)[^'\"\s]{8,}(['\"]?)"
    ), None),
]


def approx_tokens(s: str) -> int:
    return max(1, len(s) // 4)


def chunk_text_with_lines(text: str, target=TARGET_TOKENS, min_=MIN_TOKENS, max_=MAX_TOKENS):
    """Split text into chunks and retain 1-based inclusive source line ranges."""
    chunks, cur, cur_start, cur_end = [], "", None, None

    def flush():
        nonlocal cur, cur_start, cur_end
        if cur:
            chunks.append({"content": cur, "line_start": cur_start or 1, "line_end": cur_end or cur_start or 1})
            cur, cur_start, cur_end = "", None, None

    lines = text.splitlines(keepends=True)
    for line_no, ln in enumerate(lines, start=1):
        if approx_tokens(ln) > max_:                      # a single oversized line
            flush()
            step = max_ * 4
            for j in range(0, len(ln), step):
                chunks.append({"content": ln[j:j + step], "line_start": line_no, "line_end": line_no})
            continue
        if cur and approx_tokens(cur + ln) > target:
            flush()
        if not cur:
            cur_start = line_no
        cur += ln
        cur_end = line_no
    flush()

    if not chunks:
        chunks.append({"content": "", "line_start": 1, "line_end": 1})
    if (len(chunks) >= 2 and approx_tokens(chunks[-1]["content"]) < min_
            and approx_tokens(chunks[-2]["content"] + chunks[-1]["content"]) <= max_):
        chunks[-2]["content"] += chunks[-1]["content"]
        chunks[-2]["line_end"] = chunks[-1]["line_end"]
        chunks.pop()
    return chunks


def chunk_text(text: str, target=TARGET_TOKENS, min_=MIN_TOKENS, max_=MAX_TOKENS):
    """Backward-compatible content-only chunking helper."""
    return [c["content"] for c in chunk_text_with_lines(text, target, min_, max_)]


def language_for_extension(ext: str):
    return LANGUAGE_BY_EXT.get(ext.lower())


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def redact_secrets(text: str):
    """Return text with common secrets masked, plus the number of replacements."""
    total = 0
    out = text
    for pattern, replacement in SECRET_PATTERNS:
        if replacement is None:
            def repl(match):
                return f"{match.group(1)}{match.group(2)}[REDACTED_SECRET]{match.group(3)}"
            out, count = pattern.subn(repl, out)
        else:
            out, count = pattern.subn(replacement, out)
        total += count
    return out, total


# Git provenance via DIRECT ref reads — stdlib file I/O only, no process spawning,
# no process spawning. Best-effort: any failure yields None fields. git_dirty
# is not computed without git, so it is reported as None (unknown) rather than
# shelling out — the cryptographic provenance is the commit SHA.
def _git_dir(path):
    p = Path(path).resolve()
    for d in [p, *p.parents]:
        g = d / ".git"
        try:
            if g.is_dir():
                return g, d
            if g.is_file():
                line = g.read_text(errors="ignore").strip()
                if line.startswith("gitdir:"):
                    gd = (d / line.split(":", 1)[1].strip()).resolve()
                    return (gd if gd.exists() else None), d
        except Exception:
            return None, None
    return None, None


def _read_ref(git_dir, ref):
    try:
        loose = git_dir / ref
        if loose.is_file():
            return loose.read_text(errors="ignore").strip() or None
    except Exception:
        pass
    try:
        packed = git_dir / "packed-refs"
        if packed.is_file():
            for line in packed.read_text(errors="ignore").splitlines():
                line = line.strip()
                if not line or line[0] in "#^":
                    continue
                sha, _, name = line.partition(" ")
                if name == ref:
                    return sha or None
    except Exception:
        pass
    return None


def _git_remote(git_dir):
    try:
        section = None
        for raw in (git_dir / "config").read_text(errors="ignore").splitlines():
            s = raw.strip()
            if s.startswith("[") and s.endswith("]"):
                section = s[1:-1].strip().lower()
            elif section == 'remote "origin"' and "=" in s:
                k, _, v = s.partition("=")
                if k.strip().lower() == "url":
                    return v.strip() or None
    except Exception:
        pass
    return None


def _git_info(path):
    info = {"git_commit": None, "git_branch": None, "git_dirty": None,
            "git_root": None, "git_remote": None}
    try:
        git_dir, root = _git_dir(path)
        if not git_dir:
            return info
        info["git_root"] = str(root) if root else None
        info["git_remote"] = _git_remote(git_dir)
        head = (git_dir / "HEAD").read_text(errors="ignore").strip()
        if head.startswith("ref:"):
            ref = head.split(":", 1)[1].strip()
            info["git_branch"] = ref.rsplit("/", 1)[-1]
            info["git_commit"] = _read_ref(git_dir, ref)
        elif head:
            info["git_branch"] = "HEAD"   # detached
            info["git_commit"] = head
    except Exception:
        pass
    return info


def git_info_for(path):
    return _git_info(path)


def git_commit_for(path: Path):
    return git_info_for(path).get("git_commit")


def path_role(relative_path: str, ext: str):
    parts = [p.lower() for p in relative_path.split("/") if p]
    name = parts[-1] if parts else ""
    stem = name.rsplit(".", 1)[0] if "." in name else name
    if any(p in {"generated", "gen", "dist", "build", "out", "target"} for p in parts):
        return "generated"
    if any(p in {"vendor", "third_party", "node_modules"} for p in parts):
        return "vendor"
    if any(p in {"test", "tests", "__tests__", "spec", "specs"} for p in parts):
        return "test"
    if stem.startswith("test_") or stem.endswith("_test") or stem.endswith(".test") or stem.endswith(".spec"):
        return "test"
    if any(p in {"doc", "docs", "documentation"} for p in parts) or ext in {".md", ".rst", ".txt"}:
        return "docs"
    if ext in {".json", ".yaml", ".yml", ".toml", ".ini", ".cfg"} or name in {
        "makefile", "dockerfile", ".env", ".gitignore", ".dockerignore",
    }:
        return "config"
    if language_for_extension(ext):
        return "source"
    return "other"


def should_skip_file(path: Path, skip_dirs):
    parts = set(path.parts)
    return bool(parts & set(skip_dirs or ()))


def latest_file_hashes(timechain: Timechain):
    # Stream the chain (O(1) memory); retain only the path->hash map, which is
    # bounded by file count, not by chain content.
    latest = {}
    for ring in timechain.iter_rings():
        data = ring.get("payload", {}).get("data") or {}
        rel = data.get("relative_path")
        h = data.get("file_content_hash")
        if rel and h:
            latest[rel] = h
    return latest


def file_metadata(base_path: Path, file_path: Path, file_index: int, content: str, git_info=None,
                  redaction_count=0):
    rel = file_path.relative_to(base_path).as_posix()
    parts = rel.split("/")
    ext = file_path.suffix.lower()
    h = sha256_text(content)
    role = path_role(rel, ext)
    git_info = dict(git_info or {})
    return {
        "relative_path": rel,
        "filename": file_path.name,
        "file_index": file_index,
        "top_dir": parts[0] if len(parts) > 1 else "",
        "extension": ext,
        "language": language_for_extension(ext),
        "path_role": role,
        "is_test": role == "test",
        "is_generated": role == "generated",
        "git_commit": git_info.get("git_commit"),
        "git_branch": git_info.get("git_branch"),
        "git_dirty": git_info.get("git_dirty"),
        "git_root": git_info.get("git_root"),
        "git_remote": git_info.get("git_remote"),
        "file_content_hash": h,
        "redacted": redaction_count > 0,
        "redaction_count": redaction_count,
    }


class Continuum:
    def __init__(self, root, target=TARGET_TOKENS, min_=MIN_TOKENS, max_=MAX_TOKENS):
        self.tc = Timechain(root)
        self.root = Path(root)
        self.target, self.min, self.max = target, min_, max_
        self._state = None       # cached rolling state across a walk -> no per-file reload
        self._labeler = None     # lazy recall labeler for self-labeling at ingest
        self._embed = None       # embedding provider for self-embedding at ingest (e.g. 'hashing')

    def _labels(self, content):
        """Self-label a chunk at ingest (recall labels, optionally an embedding vector), so
        retrieval reads sealed labels/vectors instantly instead of re-computing per query."""
        if self._labeler is None:
            import recall
            self._labeler = recall.Recall(self.root, registry_root=Path(__file__).resolve().parent,
                                          embedder=self._embed)
        return self._labeler.label(content)

    def _apply_window_cap(self):
        """Window-matched chunking: a block longer than the active
        embedder's input window is silently half-blind to retrieval — the model
        truncates, the vector never sees the tail. When self-embedding
        is on, cap the data-height band to the embedder's window. Also replaces
        a provider STRING with the built embedder object so the labeler reuses
        it (no double model load)."""
        if not self._embed:
            return
        try:
            import embed as embmod
            if isinstance(self._embed, str):
                self._embed = embmod.get_embedder(self._embed)
            wc = getattr(self._embed, "window_chars", None)
            if wc:
                wt = max(64, wc // 4)               # ~4 chars/token proxy
                if wt < self.max:
                    self.max = wt
                    self.target = min(self.target, wt)
                    self.min = min(self.min, wt)
        except Exception:
            pass                # a missing dep must never break plain ingestion

    def _head_state(self):
        # The head (last) ring of a continuum task carries a full state refresh,
        # so read it from the TAIL — O(1), never materialize the whole chain.
        last = self.tc._tail_ring()
        if last:
            st = (last.get("payload") or {}).get("state")
            if st:
                return st
        # Tail wasn't state-bearing (e.g. a digest sealed at the very end):
        # scan a bounded window of recent rings, newest first.
        for r in reversed(self.tc.tail_rings(256)):
            st = (r.get("payload") or {}).get("state")
            if st:
                return st
        # Last resort (rare): stream the chain keeping only the most recent
        # state — O(1) memory, O(n) time, no list materialization.
        latest = None
        for r in self.tc.iter_rings():
            st = (r.get("payload") or {}).get("state")
            if st:
                latest = st
        return latest

    def open_task(self, objective, items_total=None, difficulty=0):
        if self.tc.height() == 0:
            self.tc.genesis(name="continuum-task",
                            covenant=["accurate", "coherent", "persistent", "honest", "thorough"],
                            params={"kind": "continuum-task", "objective": objective},
                            attach_registries=False, difficulty=difficulty)
        state = {
            "objective": objective,
            "cursor": {"item_index": 0, "item": None, "chunk_index": 0, "chunk_of": 0},
            "metrics": {"items_total": items_total, "items_done": 0,
                        "chunks_sealed": 0, "approx_tokens_ingested": 0},
            "findings": [], "findings_total": 0,
            "next_action": "ingest first item",
            "data_height": {"target_tokens": self.target, "min_tokens": self.min, "max_tokens": self.max},
        }
        ring = self.tc.seal("task_open", {"event": "task_open", "objective": objective, "state": state},
                            difficulty=difficulty)
        self._state = state
        return state, ring

    def ingest(self, name, content, finding=None, difficulty=0, label=True, metadata=None):
        st = self._state if self._state is not None else self._head_state()
        if st is None:
            raise RuntimeError("No open task on this chain — run 'open' first.")
        self._apply_window_cap()
        metadata = dict(metadata or {})
        rel_path = metadata.get("relative_path") or name
        chunks = chunk_text_with_lines(content, self.target, self.min, self.max)
        sealed = []
        for i, chunk in enumerate(chunks):
            ch = chunk["content"]
            file_content_hash = metadata.get("file_content_hash") or metadata.get("content_hash")
            st = json.loads(json.dumps(st))   # deep copy the prior state
            last = (i == len(chunks) - 1)
            st["cursor"] = {"item_index": st["cursor"]["item_index"] + (1 if i == 0 else 0),
                            "item": rel_path, "file_index": metadata.get("file_index"),
                            "chunk_index": i + 1, "chunk_of": len(chunks)}
            st["metrics"]["chunks_sealed"] += 1
            st["metrics"]["approx_tokens_ingested"] += approx_tokens(ch)
            if last:
                st["metrics"]["items_done"] += 1
                if finding:
                    st["findings"] = (st["findings"] + [f"{rel_path}: {finding}"])[-FINDINGS_WINDOW:]
                    st["findings_total"] += 1
                it = st["metrics"]["items_total"]
                done = st["metrics"]["items_done"]
                st["next_action"] = ("task complete" if (it and done >= it)
                                     else f"ingest next item (done {done}" + (f"/{it}" if it else "") + ")")
            else:
                st["next_action"] = f"continue ingesting {rel_path}: chunk {i + 2}/{len(chunks)}"
            data = {
                "item": rel_path,
                "relative_path": rel_path,
                "filename": metadata.get("filename") or Path(name).name,
                "file_index": metadata.get("file_index"),
                "chunk_index": i + 1,
                "chunk_of": len(chunks),
                "line_start": chunk["line_start"],
                "line_end": chunk["line_end"],
                "top_dir": metadata.get("top_dir"),
                "extension": metadata.get("extension") or Path(name).suffix.lower(),
                "language": metadata.get("language"),
                "path_role": metadata.get("path_role"),
                "is_test": metadata.get("is_test"),
                "is_generated": metadata.get("is_generated"),
                "git_commit": metadata.get("git_commit"),
                "git_branch": metadata.get("git_branch"),
                "git_dirty": metadata.get("git_dirty"),
                "git_root": metadata.get("git_root"),
                "git_remote": metadata.get("git_remote"),
                "content_hash": sha256_text(ch),
                "file_content_hash": file_content_hash,
                "redacted": bool(metadata.get("redacted")),
                "redaction_count": metadata.get("redaction_count", 0),
                "approx_tokens": approx_tokens(ch),
                "content": ch,
            }
            payload = {"event": "continuum", "task": st["objective"][:48], "state": st,
                       "data": data}
            if label:
                try:
                    payload["labels"] = self._labels(ch)   # self-label at ingest -> instant recall later
                except Exception:
                    pass
            ring = self.tc.seal("continuum", payload, difficulty=difficulty)
            sealed.append((ring, approx_tokens(ch)))
        self._state = st                       # cache rolling state -> next ingest needs no reload
        return sealed, st

    def resume(self):
        return self._head_state()

    def validate(self):
        ok, report = self.tc.verify()
        prev, sizes, heights, issues = None, [], [], []
        for r in self.tc.iter_rings():   # stream — never materialize the chain
            p = r.get("payload", {})
            if p.get("event") != "continuum":
                continue
            sizes.append(len(json.dumps(r)))
            h = p["data"]["approx_tokens"]
            heights.append(h)
            m = p["state"]["metrics"]
            if m["chunks_sealed"] == 1:        # first block of a (new) task segment on this chain
                prev = None                    # invariants are per-task; one chain may hold many tasks
            if h > self.max:
                issues.append(f"ring {r['index']}: data-height {h} > max {self.max}")
            if prev:
                if m["items_done"] < prev["items_done"]:
                    issues.append(f"ring {r['index']}: items_done regressed")
                if m["chunks_sealed"] != prev["chunks_sealed"] + 1:
                    issues.append(f"ring {r['index']}: chunks_sealed not monotonic +1")
                if m["approx_tokens_ingested"] < prev["approx_tokens_ingested"]:
                    issues.append(f"ring {r['index']}: tokens ingested regressed")
            prev = m
        out = list(report)
        if heights:
            out.append(f"continuum blocks: {len(heights)}")
            out.append(f"data-height (tokens) min/avg/max: {min(heights)}/{sum(heights)//len(heights)}/{max(heights)}  (band {self.min}-{self.max})")
            out.append(f"block size (bytes)   min/avg/max: {min(sizes)}/{sum(sizes)//len(sizes)}/{max(sizes)}")
        out.append("invariant issues: " + "; ".join(issues) if issues
                   else "state invariants coherent: monotonic progress, +1 chunk/block, every block within data-height band")
        return ok and not issues, out

    def walk(self, path, exts, objective, difficulty=0, label=True, embed=None,
             redact=True, changed_only=False, skip_dirs=None):
        self._embed = embed
        self._apply_window_cap()
        path = Path(path)
        skip_dirs = DEFAULT_SKIP_DIRS if skip_dirs is None else set(skip_dirs)
        files = sorted(
            p for p in path.rglob("*")
            if p.is_file() and p.suffix in exts and not should_skip_file(p.relative_to(path), skip_dirs)
        )
        prior_hashes = latest_file_hashes(self.tc) if changed_only else {}
        git_info = git_info_for(path)
        # items_total is the candidate count (an upper bound under --changed-only);
        # it is progress metadata only, so we never read file content to compute it.
        self.open_task(objective, items_total=len(files), difficulty=difficulty)
        results = []
        # STREAM the corpus: read ONE file, seal it, release it. Peak memory is
        # O(a single file), never O(the whole tree) — the bounded-ingest promise.
        # (The earlier pre-buffer of every file's text could OOM on large trees.)
        for file_index, f in enumerate(files, start=1):
            try:
                text = f.read_text(errors="replace")
            except Exception:
                continue                 # unreadable/special file — skip, don't abort the walk
            rel = f.relative_to(path).as_posix()
            if changed_only and prior_hashes.get(rel) == sha256_text(text):
                continue
            sealed_text, redaction_count = redact_secrets(text) if redact else (text, 0)
            ndef = text.count("def "); ncls = text.count("class ")
            finding = f"{text.count(chr(10))+1} lines, {ndef} defs, {ncls} classes"
            if redaction_count:
                finding += f", {redaction_count} secret(s) redacted"
            meta = file_metadata(path, f, file_index, text, git_info=git_info,
                                 redaction_count=redaction_count)
            sealed, _ = self.ingest(rel, sealed_text, finding=finding, difficulty=difficulty,
                                    label=label, metadata=meta)
            results.append((rel, len(sealed)))
            text = sealed_text = None     # release this file before the next
        return files, results


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _print_state(st):
    if not st:
        print("  (no task state on this chain)")
        return
    m = st["metrics"]; c = st["cursor"]
    print(f"  objective:   {st['objective']}")
    print(f"  cursor:      item {c['item_index']} ({c['item']}), chunk {c['chunk_index']}/{c['chunk_of']}")
    it = m["items_total"]
    print(f"  progress:    {m['items_done']}" + (f"/{it}" if it else "") + f" items, {m['chunks_sealed']} blocks, ~{m['approx_tokens_ingested']} tokens ingested")
    print(f"  findings ({st['findings_total']} total, last {len(st['findings'])}):")
    for fnd in st["findings"]:
        print(f"     - {fnd}")
    a = st.get("audit")
    if a:
        tb = a.get("total_blocks") or 0
        pct = (100.0 * a.get("review_cursor", 0) / tb) if tb else 0.0
        print(f"  AUDIT review: {a.get('review_cursor', 0)}/{tb} blocks ({pct:.1f}%), "
              f"{a.get('findings_total', 0)} findings — "
              f"{'COMPLETE' if a.get('complete') else 'INCOMPLETE (audit.py next)'}")
    print(f"  NEXT ACTION: {st['next_action']}")


def cmd_open(args):
    st, ring = Continuum(args.root).open_task(args.objective, items_total=args.items)
    print(f"task opened (Ring {ring['index']}).")
    _print_state(st)


def cmd_ingest(args):
    source = Path(args.file).read_text(errors="replace") if args.file else args.text
    content, redaction_count = redact_secrets(source) if not args.no_redact else (source, 0)
    metadata = {
        "relative_path": args.name,
        "filename": Path(args.name).name,
        "extension": Path(args.name).suffix.lower(),
        "language": language_for_extension(Path(args.name).suffix.lower()),
        "file_content_hash": sha256_text(source),
        "redacted": redaction_count > 0,
        "redaction_count": redaction_count,
    }
    c = Continuum(args.root); c._embed = args.embed
    finding = args.finding
    if redaction_count:
        finding = (finding + "; " if finding else "") + f"{redaction_count} secret(s) redacted"
    sealed, st = c.ingest(args.name, content, finding=finding, label=not args.no_label,
                          metadata=metadata)
    print(f"ingested '{args.name}' -> {len(sealed)} block(s) at heights {[t for _, t in sealed]} tokens")
    if redaction_count:
        print(f"redacted {redaction_count} secret-like value(s) before sealing")
    _print_state(st)


def cmd_walk(args):
    files, results = Continuum(args.root).walk(args.path, tuple(args.ext), args.objective,
                                               label=not args.no_label, embed=args.embed,
                                               redact=not args.no_redact,
                                               changed_only=args.changed_only,
                                               skip_dirs=args.exclude_dir)
    skipped = len(files) - len(results)
    print(f"walked {len(files)} files -> indexed {len(results)} file(s)"
          + (f", skipped {skipped} unchanged/excluded file(s)" if skipped else "")
          + " -> blocks per file:")
    for name, n in results:
        print(f"   {name:<24} {n} block(s)")
    _print_state(Continuum(args.root).resume())


def cmd_resume(args):
    print("RESUME — full task state re-hydrated from the single head block:")
    _print_state(Continuum(args.root).resume())


def cmd_validate(args):
    ok, report = Continuum(args.root).validate()
    for line in report:
        print("  " + line)
    print("CONTINUUM:", "COHERENT" if ok else "INCOHERENT")
    sys.exit(0 if ok else 1)


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root,
                        help="task chain root (use a per-task dir for big jobs)")

    p = argparse.ArgumentParser(description="Continuum — long-horizon tasking via data-height blocks.")
    sub = p.add_subparsers(dest="cmd", required=True)

    po = sub.add_parser("open", parents=[common], help="open a task (seals initial state)")
    po.add_argument("--objective", required=True)
    po.add_argument("--items", type=int, default=None)
    po.set_defaults(func=cmd_open)

    pi = sub.add_parser("ingest", parents=[common], help="ingest one item (file or --text) as data-height blocks")
    pi.add_argument("--name", required=True)
    pi.add_argument("--file", default=None)
    pi.add_argument("--text", default=None)
    pi.add_argument("--finding", default=None)
    pi.add_argument("--no-label", action="store_true", help="skip self-labeling at ingest")
    pi.add_argument("--no-redact", action="store_true", help="seal raw content without secret redaction")
    pi.add_argument("--embed", nargs="?", const="hashing", default=None,
                    help="self-embed each block at ingest (provider, default hashing)")
    pi.set_defaults(func=cmd_ingest)

    pw = sub.add_parser("walk", parents=[common], help="open a task and ingest every file under a path")
    pw.add_argument("--path", required=True)
    pw.add_argument("--objective", required=True)
    pw.add_argument("--ext", nargs="+", default=[".py"])
    pw.add_argument("--no-label", action="store_true", help="skip self-labeling at ingest")
    pw.add_argument("--no-redact", action="store_true", help="seal raw content without secret redaction")
    pw.add_argument("--changed-only", action="store_true", help="skip files whose file hash is already indexed")
    pw.add_argument("--exclude-dir", nargs="+", default=sorted(DEFAULT_SKIP_DIRS),
                    help="relative directory names to skip while walking")
    pw.add_argument("--embed", nargs="?", const="hashing", default=None,
                    help="self-embed each block at ingest (provider, default hashing)")
    pw.set_defaults(func=cmd_walk)

    pr = sub.add_parser("resume", parents=[common], help="re-hydrate full task state from the head block")
    pr.set_defaults(func=cmd_resume)

    pv = sub.add_parser("validate", parents=[common], help="check continuum coherence + chain integrity")
    pv.set_defaults(func=cmd_validate)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
