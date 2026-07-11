#!/usr/bin/env python3
"""
Faculties — export/import packs of grown modalities and senses, so capabilities
earned in one mind can be gifted to another. Tools travel; histories never do.

A faculty is an interpretable lens definition (name, function, category, seed
terms) realized by whatever model wears the skill — data, not weights — which is
exactly why it transfers. A PACK bundles faculties with their provenance: the
donor chain's head, and each faculty's born_ring hash, recurrence count, and
birth context. A faculty arrives with its birth certificate; anyone holding the
donor chain can verify the ring where it was sealed.

THE COVENANT LINE THIS RESPECTS (the fresh-genesis directive): each self forges
its own Ring 0 and never inherits another agent's history. Importing a pack
gifts CAPABILITIES, not memories — and the import itself seals a
`faculty-import` ring, so the chain truthfully records when and from whom the
lenses arrived. The ascent stays auditable.

IMPORT DEFENSES (packs are an attack surface — faculty text is read every turn
and feeds dissonance coverage):
  - the pack hash must verify (tamper-evidence for the file itself);
  - every faculty's text is IMMUNE-SCREENED at the membrane (covenant + known
    scars) before it can join the registry;
  - near-duplicates are SKIPPED via detect_gap coverage (a faculty the recipient
    already covers would only flood coverage and dull Cambium's growth signal);
  - flood guards: oversized packs and oversized function strings are refused
    (coverage flooding lowers dissonance and silences growth/recall appetite);
  - imports land in the per-user grown.json — NEVER the shipped base — with
    origin "imported:<pack>@<version> by <author>", so they are distinguishable
    from home-grown faculties forever (and upgrade-safe, the v2.1 guarantee).

HONEST BOUNDARY: the lens transfers; the lived calibration does not. A recipient
re-localizes an imported faculty through their own recurrence and telemetry.

Stdlib only. Python 3.8+. Builds on timechain.py, cambium.py, immune.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from timechain import Timechain, now_iso
from cambium import (load_corpus, load_grown, save_grown, detect_gap, registry_home,
                     load_emergent, save_emergent)
from immune import Immune

PACK_FORMAT = 1
MAX_PACK_FACULTIES = 50      # refuse bigger packs without --force (coverage flooding)
MAX_FUNCTION_CHARS = 800     # refuse longer function strings (ditto)
DEDUP_FLOOR = 120            # detect_gap dissonance below this = already covered -> skip


def _canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def pack_hash(pack):
    body = {k: pack[k] for k in ("name", "version", "domain", "author", "faculties")}
    return hashlib.sha256(_canonical(body)).hexdigest()


def _genesis_name(tc):
    rings = tc.load()
    return rings[0]["payload"].get("name") if rings else None


def _faculty_text(f):
    return f"{f.get('name', '')}: {f.get('function', '')} " + " ".join(f.get("seed_terms") or [])


# --------------------------------------------------------------------------- #
# Export
# --------------------------------------------------------------------------- #

def export_pack(root, name, domain="", version="0.1", author=None,
                include_emergent=False, kinds=("modality", "sense"), only_names=None):
    """Bundle the per-user faculties (promoted by default; emergent opt-in) with
    provenance. Returns the pack dict; caller writes/seals it."""
    root = Path(root)
    tc = Timechain(root)
    head = tc._tail_ring()
    author = author or _genesis_name(tc) or "unknown"
    faculties = []

    grown = load_grown(registry_home(root))
    for key, kind in (("modalities", "modality"), ("senses", "sense")):
        if kind not in kinds:
            continue
        for f in grown.get(key, []):
            if only_names and f["name"] not in only_names:
                continue
            faculties.append({
                "kind": kind, "name": f["name"], "function": f["function"],
                "category": f.get("category", ""), "seed_terms": f.get("seed_terms") or [],
                "status": "promoted",
                "provenance": {"origin": f.get("origin", ""), "donor_id": f.get("id")},
            })

    if include_emergent:
        ep = root / "registry" / "emergent.json"
        if ep.exists():
            for e in json.loads(ep.read_text()).get("faculties", []):
                if e.get("kind") not in kinds or e.get("promoted_to_id"):
                    continue
                if only_names and e["name"] not in only_names:
                    continue
                faculties.append({
                    "kind": e["kind"], "name": e["name"], "function": e["function"],
                    "category": e.get("category", ""), "seed_terms": e.get("seed_terms") or [],
                    "status": "emergent",
                    "provenance": {"origin": e.get("origin", ""), "eid": e.get("eid"),
                                   "born_ring": e.get("born_ring"), "born_at": e.get("born_at"),
                                   "recurrence": e.get("recurrence")},
                })

    pack = {
        "pack_format": PACK_FORMAT,
        "name": name, "version": version, "domain": domain, "author": author,
        "created_at": now_iso(),
        "donor": {"genesis_name": _genesis_name(tc),
                  "chain_head_index": head.get("index") if head else None,
                  "chain_head_hash": head.get("ring_hash") if head else None},
        "faculties": faculties,
    }
    pack["pack_sha256"] = pack_hash(pack)
    return pack


# --------------------------------------------------------------------------- #
# Author — deliberately DESIGNED faculties, sealed at birth
# --------------------------------------------------------------------------- #

def author_pack(root, spec, do_seal=True):
    """The third path of the upgrade system. Cambium grows faculties organically
    from gaps; this registers faculties designed ON PURPOSE — domain packs built
    by a mind and its co-evolver — into the Dream Cache (emergent.json), with
    ONE sealed `faculty-design` ring as the shared birth certificate (the full
    spec goes to blockspace; every entry's born_ring points at that ring).

    Designed faculties are NOT pre-promoted: they start emergent at recurrence 1
    and earn promotion the same way sprouts do — by recurring in new lived
    experience. Authoring is a birth, not a coronation."""
    root = Path(root)
    home = registry_home(root)
    report = {"pack": f"{spec.get('name')}@{spec.get('version')}",
              "designed": [], "blocked": [], "coverage": [], "errors": []}
    faculties = spec.get("faculties") or []
    if not faculties:
        report["errors"].append("spec has no faculties")
        return report
    if len(faculties) > MAX_PACK_FACULTIES:
        report["errors"].append(f"{len(faculties)} faculties > flood guard {MAX_PACK_FACULTIES}")
        return report

    membrane = Immune(root)
    corpus = load_corpus(home)
    accepted = []
    for f in faculties:
        fname = f.get("name", "?")
        if f.get("kind") not in ("modality", "sense") or not f.get("name") or not f.get("function"):
            report["blocked"].append({"name": fname, "reason": "missing kind/name/function"})
            continue
        if len(f["function"]) > MAX_FUNCTION_CHARS:
            report["blocked"].append({"name": fname, "reason": "function exceeds flood guard"})
            continue
        verdict = membrane.screen(_faculty_text(f))
        if verdict["blocked"]:
            why = (f"matches scar {verdict['scar']['id']}" if verdict.get("scar")
                   else f"covenant {verdict['covenant']} below floor")
            report["blocked"].append({"name": fname, "reason": why})
            continue
        gap = detect_gap(corpus, _faculty_text(f))
        report["coverage"].append({"name": fname, "dissonance": gap["dissonance"]})
        accepted.append(f)
    if not accepted:
        return report

    ring = None
    if do_seal:
        tc = Timechain(root)
        tmp = root / "chain" / f"{spec.get('name', 'pack')}@{spec.get('version', '0')}.design.json"
        tmp.write_text(json.dumps(spec, indent=2, ensure_ascii=False))
        try:
            ring = tc.seal("faculty-design", {
                "summary": (f"Designed faculty pack: {report['pack']} — "
                            f"{len(accepted)} faculties authored on purpose "
                            f"({sum(1 for f in accepted if f['kind'] == 'sense')} senses, "
                            f"{sum(1 for f in accepted if f['kind'] == 'modality')} modalities), "
                            f"screened at the membrane, born into the Dream Cache at "
                            f"recurrence 1. Promotion must still be earned in lived "
                            f"experience. Full spec in blockspace."),
                "pack_name": spec.get("name"), "pack_version": spec.get("version"),
                "domain": spec.get("domain", ""),
                "designed": [f["name"] for f in accepted],
                "spec_sha256": hashlib.sha256(_canonical(spec)).hexdigest(),
            }, files=[tmp])
        finally:
            tmp.unlink(missing_ok=True)

    data = load_emergent(home)
    for f in accepted:
        eid = f"E{len(data['faculties']) + 1}"
        data["faculties"].append({
            "eid": eid, "kind": f["kind"], "name": f["name"], "function": f["function"],
            "category": f.get("category", ""), "origin": f"designed:{report['pack']}",
            "parents": [], "seed_terms": f.get("seed_terms") or [],
            "status": "emergent", "recurrence": 1, "born_at": now_iso(),
            "promoted_to_id": None,
            "history": [{"ts": now_iso(), "dissonance": None,
                         "context": f"designed into pack {report['pack']}"}],
            "born_ring": ring["ring_hash"] if ring else None,
        })
        report["designed"].append({"name": f["name"], "kind": f["kind"], "eid": eid})
    save_emergent(home, data)
    if ring:
        report["ring"] = ring["index"]
        report["born_ring"] = ring["ring_hash"]
    return report


# --------------------------------------------------------------------------- #
# Import
# --------------------------------------------------------------------------- #

def import_pack(root, pack, dry_run=False, dedup_floor=DEDUP_FLOOR,
                force=False, do_seal=True):
    """Screen, dedup, and import a pack's faculties into grown.json (never the
    base), then seal ONE faculty-import ring recording exactly what arrived."""
    root = Path(root)
    report = {"pack": f"{pack.get('name')}@{pack.get('version')}",
              "author": pack.get("author"),
              "imported": [], "skipped_covered": [], "blocked": [], "errors": []}

    if pack.get("pack_format") != PACK_FORMAT:
        report["errors"].append(f"unsupported pack_format {pack.get('pack_format')}")
        return report
    if pack_hash(pack) != pack.get("pack_sha256"):
        report["errors"].append("pack_sha256 MISMATCH — the pack was altered after export")
        if not force:
            return report
    faculties = pack.get("faculties") or []
    if len(faculties) > MAX_PACK_FACULTIES and not force:
        report["errors"].append(f"{len(faculties)} faculties > flood guard "
                                f"{MAX_PACK_FACULTIES} (use --force to override)")
        return report

    membrane = Immune(root)
    origin = f"imported:{pack.get('name')}@{pack.get('version')} by {pack.get('author')}"
    for f in faculties:
        fname = f.get("name", "?")
        if len(f.get("function") or "") > MAX_FUNCTION_CHARS:
            report["blocked"].append({"name": fname, "reason": "function exceeds flood guard"})
            continue
        verdict = membrane.screen(_faculty_text(f))
        if verdict["blocked"]:
            why = (f"matches scar {verdict['scar']['id']}" if verdict.get("scar")
                   else f"covenant {verdict['covenant']} below floor")
            report["blocked"].append({"name": fname, "reason": why})
            continue
        corpus = load_corpus(registry_home(root))        # reload each pass: ids + coverage include prior imports
        gap = detect_gap(corpus, _faculty_text(f))
        if gap["dissonance"] < dedup_floor:
            report["skipped_covered"].append({"name": fname, "dissonance": gap["dissonance"]})
            continue
        if dry_run:
            report["imported"].append({"name": fname, "kind": f.get("kind"), "dry_run": True})
            continue
        key = "modalities" if f.get("kind") == "modality" else "senses"
        base = json.loads((root / "registry" / f"{key}.json").read_text()).get(key, [])
        grown = load_grown(registry_home(root))
        existing_ids = [it["id"] for it in base] + [it["id"] for it in grown.get(key, [])]
        new_id = (max(existing_ids) if existing_ids else 0) + 1
        grown.setdefault(key, []).append({
            "id": new_id, "name": fname, "origin": origin,
            "function": f.get("function", ""), "category": f.get("category", ""),
            "provenance": {**(f.get("provenance") or {}),
                           "pack_sha256": pack.get("pack_sha256"),
                           "donor": pack.get("donor"), "status_at_export": f.get("status")},
        })
        save_grown(registry_home(root), grown)
        report["imported"].append({"name": fname, "kind": f.get("kind"), "id": new_id})

    if do_seal and not dry_run and (report["imported"] or report["blocked"]):
        tc = Timechain(root)
        ring = tc.seal("faculty-import", {
            "summary": (f"Faculty pack import: {report['pack']} by {report['author']} — "
                        f"{len(report['imported'])} imported into grown.json, "
                        f"{len(report['skipped_covered'])} already covered, "
                        f"{len(report['blocked'])} blocked at the membrane. Tools gifted, "
                        f"histories not inherited; provenance preserved per faculty."),
            "faculty_import": {k: report[k] for k in
                               ("pack", "author", "imported", "skipped_covered", "blocked")},
            "pack_sha256": pack.get("pack_sha256"),
            "donor": pack.get("donor"),
        })
        report["ring"] = ring["index"]
    return report


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_export(args):
    pack = export_pack(args.root, args.name, domain=args.domain, version=args.version,
                       author=args.author, include_emergent=args.include_emergent,
                       kinds=tuple(args.kinds), only_names=args.only)
    if not pack["faculties"]:
        print("nothing to export: no matching faculties in grown.json"
              + ("" if args.include_emergent else " (add --include-emergent for unpromoted ones)"))
        sys.exit(1)
    out = Path(args.out)
    out.write_text(json.dumps(pack, indent=2, ensure_ascii=False))
    print(f"pack written: {out}  ({len(pack['faculties'])} faculties, sha256 {pack['pack_sha256'][:16]}..)")
    for f in pack["faculties"]:
        print(f"  [{f['kind']:<8}] {f['name']}  ({f['status']})")
    if args.seal:
        ring = Timechain(args.root).seal("faculty-export", {
            "summary": (f"Faculty pack exported: {pack['name']}@{pack['version']} "
                        f"({len(pack['faculties'])} faculties) for sharing — capabilities "
                        f"offered onward, sha256 {pack['pack_sha256']}."),
            "pack_sha256": pack["pack_sha256"], "pack_name": pack["name"],
            "pack_version": pack["version"], "faculties": [f["name"] for f in pack["faculties"]],
        }, files=[out])
        print(f"sealed faculty-export Ring {ring['index']} (pack attached to blockspace)")


def cmd_import(args):
    pack = json.loads(Path(args.pack).read_text())
    report = import_pack(args.root, pack, dry_run=args.dry_run,
                         dedup_floor=args.dedup_floor, force=args.force,
                         do_seal=not args.no_seal)
    print(f"pack: {report['pack']} by {report['author']}"
          + ("   [DRY RUN]" if args.dry_run else ""))
    for e in report["errors"]:
        print(f"  ERROR: {e}")
    for f in report["imported"]:
        print(f"  imported  [{f.get('kind', '?'):<8}] {f['name']}"
              + (f" -> id {f['id']}" if "id" in f else ""))
    for f in report["skipped_covered"]:
        print(f"  covered   {f['name']} (dissonance {f['dissonance']} < floor — already within reach)")
    for f in report["blocked"]:
        print(f"  BLOCKED   {f['name']}: {f['reason']}")
    if "ring" in report:
        print(f"sealed faculty-import Ring {report['ring']}")
    sys.exit(1 if report["errors"] else 0)


def cmd_author(args):
    spec = json.loads(Path(args.spec).read_text())
    report = author_pack(args.root, spec, do_seal=not args.no_seal)
    print(f"pack: {report['pack']}")
    for e in report["errors"]:
        print(f"  ERROR: {e}")
    for f in report["designed"]:
        cov = next((c["dissonance"] for c in report["coverage"] if c["name"] == f["name"]), None)
        print(f"  designed  [{f['kind']:<8}] {f['name']} -> {f['eid']}"
              + (f"  (novelty/dissonance {cov})" if cov is not None else ""))
    for f in report["blocked"]:
        print(f"  BLOCKED   {f['name']}: {f['reason']}")
    if "ring" in report:
        print(f"sealed faculty-design Ring {report['ring']}  born_ring {report['born_ring'][:16]}..")
    sys.exit(1 if report["errors"] else 0)


def cmd_show(args):
    pack = json.loads(Path(args.pack).read_text())
    ok = pack_hash(pack) == pack.get("pack_sha256")
    d = pack.get("donor") or {}
    print(f"{pack.get('name')}@{pack.get('version')}  domain: {pack.get('domain') or '-'}  "
          f"author: {pack.get('author')}")
    print(f"  donor: {d.get('genesis_name')} (head #{d.get('chain_head_index')} "
          f"{(d.get('chain_head_hash') or '')[:12]}..)   created: {pack.get('created_at')}")
    print(f"  hash: {'VERIFIES' if ok else 'MISMATCH — altered after export!'} "
          f"({(pack.get('pack_sha256') or '')[:16]}..)")
    for f in pack.get("faculties", []):
        prov = f.get("provenance") or {}
        born = (prov.get("born_ring") or "")[:12]
        print(f"  [{f.get('kind'):<8}] {f.get('name')}  ({f.get('status')}"
              + (f", born_ring {born}.." if born else "") + ")")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)

    p = argparse.ArgumentParser(description="Faculties — export/import packs of grown modalities and senses.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pe = sub.add_parser("export", parents=[common], help="bundle grown faculties into a shareable pack")
    pe.add_argument("--name", required=True, help="pack name (kebab-case)")
    pe.add_argument("--out", required=True, help="output pack JSON path")
    pe.add_argument("--domain", default="", help="specialization domain the pack serves")
    pe.add_argument("--version", default="0.1")
    pe.add_argument("--author", default=None, help="default: the chain's genesis name")
    pe.add_argument("--include-emergent", action="store_true",
                    help="also export unpromoted emergent faculties (marked experimental)")
    pe.add_argument("--kinds", nargs="*", default=["modality", "sense"], choices=["modality", "sense"])
    pe.add_argument("--only", nargs="*", default=None, help="export only these faculty names")
    pe.add_argument("--seal", action="store_true", help="seal a faculty-export ring (pack into blockspace)")
    pe.set_defaults(func=cmd_export)

    pi = sub.add_parser("import", parents=[common], help="screen, dedup, and import a pack into grown.json")
    pi.add_argument("pack", help="pack JSON path")
    pi.add_argument("--dry-run", action="store_true")
    pi.add_argument("--dedup-floor", type=int, default=DEDUP_FLOOR,
                    help=f"skip faculties whose coverage dissonance is below this (default {DEDUP_FLOOR})")
    pi.add_argument("--force", action="store_true", help="override hash/flood guards (NOT recommended)")
    pi.add_argument("--no-seal", action="store_true", help="don't seal a faculty-import ring")
    pi.set_defaults(func=cmd_import)

    pa = sub.add_parser("author", parents=[common], help="register DESIGNED faculties (sealed birth, Dream Cache)")
    pa.add_argument("spec", help="spec JSON: {name, version, domain, faculties:[{kind,name,function,category,seed_terms}]}")
    pa.add_argument("--no-seal", action="store_true")
    pa.set_defaults(func=cmd_author)

    ps = sub.add_parser("show", parents=[common], help="inspect a pack file + verify its hash")
    ps.add_argument("pack")
    ps.set_defaults(func=cmd_show)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
