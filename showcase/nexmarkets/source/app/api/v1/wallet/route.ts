import { walletSnapshot } from "@/lib/chain";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const wallet = auth.session.user.wallets.find((item) => item.isPrimary) ?? auth.session.user.wallets[0];
  if (!wallet) return json({ configured: false, connected: false, chainId: env.robinhoodChainId, address: null, usdcAtomic: null, nexAtomic: null, nativeAtomic: null }, auth.id);
  try { return json({ connected: true, ...(await walletSnapshot(wallet.address as `0x${string}`)) }, auth.id); }
  catch (error) { return json({ configured: true, connected: true, chainId: env.robinhoodChainId, address: wallet.address, usdcAtomic: null, nexAtomic: null, nativeAtomic: null, error: error instanceof Error ? error.message : "Balances are unavailable." }, auth.id); }
}
