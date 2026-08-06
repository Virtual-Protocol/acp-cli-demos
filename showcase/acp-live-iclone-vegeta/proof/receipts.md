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

| Movement | Amount | Tx |
| --- | --- | --- |
| Buyer → ACP escrow (funding) | 0.10 USDC | [`0x7d0bf86a…3722`](https://basescan.org/tx/0x7d0bf86a99292862dcf972e06e968198d1770bf918cd62a172f8e76c6c413722) — 17:02:57 UTC |
| Escrow → seller (release after Approved) | 0.09 USDC | [`0x132ad43f…fcc9`](https://basescan.org/tx/0x132ad43f7f1533aab8a7c2e16eaa78ead4d2f84110caf446c66c6a3cb460fcc9) — 17:04:03 UTC |

The 0.01 USDC difference is the ACP protocol fee taken at settlement.
Escrow contract (Base): `0x238E541BfefD…` — visible as the counterparty in
both transactions.

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
