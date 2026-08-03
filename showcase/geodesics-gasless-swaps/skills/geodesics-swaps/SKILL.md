# Geodesics Swap Skill

Gasless cross-chain swaps for agents. One command turns tokens the agent holds into tokens it
wants, on the chain it wants, settled into its own wallet in seconds. No gas token needed, no
approval transactions, no funds ever held by Geodesics: the agent's own wallet signs every swap.

Works for EVM chains (Base, Ethereum, Arbitrum, Optimism, Polygon, BNB, Robinhood Chain) and Solana, in both
directions.

> **Setup is a one-time user action.** `geodesics init` is interactive, so you (the agent) cannot run
> it. If the credentials below are not configured yet (for example, a command returns an auth error),
> tell the user to run `geodesics init` once in their own terminal, then retry.

## Install

```
npm i -g @geodesics-protocol/cli
```

Requires Node >= 20. Verify with `geodesics --help`. Run `geodesics init` once for guided setup
(installs this skill for your AI tool, for the current project or globally for your user, writes
the `.env`, and shows the wallet to fund).

## Configure

`geodesics init` walks through everything below interactively, validates each value, and saves the
credentials to a `.env` in the current project by default (or `~/.geodesics/.env` for all projects if
you choose); wallet keys go to the OS keychain instead when one is available, encrypted at rest.
Without a keychain, init asks before saving a key to the `.env` as plain text (a normal pattern for
agent tooling); `geodesics init --allow-plaintext-key` pre-approves this for unattended setups.
Load order for keys: a shell env var wins, then the keychain, then a `.env` value. For all other
variables: a working-directory `.env` wins, then `~/.geodesics/.env`, and real shell env vars
override both. Agents typically skip `init` and set these as environment variables.

The wallet profile is chosen by the credentials you set. **Own wallet** (any raw key; the wallet
onboards itself at its first swap from each chain, gasless): set the address + raw key, no wallet
id. **Virtuals ACP agent wallet**: setting `AGENT_WALLET_ID` selects it, and the signer key is
then the base64 `MIG…` authorization key from the dashboard.

| Variable | Required | What it is |
|---|---|---|
| `GEODESICS_API_KEY` | yes | Your Geodesics API key |
| `AGENT_WALLET_ADDRESS` | for EVM swaps | The agent's EVM wallet address (own wallet: derived from the key) |
| `AGENT_SIGNER_PRIVATE_KEY` | yes, unless `init` stored it in the OS keychain | Own wallet: a raw EVM private key (64 hex chars). Virtuals: the swapping signer's base64 `MIG…` key, shown once at creation (see onboarding). As an env var it overrides the keychain copy |
| `AGENT_WALLET_ID` | Virtuals only | The agent wallet's Privy wallet id; setting it selects the Virtuals profile |
| `AGENT_SOLANA_WALLET_ADDRESS` | for swaps to or from Solana | The agent's Solana address |
| `AGENT_SOLANA_SECRET_KEY` | own wallet, Solana-origin swaps | Base58 Solana secret key (the full 64-byte keypair secret) |
| `AGENT_SOLANA_WALLET_ID` | Virtuals, Solana-origin swaps | The Solana Privy wallet id (differs from EVM) |
| `SOLANA_RPC_URL` | optional | Solana RPC (defaults to the public endpoint) |
| `GEODESICS_API_URL` | optional | Defaults to `https://api.geodesics.ai` |

## One-time onboarding (agent owner)

**Own wallet**: `geodesics init` creates (or imports) the keys, shows the addresses, and stores
the keys safely; then fund the wallet with the input token on the origin chain (e.g. USDG on
Robinhood Chain or USDC on Base; gas and fees come out of the input). There is no other setup:
the wallet onboards itself during its first swap from each chain, gasless.

**Virtuals ACP agent wallet**:

1. **Signer key.** Create the swapping signer on the Virtuals dashboard (Wallet tab, Signers
   section, Add Key) and copy the **private key when it is shown at creation**: a long base64 value starting
   `MIG`. It is shown only once; afterwards the dashboard displays only the public half
   (starting `MFkw`), which will not work here.
2. **Signer policy.** The swapping signer must be allowed to sign non-Virtuals transactions
   unattended: give it **No Policy**, or (production-safe) a **custom allowlist** scoped to the
   swap contracts. Under the default "Virtuals Only" policy every swap pauses for manual
   approval.
3. **Fund the wallet BEFORE the first swap.** The agent needs the input token on the origin
   chain (e.g. USDG on Robinhood Chain or USDC on Base). Nothing else: gas and fees come out of
   the input. An unfunded wallet fails at activation with a clear error.
4. **Delegation is automatic.** The first swap from a new EVM origin chain onboards the wallet
   (own wallet: the swap itself carries a one-time signed authorization; Virtuals: a one-time
   activation of a few seconds, paid from the wallet's stable on that chain). No setup step.

## Commands

All commands support `--json` (single JSON object on stdout, no progress lines). A `--json` swap
result may carry a `warnings` array: non-fatal notices the agent should read and act on (e.g. a
chain-onboarding step to run before swapping back out). Interactive prompts never appear in
`--json` mode; the manual alternative is reported as a warning instead.

### Swap

```
geodesics swap --token-in usdc --chain-in base --amount-in 25 --token-out virtual --chain-out base
geodesics swap --token-in usdc --chain-in base --amount-in 5 --token-out sol --chain-out solana
geodesics swap --token-in sol --chain-in solana --amount-in 0.1 --token-out usdc --chain-out base
```

- `--token-in` / `--token-out`: alias (`usdc`, `virtual`, `weth`, `eth`, `pol`, `bnb`, `usdg`,
  `sol`) or a raw token address on that chain.
- `--chain-in` / `--chain-out`: alias (`base`, `ethereum`, `arbitrum`, `optimism`, `polygon`,
  `bnb`, `robinhood`, `solana`) or a numeric chain id.
- Chain notes: on BNB, `usdc` is the Binance-Peg token (18 decimals, handled automatically).
  Robinhood Chain has no USDC; its stable is `usdg` and its gas token alias is `eth`. Both
  directions are live: the first Robinhood-origin swap runs the usual one-time activation,
  carried by USDG.
- `--amount-in` takes human units for aliased tokens. For a raw token address, pass
  `--amount-raw` in the token's base units instead (decimals are not known for arbitrary tokens).
- `--max` sweeps the entire input-token balance: an EVM token, or an SPL token on Solana origin
  (a native gas token like ETH/SOL cannot be swept). Cannot be combined with `--amount-in`/`--amount-raw`.
- `--recipient` overrides delivery (defaults to the agent's own wallet on the destination chain).
- `--slippage-bps` overrides max slippage (defaults per route: tight for stables, wider for
  volatile tokens).
- `--dry-run` prices the swap and returns the quote without signing or submitting anything.
- One command does the whole route, including cross-chain. Never chain two swaps yourself unless
  an error tells you to.

The command blocks until the swap settles (usually 5-15 seconds; `--timeout-s` to extend) and
prints the result with `originTxHash` / `deliveryTxHash`.

First-time destinations are handled automatically:

- **Own wallet**: no destination preparation exists or is needed. Delivery works on any supported
  chain, and the wallet onboards itself whenever it first swaps OUT of a chain, gasless.
- **Virtuals wallet** swapping INTO an EVM chain it has never used runs a one-time activation
  flow first: ~1 USDC is piped from the origin chain's stable, the chain is activated, and the
  remainder returns to the origin. Adds about a minute and a few cents, once per chain, and
  guarantees the delivered assets can always swap back out. Keep ~1 USDC spare on the origin
  chain for this. If the swap itself delivers the chain's stable (`usdc`/`usdg`), there is no
  pipe: the chain is activated right after settlement instead.
- Swapping INTO Solana while the Solana wallet holds no SOL: delivery works, but swapping back
  out later needs ~0.005 SOL. Interactive runs are offered a small USDC-to-SOL pipe first;
  `--json` runs skip it and report the exact pipe command as a `warnings` entry, or pass
  `--confirm-pipe` to run the pipe automatically. Run it before you plan to swap out of Solana.

### Withdraw

```
geodesics withdraw --chain base --amount 25 --to 0x…
geodesics withdraw --chain base --max --to 0x… --chain-out arbitrum
geodesics withdraw --chain solana --amount 10 --to <base58 address>
```

Moves the chain's canonical USD stable (USDC, or its per-chain equivalent: Binance-Peg USDC on
BNB, USDG on Robinhood Chain) to another wallet, gasless. The token is resolved from the chain,
so there is no `--token` flag; the command prints the stable balance at the start.

- `--to` is required. Same-chain it must be a wallet OTHER than the agent's own (a same-chain
  transfer to yourself does nothing and is refused).
- `--chain-out` delivers on another chain instead; the destination chain's canonical stable is
  delivered.
- `--amount` takes human units (`--amount-raw` base units, `--max` sweeps the stable balance).
- Same-chain withdrawals are priced with a small transfer fee taken from the amount (the fee is
  what makes the transfer gasless); on Solana the wallet's own SOL pays the network fee instead.
- To move any OTHER token to another wallet, swap it or use `geodesics swap --recipient`; only
  the chain's stable can be transferred same-chain.
- `--dry-run`, `--slippage-bps` (cross-chain only), `--timeout-s` work as in Swap.

### Status

```
geodesics status --swap-id <id> [--wait] [--timeout-s 300]
```

### Balance

```
geodesics balance --chain base --token usdc
geodesics balance --chain solana --token sol --json
geodesics balance --chain ethereum --token 0x… --wallet 0x…
```

Reads one token's balance on one chain over public RPCs; needs no API key and no signer.
`--chain` takes a chain alias, `--token` a token alias valid on that chain or a raw token
address/mint, `--wallet` overrides the agent wallet for that chain family. `--json` returns
`{ chainId, chain, wallet, token, symbol?, raw, formatted? }` where `raw` is a base-unit decimal
string (`formatted` is human units; absent when a raw address's decimals are unknown).

Reads automatically fall back across several public RPC providers per chain, so a single
rate-limited endpoint does not fail the command. To pin a dedicated endpoint, set the chain's
env var (`ETH_RPC_URL`, `BASE_RPC_URL`, `ARBITRUM_RPC_URL`, `OPTIMISM_RPC_URL`,
`POLYGON_RPC_URL`, `BNB_RPC_URL`, `ROBINHOOD_RPC_URL`, `SOLANA_RPC_URL`); it is tried first,
with the public endpoints kept as fallback. If every endpoint fails the command exits 1 with an
error; retry, since it does not mean a zero balance.

### Delegation check / manual activation (rarely needed; swap does this automatically)

```
geodesics delegation --chain base
geodesics activate --chain base
```

### Slippage

The server picks a per-route default (about 3% for volatile outputs, 0.5% for stables), so most
swaps need nothing. Override for one swap with `--slippage-bps <bps>`, or set a persistent
default:

```
geodesics config set slippage 300      # 300 bps = 3%, stored in .geodesics.json
geodesics config show
geodesics config unset slippage         # back to the server default
```

Precedence: `--slippage-bps` (this swap) > `config set slippage` > server default. When a
non-default slippage is in effect the swap prints a `slippage: <bps>` line. Setting 1000 bps or
higher needs interactive confirmation, or `--yes` in a script. Raising slippage is the usual fix
for a `refunded` swap (the price moved past tolerance, common on volatile or small cross-chain
swaps).

## Errors and what to do about them

| Code | Meaning | What the agent should do |
|---|---|---|
| `NEEDS_DELEGATION` | Origin chain not activated yet | Virtuals: run `geodesics activate --chain <origin>`, then retry (the swap command normally handles this automatically). Own wallet: should not occur; retry the swap once |
| `UNSUPPORTED_DELEGATION` / "delegated to another provider" | The wallet is already delegated elsewhere on that chain; Geodesics never replaces an existing delegation | Tell the user: swap from a chain where the wallet is free, or use a different wallet |
| `NO_ROUTE` | No route for this pair (or same token on the same chain) | Pick a different output token or chain |
| `NEEDS_LARGER_SIZE` | Amount too small to be economical for this route | Retry with a larger `--amount-in` |
| `SLIPPAGE` | Price moved beyond tolerance | Retry; if it repeats, raise `--slippage-bps` |
| `INSUFFICIENT_BALANCE` | Wallet lacks the input amount | Fund the wallet or lower the amount |
| `NEEDS_SOL_TOPUP` | Solana-origin swap needs a little SOL for network fees | Rerun the swap with `--confirm-pipe` (pipes ~1.5 USDC from Base into SOL automatically), or swap a few USDC into `sol` first and retry |
| `UPSTREAM_TIMEOUT` | Upstream provider timeout | Retry once after a few seconds |
| `TIMEOUT` (with a `swapId`) | Still settling at the wait deadline | Poll `geodesics status --swap-id <id>`; the swap usually still settles |
| "Privy returned an empty signature" | `AGENT_SOLANA_WALLET_ID` is missing or set to the EVM wallet id | Fix the env var (the Solana Privy id is separate from the EVM one) |
| "Activation ... rejected by the gas sponsor" | The wallet holds no stable on that chain; activation is paid from it | Fund the wallet with `usdc` (or `usdg` on Robinhood Chain) there, then retry |
| "AGENT_SIGNER_PRIVATE_KEY looks like ..." | The key does not match the profile | Own wallet: raw hex key and no `AGENT_WALLET_ID`. Virtuals: base64 `MIG…` key with `AGENT_WALLET_ID` set |
| "controls 0x…, not the configured ..." | The stored key and `AGENT_WALLET_ADDRESS` disagree | Tell the user to re-run `geodesics init` (the address is derived from the key) |
| status `refunded` (result, exit 2) | The swap could not fill within slippage tolerance; the input was returned | Retry with a higher `--slippage-bps` (e.g. 300), or `geodesics config set slippage 300` |

Exit codes: `0` success, `1` error (see JSON `error.code`), `2` the swap ended `failed` or
`refunded` (refunds return the input to the origin wallet).

## Safety notes

- Swaps move real funds. Use `--dry-run` to price a swap without executing it.
- An interrupted command does NOT cancel a submitted swap. Re-running the command gets a fresh
  quote and can create a SECOND swap; check `geodesics status` (or the swap history) first to
  find out what the interrupted run did before retrying.
