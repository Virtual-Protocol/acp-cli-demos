export const env = {
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  databaseProvider:
    process.env.DATABASE_PROVIDER === "postgresql" || process.env.DATABASE_URL?.startsWith("postgres")
      ? "postgresql" as const
      : "sqlite" as const,
  databaseUrl:
    process.env.DATABASE_URL?.trim() || process.env.DEV_DATABASE_URL?.trim() || "file:./prisma/dev.db",
  hyperframesVersion: process.env.HYPERFRAMES_VERSION ?? "0.7.56",
  heygenApiUrl: process.env.HEYGEN_API_URL ?? "https://api.heygen.com",
  heygenApiKey: process.env.HEYGEN_API_KEY?.trim() || undefined,
  heygenCallbackSecret:
    process.env.HEYGEN_HYPERFRAMES_CALLBACK_SECRET?.trim() || undefined,
  heygenCallbackUrl:
    process.env.HEYGEN_HYPERFRAMES_CALLBACK_URL?.trim() || undefined,
  robinhoodNetwork: process.env.ROBINHOOD_NETWORK === "mainnet" ? "mainnet" as const : "testnet" as const,
  robinhoodRpcUrl:
    (process.env.ROBINHOOD_NETWORK === "mainnet"
      ? process.env.ROBINHOOD_MAINNET_RPC_URL
      : process.env.ROBINHOOD_TESTNET_RPC_URL)?.trim() || undefined,
  robinhoodChainId: process.env.ROBINHOOD_NETWORK === "mainnet" ? 4663 : 46630,
  robinhoodConfirmations: Math.max(1, Number(process.env.ROBINHOOD_CONFIRMATIONS || "3")),
  usdcAddress: process.env.USDC_ADDRESS?.trim() as `0x${string}` | undefined,
  nexTokenAddress: process.env.NEX_TOKEN_ADDRESS?.trim() as `0x${string}` | undefined,
  pricingRegistryAddress: process.env.NEX_PRICING_REGISTRY_ADDRESS?.trim() as `0x${string}` | undefined,
  productionPaymentsAddress: process.env.NEX_PRODUCTION_PAYMENTS_ADDRESS?.trim() as `0x${string}` | undefined,
  workEscrowAddress: process.env.NEX_WORK_ESCROW_ADDRESS?.trim() as `0x${string}` | undefined,
  disputeResolverAddress: process.env.DISPUTE_RESOLVER_ADDRESS?.trim().toLowerCase() as `0x${string}` | undefined,
  productionOperatorAddress: process.env.OPERATOR_ADDRESS?.trim().toLowerCase() as `0x${string}` | undefined,
  robinhoodWalletRpcUrl: process.env.ROBINHOOD_WALLET_RPC_URL?.trim() || undefined,
  robinhoodExplorerUrl: process.env.ROBINHOOD_EXPLORER_URL?.trim() || undefined,
  robinhoodBridgeUrl: process.env.ROBINHOOD_BRIDGE_URL?.trim() || undefined,
  nexDexChainId: process.env.NEX_DEX_CHAIN_ID?.trim() || "robinhood",
  nexBuyUrl: process.env.NEX_BUY_URL?.trim() || undefined,
  xClientId: process.env.X_CLIENT_ID?.trim() || undefined,
  xClientSecret: process.env.X_CLIENT_SECRET?.trim() || undefined,
  encryptionKey: process.env.NEX_ENCRYPTION_KEY?.trim() || undefined,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME?.trim() || undefined,
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
  reputationNexmindApiUrl: process.env.REPUTATION_NEXMIND_API_URL?.trim() || process.env.NEXMIND_API_URL?.trim() || "https://api.x.ai/v1",
  reputationNexmindApiKey: process.env.REPUTATION_NEXMIND_API_KEY?.trim() || process.env.NEXMIND_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined,
  reputationNexmindModel: process.env.REPUTATION_NEXMIND_MODEL?.trim() || "x-ai-grok-4-20",
  nexmindApiUrl: process.env.NEXMIND_API_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai/",
  nexmindApiKey: process.env.NEXMIND_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined,
  nexmindModel: process.env.NEXMIND_MODEL?.trim() || "gemini-2.0-flash",
  geminiLiveApiKey: process.env.GEMINI_LIVE_API_KEY?.trim() || process.env.NEXMIND_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined,
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-2.0-flash-live-001",
  geminiLiveVoice: process.env.GEMINI_LIVE_VOICE?.trim() || "Puck",
  resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
  emailFrom: process.env.EMAIL_FROM?.trim() || undefined,
  malwareScanUrl: process.env.MALWARE_SCAN_URL?.trim() || undefined,
  malwareScanKey: process.env.MALWARE_SCAN_KEY?.trim() || undefined,
  objectStorageRoot: process.env.OBJECT_STORAGE_LOCAL_ROOT?.trim() || "data/uploads",
  objectStorageEndpoint: process.env.OBJECT_STORAGE_ENDPOINT?.trim() || undefined,
  objectStorageBucket: process.env.OBJECT_STORAGE_BUCKET?.trim() || undefined,
  objectStorageAccessKey: process.env.OBJECT_STORAGE_ACCESS_KEY?.trim() || undefined,
  objectStorageSecretKey: process.env.OBJECT_STORAGE_SECRET_KEY?.trim() || undefined,
  objectStorageRegion: process.env.OBJECT_STORAGE_REGION?.trim() || "us-east-1",
  objectStorageSessionToken: process.env.OBJECT_STORAGE_SESSION_TOKEN?.trim() || undefined,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://lhaelxddyiidmnowypqg.supabase.co",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ""
};
