# pip-reads

A dependency-free helper that calls PipTrade Agent public read endpoints and prints the JSON. These reads need no login and no wallet, so any agent can use them to price a token, list markets, or read the token registry before it shapes a trade intent for the user to sign at /app.

## Usage

```
node pip-reads.mjs            all reads
node pip-reads.mjs prices     live token prices
node pip-reads.mjs markets    market list with 24h change and volume
node pip-reads.mjs tokens     the tradeable token registry
node pip-reads.mjs stats      $PIP token stats
node pip-reads.mjs rh         the Robinhood Chain token list
```

Point it at another host with PIP_BASE, for example PIP_BASE=https://piptradedex.xyz node pip-reads.mjs prices.

Trading, quotes, safety, and balances are not here on purpose. Those require the user signed in at /app with their own wallet, and nothing signs on the agent behalf.
