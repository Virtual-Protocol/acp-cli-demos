#!/usr/bin/env python3
"""
Operators — the shared guarantee machinery behind every learner.

Three learners ship with this skill (the decisions scorer, the representation
lens, the distilled labeler) and they all make the same promise: no silent
self-modification. Every adoption and every rollback is a sealed, falsifiable
`operator` ring; versions count up from the chain's own history; the regressed
operator is never erased, only superseded — a scar, not an edit.

This module is that promise, written once. Each learner keeps its own training,
evaluation, and file-restore logic (those genuinely differ); what they share —
version derivation from sealed adopt rings, the operator-ring seal itself, and
the logistic squash their training loops use — lives here, so the guarantee
cannot drift apart across learners.

Stdlib only. Python 3.8+. Used by learner.py, lens.py, extractor.py.
"""

from __future__ import annotations

import math


def sigmoid(z):
    if z < -30:
        return 0.0
    if z > 30:
        return 1.0
    return 1.0 / (1.0 + math.exp(-z))


def prior_adopts(tc, operator):
    """Every sealed adoption of this operator, in chain order. The chain — not a
    counter file — is the source of truth for what was ever active."""
    return [r for r in tc.load()
            if r.get("ring_type") == "operator"
            and r.get("payload", {}).get("operator") == operator
            and r.get("payload", {}).get("action") == "adopt"]


def next_version(tc, operator, prefix):
    """Version numbers derive from sealed history: lens-v3 means two adoptions
    are already in the chain, whoever or whatever produced them."""
    return f"{prefix}-v{len(prior_adopts(tc, operator)) + 1}"


def seal_adopt(tc, operator, summary, extra=None, files=None):
    """Seal an adoption: the operator ring carries the summary, the learner's
    metadata, and (via files) the weights blob in blockspace — falsifiable by
    re-running the training on the same telemetry range."""
    payload = {"summary": summary, "operator": operator, "action": "adopt"}
    payload.update(extra or {})
    return tc.seal("operator", payload, files=files)


def seal_rollback(tc, operator, reverted_to, extra=None):
    """Seal a reversion. The regressed operator remains sealed in history as a
    scar — recovery covers the learner, not just the memory."""
    payload = {
        "summary": (f"Operator rollback: {operator} reverted to {reverted_to}. The "
                    f"regressed operator remains sealed in history as a scar."),
        "operator": operator, "action": "rollback", "reverted_to": reverted_to,
    }
    payload.update(extra or {})
    return tc.seal("operator", payload)
