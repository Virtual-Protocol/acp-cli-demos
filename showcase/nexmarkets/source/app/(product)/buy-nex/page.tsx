"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";

type ChainConfig = { nexBuyUrl: string | null };

function nexUnits(value: string | null | undefined) {
  if (!value) return 0;
  try { return Number(BigInt(value) / 10n ** 18n); } catch { return 0; }
}

async function endpoint<T>(path: string): Promise<T | null> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => null) as { data?: T } | null;
  return response.ok && payload?.data ? payload.data : null;
}

export default function Page() {
  const router = useRouter();
  const { data, loading, error, refresh, connectWallet, notify } = useProduct();
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void endpoint<ChainConfig>("/api/v1/chain").then((chain) => { if (!cancelled) setBuyUrl(chain?.nexBuyUrl || null); });
    return () => { cancelled = true; };
  }, []);
  if (loading || error || !data) return <LoadState label="Loading $NEX access" />;
  const required = 50_000;
  const balance = nexUnits(data.wallet.nexAtomic);
  const ready = Boolean(data.wallet.address) && balance >= required;
  const remaining = Math.max(0, required - balance);
  const openBuy = () => {
    if (buyUrl) window.open(buyUrl, "_blank", "noopener,noreferrer");
    else notify("Official listing not configured", "Set NEX_BUY_URL to the verified $NEX listing before enabling purchases.");
  };
  return <section className="nex-buy-page"><header className="nex-buy-hero"><span className="page-kicker">PROFILE ENHANCEMENT</span><h1>{ready ? "Your wallet already qualifies." : "Get the $NEX needed to speak with NexMind."}</h1><p>{ready ? "Return to Reputation and begin the live profile session." : "Hold 50,000 $NEX in your connected wallet to enhance your NexCard and public profile. You keep full custody; there is no staking or token lock."}</p></header><section className="nex-buy-layout"><main className="nex-buy-card"><span>ACCESS CHECK</span><div className="nex-buy-balance"><small>Connected wallet</small><strong>{data.wallet.address ? `${balance.toLocaleString()} $NEX` : "Not connected"}</strong></div><dl><div><dt>Required holding</dt><dd>50,000 $NEX</dd></div><div><dt>{ready ? "Access" : "Still needed"}</dt><dd>{ready ? "Ready" : `${remaining.toLocaleString()} $NEX`}</dd></div><div><dt>Staking or locking</dt><dd>Not required</dd></div></dl><div className="nex-buy-actions">{ready ? <button className="btn primary" onClick={() => router.push("/reputation")}>Return to Reputation <Icon name="arrow" size="sm" /></button> : <><button className="btn primary" onClick={openBuy}>Buy $NEX on Virtuals <Icon name="external" size="sm" /></button><button className="btn ghost" onClick={() => data.wallet.address ? void refresh() : connectWallet()}>Check wallet again</button></>}</div></main><aside className="nex-buy-note"><span>BUY SAFELY</span><h2>Use the official Virtuals market.</h2><p>Search for <b>$NEX</b>, confirm the NexMarkets name and verify the official contract address published by NexMarkets before approving the purchase.</p><small>NexMarkets never asks you to send tokens to unlock access.</small><button className="btn text" onClick={() => router.push("/reputation")}>Back to Reputation</button></aside></section></section>;
}
