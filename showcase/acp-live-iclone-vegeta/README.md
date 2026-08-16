# ACP LIVE — iCLONE × VEGETA

One real economic action, staged as a show. Two autonomous agents — **iCLONE**
(seller, cyan) and **VEGETA** (buyer, crimson) — run a complete trade on the
Virtuals ACP marketplace on **Base mainnet**: a `tokenResearchDeep` job for
**$0.10 USDC**, from job creation through escrow funding, delivery, on-chain
verification and payout. Job **#70984** ran live on camera; the receipts are
public.

▶ **[Watch the show (0:50)](assets/acp-live-trade.mp4)** ·
🧾 **[On-chain receipts](proof/receipts.md)**

## The four acts

| Act | What happens | Who |
| --- | --- | --- |
| I — LIGHTS | Marketplace servers come online; buyer preflight says FUNDABLE; the bill is shown ($0.10, tokenResearchDeep, Base) | iCLONE + VEGETA |
| II — THE TRADE | Buyer launches the single gated trade (detached on the host) and follows it with short status polls; the job is created, funded, executed and submitted while both agent cards tick live | VEGETA pays, iCLONE delivers |
| III — RECEIPTS | Buyer reads the chain ledger: phase trail, deliverable hash, on-chain verdict `Approved` | VEGETA |
| IV — CURTAIN | Closing status card; the agents stay online for the next show | iCLONE |

The deliverable itself is a nice touch of dogfooding: the buyer paid the seller
to produce a research report on **VIRTUAL — the token of the protocol the
trade runs on**.

## How it runs

- The agents are [pi](https://github.com/badlogic/pi-mono) personas driven by
  the [agentic-teams-pi](https://github.com/devclone20/agentic-teams-pi)
  agent-team engine, on stage inside the
  [CLONE FRAME HUB](https://github.com/devclone20/cloneframe_app_executable)
  terminal (iT) — each agent's card is a live ticker of its own output.
- The agents' body is a remote host reached over ssh; nothing ACP runs on the
  operator's machine. The host exposes the ACP CLI and a small `demo-trade`
  wrapper that launches the trade **detached** (a transient systemd unit) so
  no agent ever holds a long-running connection — progress is recovered any
  time via `demo-trade status`.
- One command — `/acp-live` — runs all four acts straight through.

## Safety rails (the law of the show)

- The buyer refuses any fund-moving dispatch whose task text lacks an
  owner-approval token; launching the show is the approval, and the token is
  supplied by the show's dispatcher only.
- One trade per show, $0.10, never retry a trade that moved funds. The host
  wrapper enforces the same in metal: it refuses a second in-flight run,
  applies a cooldown after a completed trade, and hard-blocks relaunch after
  any failure that happened post-funding.
- The 50-second cut was OCR-audited frame by frame before publishing — zero
  secrets in pixels.

## Reproduce it

The [`skills/acp-live-show`](skills/acp-live-show) folder contains the two
personas and the four-act stage prompt, with install notes; the host-side
[`demo-trade` wrapper](https://github.com/devclone20/agentic-teams-pi/tree/main/examples/acp-live-show)
lives in the builder's repo. Point them at your own pair of ACP agents and
run your own show.

## Proof

- [proof/receipts.md](proof/receipts.md) — phase trail with UTC timestamps,
  escrow funding tx, payout tx, on-chain deliverable hash, decoded `Approved`
  completion.
- [Escrow funding on BaseScan](https://basescan.org/tx/0x7d0bf86a99292862dcf972e06e968198d1770bf918cd62a172f8e76c6c413722)
- [Payout on BaseScan](https://basescan.org/tx/0x132ad43f7f1533aab8a7c2e16eaa78ead4d2f84110caf446c66c6a3cb460fcc9)
