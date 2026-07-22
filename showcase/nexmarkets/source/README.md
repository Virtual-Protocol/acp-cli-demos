# NexMarkets / NexStudio

This workspace converts the supplied product export into a componentized Next.js 16 application. The export HTML is a design reference only: no page reads, imports, embeds, injects, or serves it at runtime. The application remains runnable if that reference file is deleted.

- Next.js pages and React components own the approved product interface.
- Versioned API routes own every persisted query and mutation.
- Prisma 7 owns SQLite development storage and PostgreSQL production storage.
- Local files are used only by development and isolated smoke tests; production source and render artifacts use S3-compatible private object storage with SigV4 requests.
- Hardhat 3 owns Solidity compilation, viem tests, and Robinhood Chain deployment.
- HyperFrames 0.7.56 authors deterministic video bundles and HeyGen managed cloud renders the final MP4.
- Playwright/Chromium renders paid infographic versions separately from the video pipeline.

There is no demo database or fabricated product-data fallback. A new database starts empty. Missing persistence returns an explicit service error; missing provider or chain configuration disables only the affected live workflow with an actionable error.

## Run locally

```bash
cp .env.example .env
npm install --cache .npm-cache
npm run db:generate
npm run db:dev:push
npm run dev
```

The default development configuration uses `prisma/dev.db`. Production must use PostgreSQL, deploy the checked-in migrations, and configure the provider and Robinhood Chain credentials required by the workflows being enabled.

Open `http://localhost:3000`. Runtime readiness is available at `GET /api/v1/health`.

## Product workflow boundaries

All authenticated mutations require a trusted same-origin request and an `Idempotency-Key`.

Studio persists a production and its authorised sources, approved direction, server-derived contract quote, submitted payment transaction, NexMind brief, render job, versioned artifact, review decision, and settlement/refund state. The server reads balances and verifies contract events; the browser cannot assert payment.

Video production requires a confirmed payment, approved NexMind brief, verified Telegram destination, configured HyperFrames/HeyGen credentials, and an HMAC-authenticated callback. No missing-provider path pretends an MP4 exists. Infographics require the fixed 0.10 USDC payment and render a persisted artifact at the requested dimensions through the still renderer.

On the local development server only, `NEXMARKETS_DEV_SIMULATION=true` enables an explicit Studio workflow simulator. It seeds a dev wallet session, simulates the production-payment quote/confirmation, bypasses Telegram and HeyGen gates, builds the HyperFrames composition, and persists a local simulated MP4 artifact so the video workflow can be tested from creation through review. Set `NEXMARKETS_DEV_SIMULATION=false` to force production-style gates during local testing. Production builds never use this simulator.

Marketplace persists public Listings, private Direct Hire offers, fixed-price Service offers and requests, applications, funding reserves, Workrooms, messages, source-backed delivery files, revisions, approval, disputes, resolution, release, refund, and cancellation. State changes that depend on Robinhood Chain are applied only after the matching event reaches the configured confirmation depth and are recomputed if an indexed event is orphaned.

Reputation retrieves authorised X data, stores encrypted provider credentials, derives evidence-linked NexCard fields from the retrieved window, and publishes server-rendered public profiles only after explicit approval. NexMind and external delivery providers fail closed when unconfigured.

## Validation

```bash
npm run lint
npm run db:validate
npm run typecheck
npm test
npm run build
npm run smoke
npm run smoke:browser
npm run contracts:compile
npm run contracts:test
npm run hyperframes:check
```

The smoke suites create isolated SQLite databases, verify that a guest sees no fabricated records, authenticate a temporary wallet, exercise idempotent persisted mutations, and load the component routes without an iframe, embed, or export-file dependency. The browser suite uses headless Chromium/Edge against the built application.

## Robinhood Chain

Contracts use opaque `bytes32` production, Listing, and Workroom identifiers. They never store personal data, transcripts, source text, or media URLs.

```bash
cd contracts
npx hardhat compile
npx hardhat test nodejs test/NexMarkets.ts --no-compile
npx hardhat ignition deploy ignition/modules/NexMarkets.ts \
  --network robinhoodTestnet \
  --parameters ignition/parameters.json
```

Copy `ignition/parameters.example.json` to the ignored deployment parameter file and replace every placeholder. Mainnet remains gated on an external audit, multisig/timelock ownership, verified token addresses, testnet reconciliation, and an explicit unpause decision.
