"use client";

import { useMemo } from "react";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";

function units(value: string | null | undefined, decimals: number, maximum = 6) {
  if (value == null) return null;
  try {
    const atomic = BigInt(value);
    const scale = 10n ** BigInt(decimals);
    const whole = atomic / scale;
    const fraction = (atomic % scale).toString().padStart(decimals, "0").slice(0, maximum).replace(/0+$/, "");
    return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""}`;
  } catch {
    return null;
  }
}

function record(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function WalletPage() {
  const { data, loading, error, notify, walletConnected, setConnectWalletOpen } = useProduct();
  const address = data?.wallet.address || null;
  const activeRooms = useMemo(() => data?.workrooms.filter((room) => !new Set(["RELEASED", "REFUNDED", "CANCELLED"]).has(room.status)) || [], [data]);
  const secured = activeRooms.reduce((sum, room) => sum + BigInt(room.listing.budgetAtomic || "0"), 0n);
  const payments = (data?.payments || []).map(record);
  if (loading || error || !data) return <LoadState label="Loading wallet" />;
  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    notify("Address copied", "The verified receiving address is on your clipboard.");
  };
  const available = units(data.wallet.usdcAtomic, 6);
  const nex = units(data.wallet.nexAtomic, 18, 4);

  return <>
    <header className="page-head"><div className="page-head-copy"><span className="page-kicker">Wallet & Payments</span><h1>Money follows confirmed transactions.</h1><p>Balances come from Robinhood Chain; movements stay linked to the record that caused them.</p></div><div className="head-actions">{address ? <button className="btn ghost" onClick={copy}><Icon name="copy" size="sm" /> Copy address</button> : <button className="btn primary" onClick={() => setConnectWalletOpen(true)}>Connect wallet</button>}</div></header>
    <section className="wallet-summary"><article className="wallet-card"><span>Available</span><b>{walletConnected ? available == null ? "Unavailable" : `${available} USDC` : "Not connected"}</b><small>{walletConnected ? (data.wallet.error || "Read from the verified wallet") : "Connect a wallet to read its balance"}</small></article><article className="wallet-card"><span>Secured for active work</span><b>{units(secured.toString(), 6) || "0"} USDC</b><small>{activeRooms.length} Workroom record{activeRooms.length === 1 ? "" : "s"}</small></article><article className="wallet-card"><span>$NEX holding</span><b>{walletConnected ? nex == null ? "Unavailable" : `${nex} NEX` : "Not connected"}</b><small>Read from Robinhood Chain</small></article></section>
    <div className="section-top"><h2>Activity</h2><span>Persisted payment intents</span></div><section className="transaction-list">{payments.length ? payments.map((item) => { const production = record(item.production); return <article className="transaction" key={String(item.id)}><i>{item.status === "CONFIRMED" ? "✓" : "·"}</i><span><b>{String(production.title || item.purpose || "Product payment")}</b><span>{String(item.status || "")}</span></span><time>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : ""}</time><strong>{units(String(item.amountAtomic || "0"), 6) || "0"} USDC</strong></article>; }) : <div className="market-empty"><h2>No payment activity yet.</h2><p>Confirmed and pending product payments will appear here.</p></div>}</section>
  </>;
}
