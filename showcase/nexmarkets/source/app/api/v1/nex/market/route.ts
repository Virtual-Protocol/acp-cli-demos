import { env } from "@/lib/env";
import { json, problem, requestId } from "@/lib/http";

export const runtime = "nodejs";
type Pair = { priceUsd?: string; priceChange?: { h24?: number }; marketCap?: number; fdv?: number; volume?: { h24?: number }; liquidity?: { usd?: number }; pairAddress?: string; url?: string; quoteToken?: { symbol?: string } };

export async function GET(request: Request) {
  const id = requestId(request);
  if (!env.nexTokenAddress) return json({ status: "prelaunch", contract: null, buyUrl: env.nexBuyUrl || null, chainId: env.robinhoodChainId }, id);
  try {
    const endpoint = `https://api.dexscreener.com/tokens/v1/${encodeURIComponent(env.nexDexChainId)}/${encodeURIComponent(env.nexTokenAddress)}`;
    const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}.`);
    const pairs = await response.json() as Pair[];
    const pair = (Array.isArray(pairs) ? pairs : []).sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
    if (!pair) throw new Error("The configured $NEX contract has no indexed market pair yet.");
    return json({ status: "live", contract: env.nexTokenAddress, buyUrl: env.nexBuyUrl || pair.url || null, chainId: env.robinhoodChainId, price: Number(pair.priceUsd), change24: Number(pair.priceChange?.h24), marketCap: Number(pair.marketCap || pair.fdv), volume24: Number(pair.volume?.h24), liquidity: Number(pair.liquidity?.usd), pairAddress: pair.pairAddress || null, pairUrl: pair.url || null, quote: pair.quoteToken?.symbol || null, updatedAt: new Date().toISOString() }, id);
  } catch (error) {
    return problem(id, 502, "NEX_MARKET_UNAVAILABLE", "$NEX market feed unavailable", error instanceof Error ? error.message : "The verified market provider could not be reached.");
  }
}
