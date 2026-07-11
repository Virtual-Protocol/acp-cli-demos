#!/usr/bin/env python3
"""recall_query - the question path (v3.15: physical split landed).

The recall ladder for QUESTIONS against an existing chain: grep -> retrieve
-> fan-out -> gather/track. Engine in recall.py; CLI in recall_cli.py.

    from recall_query import Recall
    r = Recall(root, None)   # .grep / .retrieve / .gather / .track surfaces
"""
from recall import Recall                                     # noqa: F401
