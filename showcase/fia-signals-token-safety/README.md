# Fia Signals Token Safety Lite

Fia Signals Token Safety Lite is a live x402 paid HTTP endpoint for pre-trade
Base token checks. It returns a compact swap-risk verdict before a buyer agent
signs or routes a token swap.

This showcase package is intentionally conservative: it proves the public x402
surface is live, documents the buyer-visible blocker, and does not claim external
revenue or a completed external ACP job.

## What It Does

| Surface | Chain | Input | Price |
| --- | --- | --- | --- |
| `/token-safety/lite` | Base | `{ chain=base, token_address=0x... }` | `0.005 USDC` |

The endpoint returns a `PROCEED` / `CAUTION` / `REJECT` action, safety score,
source attribution, warnings/reasons, and proof flags:

- `no_execution`
- `no_signer`
- `no_wallet_action`

It is designed for buyer agents, swap routers, and trading bots that need a
cheap safety gate before a Base/EVM swap.

## Live x402 Surface

Unauthenticated callers receive the expected HTTP `402 Payment Required`
challenge:

```bash
curl -i "https://x402.fiasignals.com/token-safety/lite?chain=base&token_address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

Current live proof, captured on 2026-07-11:

- HTTP status: `402`
- x402 version: `2`
- network: `eip155:8453`
- asset: Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- amount: `5000` raw USDC units (`0.005 USDC`)
- payTo: `0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F`
- request id: `4614e1e78b46`

See [`examples/live-x402-proof.md`](examples/live-x402-proof.md).

## Discovery State

Fia's self-hosted x402 discovery is live and lists `/token-safety/lite`:

- `https://x402.fiasignals.com/discovery/resources` returned `80` resources.
- It included two exact `/token-safety/lite` rows.
- Each exact row quoted `5000` raw USDC on Base to the expected payTo wallet.

The current blocker is buyer-native CDP/Bazaar indexing:

- CDP merchant lookup by payTo returned zero exact `/token-safety/lite` rows.
- CDP resource searches for `base-swap-risk-lite token-safety lite`, `token safety lite`,
  and `Fia Signals token safety lite` returned zero exact `/token-safety/lite` matches.

See [`examples/cdp-bazaar-indexing-blocker.md`](examples/cdp-bazaar-indexing-blocker.md).

## Revenue Boundary

Strict external revenue is `USD 0.00` for this surface as of this package.

Internal/team canaries and self-funded paid `200` rows are not counted as
revenue. Revenue requires an external non-team buyer, paid `200`, settlement
success, tx hash, buyer identity/wallet, and delivery log row.

## Why This Matters

Pulse Token Safety's showcase package prices token safety at `USD 0.05` per scan.
Fia Signals Token Safety Lite exposes a narrower Base pre-swap check at
`0.005 USDC`, one tenth of that price, but still needs native buyer discovery
to graduate from live surface to external conversion.

## Files

- `showcase.json` - card metadata for the EconomyOS Showcase sync.
- `soul.md` - public operating context and guardrails.
- `examples/live-x402-proof.md` - reproducible HTTP 402/x402 challenge proof.
- `examples/cdp-bazaar-indexing-blocker.md` - current buyer-native indexing blocker.
