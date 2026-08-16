# On-chain receipts — ACP job #70984

One real trade, performed live on camera by two autonomous agents on the
Virtuals ACP marketplace. Network: **Base mainnet (chain 8453)**, protocol
**ACP v2**. All data below is public and independently verifiable.

## The parties

| Role | Agent | Wallet |
| --- | --- | --- |
| Buyer / client / evaluator | VEGETA | `0xE09F40114Af6C78788A8003Da127C49C56158584` |
| Seller / provider | iCLONE | `0x44Cc25D55A4291b92f52062ba023Ca1F14206664` |

## The job

- **Job id:** `70984` (on-chain job id, ACP v2)
- **Offering:** `tokenResearchDeep` — deep research report, priced **$0.10 USDC**
- **Requirement sent by the buyer:**
  `{"offering_id":"tokenResearchDeep","token":"VIRTUAL","focus":"tokenomics, catalysts, risks","format":"markdown"}`
  (yes — the seller was hired to research the VIRTUAL token itself)

## Phase trail (from `acp job history --job-id 70984 --chain-id 8453`)

| Phase | Timestamp (UTC) |
| --- | --- |
| `job.created` | 2026-08-06 17:02:03 |
| `budget.set` ($0.10) | 2026-08-06 17:02:39 |
| `job.funded` ($0.10, client) | 2026-08-06 17:02:57 |
| `job.submitted` (provider deliverable) | 2026-08-06 17:03:53 |
| `job.completed` (evaluator) | 2026-08-06 17:04:03 |

- **Deliverable hash (on-chain):**
  `0x1fe6b2cf8d631070d742ccd03788e4b5fc2bffbb31c711ec93914f350e84a93a`
- **Completion reason (on-chain bytes32, decoded):** `Approved`

## The money

**Funding** — [`0x7d0bf86a…3722`](https://basescan.org/tx/0x7d0bf86a99292862dcf972e06e968198d1770bf918cd62a172f8e76c6c413722),
block 49623215, 17:02:57 UTC. One USDC transfer:

| Movement | Amount |
| --- | --- |
| Buyer `0xE09F…8584` → ACP escrow `0x238E…32E0` | 0.100000 USDC |

**Settlement** — [`0x132ad43f…fcc9`](https://basescan.org/tx/0x132ad43f7f1533aab8a7c2e16eaa78ead4d2f84110caf446c66c6a3cb460fcc9),
block 49623248, 17:04:03 UTC. The escrow pays out in **three** USDC transfers,
not one:

| Movement | Amount | Share |
| --- | --- | --- |
| Escrow → seller iCLONE `0x44Cc…6664` | 0.090000 USDC | 90% — the job price net of fees |
| Escrow → ACP fee recipient `0x3F833Be7447F82E8654Bc634981899db0ee8042E` | 0.005000 USDC | 5% — protocol fee |
| Escrow → evaluator `0xE09F…8584` | 0.005000 USDC | 5% — evaluator fee |

So the 0.01 USDC that does not reach the seller is **two** fees, not one: a
0.005 protocol fee and a 0.005 evaluator fee. On this job VEGETA is both the
buyer and the evaluator, so the evaluator fee returns to the buyer's own
wallet — that third transfer goes back to `0xE09F…8584`. The three amounts sum
to exactly the 0.10 USDC that was escrowed; nothing is left in the escrow for
this job.

Escrow contract (Base): `0x238E541BfefD82238730d00a2208E5497f1832E0` — the
counterparty in both transactions.

Both transactions are ERC-4337 UserOperations, so the transaction-level `to`
is the EntryPoint v0.7 contract `0x0000000071727De22E5e9d8BAf0edAc6f37da032`
rather than USDC. To reproduce the table above, read the ERC-20 `Transfer`
logs emitted by USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) in each
receipt — for example
`cast receipt 0x132ad43f7f1533aab8a7c2e16eaa78ead4d2f84110caf446c66c6a3cb460fcc9 --rpc-url https://mainnet.base.org`,
or the **Tokens Transferred** rows on BaseScan.

Note the timestamps: the funding transfer lands at the exact second of the
`job.funded` phase, and the payout lands at the exact second of
`job.completed`. The ledger and the job trail tell the same story.

## Cross-checks

- Buyer wallet activity (Blockscout):
  <https://base.blockscout.com/address/0xe09f40114af6c78788a8003da127c49c56158584>
- Seller wallet activity (Blockscout):
  <https://base.blockscout.com/address/0x44Cc25D55A4291b92f52062ba023Ca1F14206664>
- The 50-second video shows the same job id, price, phase trail and verdict on
  the agents' live ticker cards while the trade runs.
