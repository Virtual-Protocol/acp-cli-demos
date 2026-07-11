# CPHY Agent Token Proof

Captured on `2026-07-11` with unauthenticated public endpoints and the packaged
skill's read-only CPHY lane.

## Virtuals project identity

Filtered response from `https://api2.virtuals.io/api/virtuals/37924`:

```json
{
  "id": 37924,
  "name": "Cypher Tempre",
  "symbol": "CPHY",
  "chain": "BASE",
  "tokenAddress": "0x08Df470d41C11Ba5Cb60242747D76C65Ca52c94c",
  "status": "AVAILABLE",
  "factory": "BONDING",
  "verifiedLinks": {
    "TWITTER": "https://x.com/cyberphysicsai",
    "WEBSITE": "https://cyberphysics.ai/"
  }
}
```

Public project page: https://app.virtuals.io/virtuals/37924

Public token explorer:
https://basescan.org/token/0x08Df470d41C11Ba5Cb60242747D76C65Ca52c94c

## Independent Base RPC check

`eth_chainId` on `https://mainnet.base.org` returned `0x2105` (Base mainnet,
decimal `8453`). `eth_getCode` for the same token address returned non-empty
contract code (`45` bytes at the queried address).

## Skill integration check

The packaged `cphy.py` pins the same address and only accepts three public,
read-only Base RPC endpoints. Its `onchain sync` command queried ERC-20
`balanceOf` for a disposable keyless target using `eth_call` and returned:

```json
{
  "observed": {},
  "changed": false,
  "errors": [],
  "new_etches": [],
  "new_unlocks": [],
  "pending_approval": [],
  "awaiting": 0,
  "total_burned_to_blockspace": 0
}
```

No wallet address, signature, token transfer, burn, approval, transaction, or
private RPC was used. A zero balance proves the read path, not an economic
effect. This bounded evidence is why `showcase.json` declares only the `token`
primitive and does not declare `wallet` or `acp`.
