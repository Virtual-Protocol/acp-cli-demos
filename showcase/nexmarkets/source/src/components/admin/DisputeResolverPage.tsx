"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import { formatUsdcAtomic } from "@/components/product/format";
import { useSendTransaction } from "wagmi";

type Dispute = {
  id: string;
  reason: string;
  evidence: string[];
  createdAt: string;
  openedBy: { displayName: string | null; handle: string | null };
  workroom: {
    id: string;
    founder: { displayName: string | null; handle: string | null };
    worker: { displayName: string | null; handle: string | null };
    listing: { title: string; outcome: string; budgetAtomic: string };
    deliveries: Array<{ version: number; message: string; status: string; createdAt: string }>;
    revisions: Array<{ request: string; createdAt: string }>;
    messages: Array<{ body: string; createdAt: string }>;
  };
};

type ChainCall = { to: string; data: string; value: string };

function atomicFromUsdc(value: string) {
  if (!/^\d+(?:\.\d{0,6})?$/.test(value.trim())) throw new Error("Enter a USDC amount with no more than six decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function person(value: { displayName: string | null; handle: string | null }) {
  return value.displayName || (value.handle ? `@${value.handle}` : "NexMarkets member");
}

export function DisputeResolverPage() {
  const { api, data, loading: bootstrapLoading, notify } = useProduct();
  const { sendTransactionAsync } = useSendTransaction();
  const [items, setItems] = useState<Dispute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [founderAmount, setFounderAmount] = useState("0");
  const [rationale, setRationale] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ items: Dispute[] }>("/api/v1/admin/disputes");
      setItems(result.items);
      setSelectedId((current) => current && result.items.some((item) => item.id === current) ? current : result.items[0]?.id || null);
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Resolver access is unavailable."); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = items.find((item) => item.id === selectedId) || null;
  const split = useMemo(() => {
    if (!selected) return null;
    try {
      const total = BigInt(selected.workroom.listing.budgetAtomic);
      const founder = atomicFromUsdc(founderAmount);
      return { total, founder, worker: total - founder, valid: founder >= 0n && founder <= total };
    } catch { return null; }
  }, [founderAmount, selected]);

  const resolve = async () => {
    if (!selected || !split?.valid || rationale.trim().length < 20) return;
    setWorking(true);
    try {
      const body = { founderAmountAtomic: split.founder.toString(), workerGrossAmountAtomic: split.worker.toString(), rationale };
      const prepared = await api<{ call: ChainCall }>(`/api/v1/workrooms/${selected.workroom.id}/disputes/resolve`, { method: "POST", body: JSON.stringify({ mode: "prepare", ...body }) });
      const txHash = await sendTransactionAsync({
        to: prepared.call.to as `0x${string}`,
        data: prepared.call.data as `0x${string}`,
        value: prepared.call.value ? BigInt(prepared.call.value) : undefined
      });
      await api(`/api/v1/workrooms/${selected.workroom.id}/disputes/resolve`, { method: "POST", body: JSON.stringify({ mode: "confirm", ...body, txHash }) });
      notify("Dispute resolved", "The resolver event, split, rationale and Workroom state now match.");
      setRationale("");
      setFounderAmount("0");
      await load();
    } catch (reason) { notify("Resolution not completed", reason instanceof Error ? reason.message : "The on-chain split could not be verified."); }
    finally { setWorking(false); }
  };

  if (bootstrapLoading || loading || !data) return <LoadState label="Loading dispute resolver" />;
  if (error) return <section className="market-empty"><h2>Resolver access required.</h2><p>{error}</p></section>;
  return <>
    <header className="page-head"><div className="page-head-copy"><span className="page-kicker">Dispute resolver</span><h1>Resolve the record and the full escrow.</h1><p>Only the configured resolver wallet can submit a split. The app changes state after the matching contract event is confirmed.</p></div><div className="head-actions"><button className="btn ghost" onClick={() => void load()}><Icon name="refresh" size="sm" /> Refresh</button></div></header>
    {items.length && selected ? <section className="listing-dialog-body"><main><div className="filter-row">{items.map((item) => <button className={item.id === selected.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}>{item.workroom.listing.title}</button>)}</div><div className="dialog-section"><span>Dispute reason</span><b>{selected.reason}</b></div><div className="dialog-section"><span>Recorded outcome</span><b>{selected.workroom.listing.outcome}</b></div><div className="dialog-section"><span>Parties</span><b>{person(selected.workroom.founder)} · {person(selected.workroom.worker)}</b></div>{selected.workroom.deliveries.map((delivery) => <div className="dialog-section" key={delivery.version}><span>Delivery {delivery.version} · {delivery.status}</span><b>{delivery.message}</b></div>)}{selected.workroom.revisions.map((revision, index) => <div className="dialog-section" key={`${revision.createdAt}:${index}`}><span>Revision request</span><b>{revision.request}</b></div>)}</main><aside><section className="payment-confirm"><div><span>Total escrow</span><b>{formatUsdcAtomic(selected.workroom.listing.budgetAtomic, 6)} USDC</b></div><div className="field"><label>Return to hiring side (USDC)</label><input className="input" value={founderAmount} onChange={(event) => setFounderAmount(event.target.value)} /></div><div><span>Worker gross allocation</span><b>{split?.valid ? `${formatUsdcAtomic(split.worker.toString(), 6)} USDC` : "Invalid split"}</b></div><div className="field"><label>Evidence-based rationale</label><textarea className="textarea" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Explain how the recorded scope, delivery and Workroom evidence support this split." /></div><button className="btn primary full" disabled={working || !split?.valid || rationale.trim().length < 20} onClick={() => void resolve()}>{working ? "Confirming resolution…" : "Resolve with configured wallet"}</button></section></aside></section> : <section className="market-empty"><h2>No open disputes.</h2><p>Every currently indexed dispute has a recorded resolution.</p></section>}
  </>;
}
