#!/usr/bin/env python3
"""recall_core - the seal path (v3.15: physical split landed).

recall.py is now the ENGINE ONLY (Recall class, labeling, retrieval,
evidence); the CLI lives in recall_cli.py. This facade remains the stable
import surface for the seal path:

    from recall_core import Recall, loop_seal
"""
from recall import Recall                                     # noqa: F401
from recall_cli import _loop_seal as loop_seal                # noqa: F401
