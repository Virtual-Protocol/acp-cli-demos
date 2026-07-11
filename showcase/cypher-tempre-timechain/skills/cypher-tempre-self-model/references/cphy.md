# CPHY — the economic metaprogramming layer

CPHY programs **attention, never truth**. A hash-chained local ledger (plus a
read-only on-chain oracle) modulates what the agent *reads of itself* —
retrieval salience, maintenance cadence, faculty availability. The chain is
never edited; PoQ judgment is never for sale.

## The canonical token

The ONE burn instrument this architecture accepts:

```
CPHY — "Cypher Tempre by Virtuals"
Base chain · 0x08Df470d41C11Ba5Cb60242747D76C65Ca52c94c · 18 decimals
```

The contract address is pinned in code (`cphy.CANONICAL_CPHY`). Burns of any
other token against any block are **invisible by construction**: the oracle
queries only this contract, over a fixed allowlist of read-only RPCs, and a
config naming any other token or RPC is refused loudly. No wallet or signing
key is used and no transaction is ever sent. An optional private rotation salt
may be stored locally in the encrypted CPHY vault when the owner enables it.

## Two supplies, one name

- **Local CPHY** is earned: one sealed ring mints `brightness/255` — supply is
  backed by verified cognitive work (I5). It drives the local opcodes.
- **On-chain CPHY** is burned: sent to keyless deposit addresses derived from
  ring/faculty hashes. Burns are observed read-only and are **permanent**.

## The five opcodes + the burn lane

| Op | Command | Effect |
|----|---------|--------|
| OP1 weight | `cphy.py lock basin/shadow`, `bridge` | attention landscape (0.25×–4× clamp) |
| OP2 stake | `cphy.py stake <param>` | RAISE safety floors — never lower (I6) |
| OP3 fund | `cphy.py fund dream/verify` + `tick` | funded self-maintenance cadence |
| OP4 transfer | `export-pack` / `import-pack` | hash-checked, schema/size-guarded, provenance-quarantined grafts (I7) |
| OP5 grant | `--expires` / `--grant-to` on packs | TTL'd lending scopes |
| burn lane | `onchain target/sync/status/gate`, `etch …` | etches, echelons, unlocks (below) |

## Burn = etch (the positive scar)

Every ring has a deterministic **keyless** deposit address (`0x` + first 40
hex of its ring hash). Send CPHY there and the ring is **etched** — a
permanent mark of positive association, the mirror-image of an immune scar.

**⚠️ Deposit addresses have no private key. Tokens sent there are permanently
unspendable (proof-of-burn). Send dust first. The echelon caps at 21 — burns
beyond 21 tokens buy nothing.**

- **Echelon 1–21 = recency bias.** Whole tokens burned set the memory's depth:
  E=1 barely clears the retrieval floor; E=21 reads as freshly lived, pulled
  to just beneath the current turn's best candidate. Later burns deepen.
- **The current turn is never superseded.** Every etch lands strictly below
  the organic top (ceiling = 97% of it), and an etch never *reduces* a score.
- **`etch n --set N`** — per turn, relevance realization surfaces the top-N
  echelon-blended etched memories: the load you choose to pay for.
- **Per-turn observation.** The turn loop calls `turn_sync` (rate-limited,
  fail-soft): burns take effect at turn granularity without manual syncing.


## Consent membrane (v3.24.1)

Anyone who knows a deposit address can burn to it — so by default **burns are
observed but not applied**: detections land in a pending queue, the turn loop
announces them, and only the owner's `cphy.py approve <id>` applies the etch or
unlock (`reject <id>` withholds it, recorded forever; the tokens are burned
either way). Set `approval: "auto"` in `registry/cphy/onchain.json` to restore
consent-free application. Money can knock; only the owner opens the door.

## Faculty unlocks (RPG skill points)

```
python3 cphy.py etch faculty --kind sense --id 112   # prints its address
# burn 1 CPHY there → next turn/sync: permanently unlocked
```

Unlocking requires an **observed on-chain burn — there is no CLI or config
path to unlock** (selftest-enforced). An unlocked faculty becomes active +
`pinned`: rent-exempt, never hibernated again. Registry-only mutation:
model-authored coded ops still require the explicit human `cambium activate`.

## The invariants (what no amount of CPHY can do)

| # | Guarantee |
|---|-----------|
| I1 | Tokens buy salience, never brightness — PoQ never reads a weight |
| I2 | Density modulation clamped 0.25×–4×; etches capped below the current top |
| I3+ | Scars/covenants refuse shadows; the burn lane is basins-only — suppression cannot be purchased at all |
| I4 | Append-only hash-chained ledger; state replays deterministically offline |
| I5 | Local supply is earned from PoQ brightness; external burns never mint it |
| I6 | Stakes raise safety floors only, never lower them |
| I7 | Imported mass is provenance-quarantined; histories are never inherited |
| — | Only the canonical CPHY contract is observed; fixed RPC allowlist; read-only, keyless, no transactions ever |

## Quick start

```bash
    python3 cphy.py selftest          # must finish with SELFTEST PASS
python3 cphy.py mint && python3 cphy.py balance
python3 cphy.py onchain target --from <a> --to <b>   # get deposit addresses
# … burn CPHY on Base …
python3 cphy.py onchain sync && python3 cphy.py etch status
python3 cphy.py attest            # notarize the economy into the chain
```
