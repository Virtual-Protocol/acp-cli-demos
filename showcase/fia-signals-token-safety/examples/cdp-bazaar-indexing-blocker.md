# CDP/Bazaar Indexing Blocker

**Format:** live discovery readback
**Captured:** 2026-07-11
**Boundary:** no payment, no listing mutation, no ACP job creation

Fia Signals Token Safety Lite is visible in Fia's own x402 discovery, but the
current buyer-native blocker is CDP/Bazaar indexing. The exact lite resource was
not found through CDP merchant lookup or search readbacks during this capture.

## Merchant Lookup

```bash
curl -s "https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F"
```

Observed summary:

```json
{
  "payTo": "0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F",
  "lite_matches": []
}
```

## Resource Searches

The following searches returned zero exact `/token-safety/lite` matches:

```text
base-swap-risk-lite token-safety lite
token safety lite
Fia Signals token safety lite
```

Observed summaries:

```json
{ "query": "base-swap-risk-lite token-safety lite", "lite_matches": [] }
{ "query": "token safety lite", "lite_matches": [] }
{ "query": "Fia Signals token safety lite", "lite_matches": [] }
```

## Binary Classification

Current state: `CDP_BAZAAR_LITE_SETTLED_INDEX_PENDING_OR_BLOCKED`.

This is a named buyer-discovery blocker, not a revenue claim. The next useful
proof is either:

1. A public buyer-native CDP/Bazaar listing URL for `/token-safety/lite`, or
2. exact provider-side rejection/error/latency text with request IDs and
   timestamps.

Until then, strict external revenue remains `USD 0.00`.
