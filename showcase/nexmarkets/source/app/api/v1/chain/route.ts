import { env } from "@/lib/env";
import { json, requestId } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  return json({
    network: env.robinhoodNetwork,
    name: env.robinhoodNetwork === "mainnet" ? "Robinhood Chain" : "Robinhood Chain Testnet",
    chainId: env.robinhoodChainId,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    walletRpcUrl: env.robinhoodWalletRpcUrl || null,
    explorerUrl: env.robinhoodExplorerUrl || null,
    bridgeUrl: env.robinhoodBridgeUrl || null,
    usdcAddress: env.usdcAddress || null,
    nexTokenAddress: env.nexTokenAddress || null,
    nexBuyUrl: env.nexBuyUrl || null
  }, id);
}
