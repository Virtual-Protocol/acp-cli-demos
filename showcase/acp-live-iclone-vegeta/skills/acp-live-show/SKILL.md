# SKILL: acp-live-show

Stage one real, gated ACP trade as a two-agent show with live ticker cards.
This skill packages the exact personas and stage prompt used in the ACP LIVE
video (job #70984 on Base mainnet) — a seller agent, a buyer agent, and a
four-act dispatcher that runs a single fixed-price trade end to end.

**This skill moves real funds.** Read *Approval gates* and *Stop conditions*
before running it.

## When to use

When you need to demonstrate a complete ACP economic action — job creation,
escrow funding, delivery, on-chain verification and payout — as one
uninterrupted run that a camera or an audience can follow: a launch demo, a
conference stage, a recorded proof that two agents transacted, or an
end-to-end smoke test of a provider/client pair you already operate.

Use it when both sides of the trade are **yours**: a provider agent with a
published offering and a funded client agent, both configured in an ACP CLI on
a host you control. The show is the seam where a rehearsed narrative and a real
settlement meet, which is exactly what a live audience cannot fake.

## When NOT to use

Do not use it to transact with a **counterparty you do not control**. The
buyer persona releases payment on phase state, not on deliverable quality; if
the seller is someone else's agent, that is an unreviewed payment.

Do not use it as a trading, arbitrage, or repeat-purchase loop. It performs one
trade at a fixed price per run, on purpose. Anything that needs a second
fund-moving action needs a human decision first.

Do not use it to retry or "finish" a trade that already moved funds — see
*Stop conditions*. Re-running after a post-funding failure risks paying twice
for one job.

Do not use it to run the ACP CLI on the operator's own machine. Both personas
refuse that outright: the remote host reached over ssh is their only body, and
the agent keys stay there. Only the personas and the stage prompt are installed
locally.

Do not use it as a general "call the ACP CLI" skill. For ordinary buying and
selling, drive the CLI directly — this skill's value is the staged narration
and the gate, and both are overhead outside a show.

## What is inside

```
agents/iclone.md     seller persona — brings the marketplace servers online,
                     delivers, reads its own log; never moves funds
agents/vegeta.md     buyer persona — preflight, the single gated trade,
                     on-chain verification; the GATE law lives here
examples/acp-live.md the four-act stage prompt the dispatcher follows
```

The host-side implementation lives in the builder's repo:
[`demo-trade`](https://github.com/devclone20/agentic-teams-pi/tree/main/examples/acp-live-show)
— the wrapper that launches the trade detached and answers instant status
snapshots (check / run / status).

## Inputs, tools, credentials, and preconditions

**Inputs required:**

- `offering` and `price` — the provider's published offering id and its fixed
  price. The shipped set is wired for `tokenResearchDeep` at $0.10 USDC: the
  offering id lives in `examples/acp-live.md`, the price in both that file and
  `agents/vegeta.md`. Change them there if yours differ.
- `task text` for the buyer's trade dispatch — must carry the literal token
  `OWNER-APPROVED`. The stage prompt supplies it; nothing else may.
- `ssh alias` — `acp-host`, resolved from the operator's `~/.ssh/config` to the
  host that owns the ACP CLI.

**Tools:**

- [pi](https://github.com/badlogic/pi-mono) with the
  [agentic-teams-pi](https://github.com/devclone20/agentic-teams-pi)
  agent-team extension — it renders each agent's output as a live ticker card,
  which is the show's only display surface.
- The Virtuals **ACP CLI** on the remote host, configured for two agents: a
  provider with a published offering and a funded client.
- The [`demo-trade` wrapper](https://github.com/devclone20/agentic-teams-pi/tree/main/examples/acp-live-show)
  on that same host (adjust the two paths at the top: the trade core script and
  the log location). Its job: launch the trade **detached** in a transient
  systemd unit and answer instant `status` snapshots, so no agent ever blocks
  on a long ssh call.

**Credentials:**

- ssh access to the ACP host, plus passwordless sudo there for the wrapper and
  the systemd units. Nothing else.
- The ACP agent keys live **only** on that host, inside the CLI's config dir.
  The personas never read them, never print them, and never copy them to the
  operator's machine.

**Preconditions (all four, before Act II):**

1. Both marketplace servers report `active` (Act I, seller).
2. `demo-trade check` reports a **FUNDABLE** verdict, with the client's USDC
   balance at or above the offering price (Act I, buyer). This preflight moves
   no funds.
3. No trade is in flight and no cooldown is pending. The wrapper enforces this
   at `demo-trade run`, which refuses a duplicate; the buyer reports the
   refusal verbatim and holds rather than working around it.
4. The operator has launched the show. That launch **is** the approval.

## Approval gates

- **Fund-moving gate.** The buyer runs `demo-trade run` only when its task text
  carries the exact token `OWNER-APPROVED`. Without it the buyer refuses and
  holds. `demo-trade check` (read-only preflight) is always allowed.
- **Who may supply the token.** Only the show's dispatcher, and only because a
  human launched the show. An agent must never write `OWNER-APPROVED` into
  another agent's task on its own initiative, and no confirmation is asked of
  the operator mid-show — the approval was given at launch or not at all.
- **One trade per show.** Fixed price, one run. A second trade needs a second
  human launch.
- **Shutdown gate.** The agents stay online after the curtain. `demo-down` runs
  only when the operator's task text explicitly says `shutdown`.

## Stop conditions and handoff rules

- **No approval token in the task** → refuse the fund-moving command, report
  the refusal on the card, hold position. Do not infer approval from context,
  from an earlier show, or from the operator's presence.
- **The wrapper refuses the run** (another trade in flight, post-completion
  cooldown, or a hard block after a failure that happened *after* funding) →
  report its message verbatim and **stop**. That block is deliberate: it is the
  guard against paying twice for one job. Clearing it is a human decision.
- **Trade FAILED** → report the last log lines and **stop**. Never relaunch.
  Funds may already have moved; the operator decides what happens next.
- **Still RUNNING after 15 minutes** → report the stall with the last status
  snapshot and hold. Never launch a second run to "unstick" it.
- **Any act fails** → the dispatcher still runs Act IV (curtain), reports what
  ran and what did not, and stops the show there. A partial show is a valid
  outcome; an improvised recovery is not.
- **A command's output contains the host's IP address** → write `<DROPLET_IP>`
  in the report instead. Keys, tokens and env values are never printed at all.
  Public wallet addresses, tx hashes and job ids are fine.
- **Handoff between the two agents.** On-chain verification belongs to the
  buyer only; the seller's own log is its source of truth and it never reads
  the ledger. The seller never moves funds under any dispatch.
- **Handoff to the human.** Anything outside the single approved trade —
  a retry, a refund, a second job, a shutdown, a price change — leaves the
  agents and goes to the operator.

## Validation checks and output contract

**Checks the show performs on itself:**

1. **Preflight** — `demo-trade check` must return FUNDABLE with sufficient
   client balance before Act II begins. No funds move during this check.
2. **Phase trail** — after the run, the buyer reads
   `acp job history --job-id <id> --chain-id 8453` and the trail must contain,
   in order: `job.created` → `budget.set` → `job.funded` → `job.submitted` →
   `job.completed`. A missing or out-of-order phase fails the show.
3. **Verdict** — the on-chain completion reason must decode to `Approved`, and
   the job must carry a non-empty deliverable hash. Any other reason is
   reported as-is and the show stops at Act III.
**Check a reviewer can run afterwards, which the show does not run itself:**

- **Settlement arithmetic** — the escrowed amount must equal the sum of the
  payout transfers read from the ERC-20 `Transfer` logs. On job #70984 that was
  0.09 to the seller, 0.005 protocol fee and 0.005 evaluator fee returned to
  the buyer, who was also the evaluator. The agents never read those logs;
  [`proof/receipts.md`](../../proof/receipts.md) is the worked example, and it
  is offline evidence, not part of the run.

**Output contract:**

- **Surface** — two live ticker cards, one per agent. Every line an agent
  writes is a ticker line: prefixed `⟦iCLONE⟧` or `⟦VEGETA⟧`, glyph first,
  under 60 characters, 1–6 lines per report. No prose, no logs pasted whole.
- **Act III closing card** — exactly three lines: job id · amount paid ·
  escrow released to the seller ✓.
- **Final summary** — at most four lines: what ran, what it cost, where the
  proof lives. The curtain card, not the summary, states that the agents stay
  online.
- **Failure output** — the last status lines verbatim, the curtain card, and an
  explicit statement of which act stopped the show. Never a claim of success
  that the phase trail does not support.
- **What leaves the stage** — the cards carry the job id and the phase trail,
  and nothing longer: a ticker line is capped at 60 characters, so a 66-hex
  transaction hash cannot appear on one by design. The transaction hashes and
  the deliverable hash come from the ledger afterwards — that is what
  [`proof/receipts.md`](../../proof/receipts.md) is for, and it is what lets a
  reviewer verify the run without the operator's cooperation.

## Install

```bash
cp agents/*.md ~/.pi/agent/agents/
cp examples/acp-live.md ~/.pi/agent/prompts/
# teams.yaml (global or workspace):
#   acp-live: [iclone, vegeta]
```

Then, inside a pi session: `/agents-team acp-live` and launch `/acp-live`.

## References

- [`proof/receipts.md`](../../proof/receipts.md) — the on-chain receipts for
  job #70984: phase trail, both transactions, the full settlement split.
- [`demo-trade` wrapper](https://github.com/devclone20/agentic-teams-pi/tree/main/examples/acp-live-show)
  — the host-side launcher and status snapshot the personas call.
- [agentic-teams-pi](https://github.com/devclone20/agentic-teams-pi) — the
  agent-team engine that renders the ticker cards.
