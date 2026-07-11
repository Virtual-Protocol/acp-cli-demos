#!/usr/bin/env python3
"""
Almanac — the calendar organ (V4 Phase 2): resolve RELATIVE time expressions
("last Tuesday", "two weeks ago", "a couple of days ago") against an anchor
date, into a concrete [from, to] day window.

Why it exists: cosine similarity cannot retrieve by WHEN. "Who did I meet
last Tuesday?" shares no semantics with the lunch session it refers to — a
ranking-only recall path abstains on every question of this shape. The chain's blocks carry dates (`recall.ring_date`); this module
turns the deictic phrase into a date window so retrieval can hard-filter by
time BEFORE ranking by meaning.

Honest boundaries:
  - Windows, not points: fuzzy phrases ("a few days ago", "N weeks ago") return
    a tolerant window; precise phrases ("yesterday", "last Tuesday") return a
    single day. The MODEL judges what falls inside.
  - Deixis resolves against the chosen anchor. "Yesterday" inside a sealed
    session means that SESSION's date minus one — pass the session's stamp as
    the anchor, never the asking date, when anchoring an in-text mention.
  - Unresolvable input returns None; callers fall back to unfiltered retrieval
    (never worse than before).

Stdlib only.
"""
from __future__ import annotations

import argparse
import calendar
import re
from datetime import date, timedelta

WEEKDAYS = {name.lower(): i for i, name in enumerate(calendar.day_name)}      # monday=0
WEEKDAYS.update({name.lower(): i for i, name in enumerate(calendar.day_abbr)})  # mon=0
NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "couple": 2, "few": 3, "several": 4,
}


def parse_stamp(value):
    """'2023/05/30 (Tue) 23:40' | '2023-05-30T…' | date -> datetime.date | None."""
    if value is None:
        return None
    if isinstance(value, date):
        return value
    s = str(value).strip()[:10].replace("/", "-")
    parts = s.split("-")
    if len(parts) == 3 and parts[0].isdigit() and len(parts[0]) == 4:
        try:
            return date(int(parts[0]), int(parts[1]), int(parts[2]))
        except ValueError:
            return None
    return None


def _iso(d):
    return d.isoformat()


def _n(word):
    w = word.strip().lower()
    if w.isdigit():
        return int(w)
    return NUMBER_WORDS.get(w)


def _month_window(anchor, months_back, pad_days=7):
    """The full calendar month ~`months_back` months before anchor, padded —
    'two months ago' names a neighborhood, not a day."""
    m = anchor.month - months_back
    y = anchor.year
    while m < 1:
        m += 12
        y -= 1
    first = date(y, m, 1)
    last = date(y, m, calendar.monthrange(y, m)[1])
    return first - timedelta(days=pad_days), last + timedelta(days=pad_days)


# Ordered most-specific-first; each: (compiled regex, resolver(match, anchor) -> (lo, hi)).
_PATTERNS = [
    (re.compile(r"\bday before yesterday\b", re.I),
     lambda m, d: (d - timedelta(days=2), d - timedelta(days=2))),
    (re.compile(r"\byesterday\b", re.I),
     lambda m, d: (d - timedelta(days=1), d - timedelta(days=1))),
    (re.compile(r"\b(?:earlier )?today\b|\bthis (?:morning|afternoon|evening)\b", re.I),
     lambda m, d: (d, d)),
    (re.compile(r"\b(\w+)(?:\s+of)?\s+days?\s+ago\b", re.I),
     lambda m, d: ((d - timedelta(days=_n(m.group(1)) + (0 if str(m.group(1)).isdigit() else 1)),
                    d - timedelta(days=max(1, _n(m.group(1)) - (0 if str(m.group(1)).isdigit() else 1))))
                   if _n(m.group(1)) is not None else None)),
    (re.compile(r"\b(\w+)(?:\s+of)?\s+weeks?\s+ago\b", re.I),
     lambda m, d: ((d - timedelta(days=7 * _n(m.group(1)) + 1),
                    d - timedelta(days=7 * _n(m.group(1)) - 1))
                   if _n(m.group(1)) is not None else None)),
    (re.compile(r"\b(\w+)(?:\s+of)?\s+months?\s+ago\b", re.I),
     lambda m, d: (_month_window(d, _n(m.group(1)))
                   if _n(m.group(1)) is not None else None)),
    (re.compile(r"\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday"
                r"|mon|tue|wed|thu|fri|sat|sun)\b", re.I),
     lambda m, d: (lambda back: (d - timedelta(days=back), d - timedelta(days=back)))(
         ((d.weekday() - WEEKDAYS[m.group(1).lower()]) % 7) or 7)),
    (re.compile(r"\blast\s+weekend\b", re.I),
     lambda m, d: (lambda sat: (sat, sat + timedelta(days=1)))(
         d - timedelta(days=((d.weekday() - 5) % 7) or 7))),
    (re.compile(r"\blast\s+week\b", re.I),
     lambda m, d: (lambda monday: (monday - timedelta(days=7), monday - timedelta(days=1)))(
         d - timedelta(days=d.weekday()))),
    (re.compile(r"\bthis\s+week\b", re.I),
     lambda m, d: (d - timedelta(days=d.weekday()), d)),
    (re.compile(r"\blast\s+month\b", re.I),
     lambda m, d: _month_window(d, 1, pad_days=0)),
    (re.compile(r"\blast\s+year\b", re.I),
     lambda m, d: (date(d.year - 1, 1, 1), date(d.year - 1, 12, 31))),
]


def resolve(expr, asked_on):
    """One relative expression -> ('YYYY-MM-DD', 'YYYY-MM-DD') | None."""
    anchor = parse_stamp(asked_on)
    if anchor is None or not expr:
        return None
    for rx, fn in _PATTERNS:
        m = rx.search(expr)
        if m:
            win = fn(m, anchor)
            if win:
                lo, hi = win
                return _iso(lo), _iso(hi)
    return None


_BOUND_BEFORE = re.compile(r"(?:before|until|till|by|prior\s+to|since|after)\s*$", re.I)


def find_in_text(text, asked_on):
    """Scan free text (a question) for EVERY resolvable relative expression.
    Returns [{'expr': matched phrase, 'from': iso, 'to': iso}, …] in match order.
    A phrase preceded by a BOUND word ('before today', 'since last week') names
    a limit, not a target window — skipped (a known false positive:
    'airlines I flew before today' must not collapse to the asking day)."""
    anchor = parse_stamp(asked_on)
    if anchor is None or not text:
        return []
    found, seen = [], set()
    for rx, fn in _PATTERNS:
        for m in rx.finditer(text):
            span = (m.start(), m.end())
            if any(s <= span[0] < e for s, e in seen):
                continue
            if _BOUND_BEFORE.search(text[max(0, m.start() - 12):m.start()]):
                continue
            win = fn(m, anchor)
            if win:
                seen.add(span)
                found.append({"expr": m.group(0), "from": _iso(win[0]), "to": _iso(win[1]),
                              "_pos": m.start()})
    found.sort(key=lambda x: x["_pos"])
    for f in found:
        f.pop("_pos", None)
    return found


def days_between(a, b):
    """Inclusive-aware interval: returns (delta, delta_inclusive) | None.
    Date-arithmetic convention accepts both 'N days' and 'N+1 (including the
    last day)' — report both, let the model phrase it."""
    da, db = parse_stamp(a), parse_stamp(b)
    if da is None or db is None:
        return None
    delta = abs((db - da).days)
    return delta, delta + 1


def main(argv=None):
    p = argparse.ArgumentParser(description="Almanac — resolve relative time expressions.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("resolve", help="resolve expression(s) in text against an anchor date")
    pr.add_argument("text")
    pr.add_argument("--asked-on", required=True, help="anchor stamp, e.g. '2023/05/30 (Tue) 23:40'")
    pr.set_defaults(cmd="resolve")
    pb = sub.add_parser("between", help="days between two dates (exclusive + inclusive counts)")
    pb.add_argument("a")
    pb.add_argument("b")
    pb.set_defaults(cmd="between")
    args = p.parse_args(argv)
    if args.cmd == "resolve":
        hits = find_in_text(args.text, args.asked_on)
        if not hits:
            print("(no resolvable relative expression)")
        for h in hits:
            span = h["from"] if h["from"] == h["to"] else f"{h['from']} .. {h['to']}"
            print(f"  '{h['expr']}' -> {span}")
    else:
        r = days_between(args.a, args.b)
        if r is None:
            print("(unparseable date)")
        else:
            print(f"  {r[0]} days ({r[1]} including the last day)")


if __name__ == "__main__":
    main()
