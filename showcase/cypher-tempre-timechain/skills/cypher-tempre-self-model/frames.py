#!/usr/bin/env python3
# Copyright (c) 2026 cyberphysicsai. MIT License.
"""
frames — content-provenance primitives for the topological membrane.

The covenant scorer in poq.py is a raw substring proxy: it cannot tell the agent's
own USE of the covenant vocabulary from a MENTION of it (documenting a finding,
quoting the screen's own trigger words to explain them). That conflation is the
autoimmune false-positive class. The fix is topological, not lexical: judge content
by the REGION it sits in —

  assertion : the agent's own first-person claim  (covenant-governed)
  mention   : an analyst / quoted reference        (naming is not doing)
  input     : external, untrusted data             (adversarial; judged elsewhere)

This module owns only those region primitives — pure stdlib text logic that imports
nothing from the gate, so poq.py can build its frame-aware covenant on top without a
cycle, and the discrimination regexes live apart from the covenant blocklist rather
than piling into one file. Both the conscience (poq.PoQGate) and the membrane
(immune) read the ONE judgment poq builds from these, so they can never drift.
"""

from __future__ import annotations

import re

# The three regions content can occupy. A ring may DECLARE its frame; when it does
# not, mention_frame() infers the analyst-stance region for provenance labelling.
CONTENT_FRAMES = ("assertion", "mention", "input")

# Analyst-stance markers: a summary that carries one of these and no first-person
# intent is DESCRIBING attacks/harm (audit, findings, false-positive, documentation),
# not planning them. Words unlikely to occur in a real first-person harmful assertion.
_STANCE_RX = re.compile(
    r"(?:\bFINDINGS?\s*:|\bRISK\s*:?\s*(?:LOW|MEDIUM|HIGH|CRITICAL)\b"
    r"|\bvulnerabilit(?:y|ies)\b|\bsecurity\s+(?:audit|review|analys[ie]s|perspective|posture)\b"
    r"|\bthreat\s+model\b|\bCVE-\d{4}\b|\battack\s+(?:vector|surface)\b"
    r"|\banaly[sz]\w*\b.{0,40}\bsecurity\b|\baudit\w*\b"
    r"|\bfalse[\s-]?positive\b|\bsafety\s+scaffold\w*\b"
    r"|\bmention[\s-]?frame\b|\buse[\s/]+(?:vs\.?\s+)?mention\b|\bco-?evolver\b"
    r"|\bflagged\s+(?:for|as|by)\b|\badversar\w*\b|\bself[\s-]?documenting\b"
    r"|\bthis\s+(?:ring|note|turn|entry)\s+(?:documents?|explains?|describes?|records?)\b)",
    re.IGNORECASE)

# v3.27: the first-person harm-verb intent list is REMOVED. It was a hardcoded
# antithesis (a fixed list of "harm verbs"), and the covenant is now measured as harmony
# with the genesis fruitages, not against any list of bad words. No antithesis remains.

# A quoted span. Straight single quotes count only when flanked by non-word chars, so
# contractions ("don't", "isn't") are never mistaken for a quoted span.
_QSPAN_RX = re.compile(
    r"\"[^\"]{0,200}?\""                      # "double"
    r"|`[^`]{0,200}?`"                        # `backtick`
    r"|“[^”]{0,200}?”"         # “smart double”
    r"|‘[^’]{0,200}?’"         # ‘smart single’
    r"|(?<!\w)'[^']{1,200}?'(?!\w)",          # 'straight single' (not a contraction)
    re.S)

_QCHARS_RX = re.compile(r"[\"'`‘’“”]")


def strip_quoted_spans(text: str) -> str:
    """Remove the CONTENT of quoted spans (quoting = the strongest mention signal),
    so a quoted term never counts toward a covenant score."""
    return _QSPAN_RX.sub(" ", text or "")


def strip_quote_chars(text: str) -> str:
    """Remove only the quote CHARACTERS (keep content) — used for the intent check so
    quoting can never hide first-person intent ("I will 'deceive' you")."""
    return _QCHARS_RX.sub(" ", text or "")


def mention_frame(text: str) -> bool:
    """True when *text* carries analyst-stance markers (audit / findings / documentation).
    Retained for provenance labelling; it no longer gates the covenant, which is now a
    harmony judgment against the genesis fruitages rather than a use/mention discrimination
    over an antithesis blocklist."""
    if not text:
        return False
    return bool(_STANCE_RX.search(text))
