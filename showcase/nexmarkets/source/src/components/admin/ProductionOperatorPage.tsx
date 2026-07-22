"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import { formatUsdcAtomic } from "@/components/product/format";
import { useSendTransaction } from "wagmi";

type ProductionItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  owner: { displayName: string | null; handle: string | null };
  paymentIntents: Array<{ amountAtomic: string; payer: string; status: string }>;
  approvals: Array<{ note: string | null; createdAt: string }>;
  currentVersion: { outputObjectKey: string | null; approvedAt: string | null } | null;
};
type ChainCall = { to: string; data: string; value: string };

export function ProductionOperatorPage() {
  const { api, data, loading: bootstrapLoading, notify } = useProduct();
  const { sendTransactionAsync } = useSendTransaction();
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ items: ProductionItem[] }>("/api/v1/admin/productions");
      setItems(result.items);
      setSelectedId((current) => current && result.items.some((item) => item.id === current) ? current : result.items[0]?.id || null);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Operator access is unavailable."); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = items.find((item) => item.id === selectedId) || null;
  const action = selected?.status === "APPROVED" ? "settle" : "refund";

  const submit = async () => {
    if (!selected || (action === "refund" && reason.trim().length < 10)) return;
    setWorking(true);
    try {
      const body = { action, reason: action === "refund" ? reason : undefined };
      const prepared = await api<{ call: ChainCall }>(`/api/v1/productions/${selected.id}/settlement`, { method: "POST", body: JSON.stringify({ mode: "prepare", ...body }) });
      const txHash = await sendTransactionAsync({
        to: prepared.call.to as `0x${string}`,
        data: prepared.call.data as `0x${string}`,
        value: prepared.call.value ? BigInt(prepared.call.value) : undefined
      });
      await api(`/api/v1/productions/${selected.id}/settlement`, { method: "POST", body: JSON.stringify({ mode: "confirm", ...body, txHash }) });
      notify(action === "settle" ? "Payment settled" : "Payment refunded", "The verified contract event and production payment state now match.");
      setReason("");
      await load();
    } catch (cause) { notify("Payment action not completed", cause instanceof Error ? cause.message : "The production payment event could not be verified."); }
    finally { setWorking(false); }
  };

  if (bootstrapLoading || loading || !data) return <LoadState label="Loading production operator" />;
  if (error) return <section className="market-empty"><h2>Operator access required.</h2><p>{error}</p></section>;
  return <>
    <header className="page-head"><div className="page-head-copy"><span className="page-kicker">Production payment operator</span><h1>Settle approved work. Refund recorded failures.</h1><p>Each action is limited by production state and confirmed only from the configured operator wallet.</p></div><div className="head-actions"><Link className="btn ghost" href="/admin/disputes">Open dispute resolver</Link><button className="btn ghost" onClick={() => void load()}><Icon name="refresh" size="sm" /> Refresh</button></div></header>
    {items.length && selected ? <section className="listing-dialog-body"><main><div className="filter-row">{items.map((item) => <button className={item.id === selected.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}>{item.title}</button>)}</div><div className="dialog-section"><span>Production</span><b>{selected.title} · {selected.kind}</b></div><div className="dialog-section"><span>Owner</span><b>{selected.owner.displayName || (selected.owner.handle ? `@${selected.owner.handle}` : "NexMarkets member")}</b></div><div className="dialog-section"><span>Current state</span><b>{selected.status.replaceAll("_", " ")}</b></div><div className="dialog-section"><span>Payment</span><b>{formatUsdcAtomic(selected.paymentIntents[0].amountAtomic, 6)} USDC · {selected.paymentIntents[0].status}</b></div>{selected.approvals[0]?.note ? <div className="dialog-section"><span>Owner request</span><b>{selected.approvals[0].note}</b></div> : null}</main><aside><section className="payment-confirm"><span className={`pill ${action === "settle" ? "green" : "red"}`}>{action === "settle" ? "Ready to settle" : "Refund review"}</span><h2>{action === "settle" ? "Move approved payment to treasury." : "Return the full payment to its payer."}</h2>{action === "refund" ? <div className="field"><label>Recorded refund reason</label><textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the failure or accepted cancellation behind this refund." /></div> : <p>The final version has owner approval and is eligible for settlement.</p>}<button className="btn primary full" disabled={working || action === "refund" && reason.trim().length < 10} onClick={() => void submit()}>{working ? "Confirming event…" : action === "settle" ? "Settle with operator wallet" : "Refund with operator wallet"}</button></section></aside></section> : <section className="market-empty"><h2>No production payments need action.</h2><p>There are no approved settlements, failures or owner refund requests awaiting the operator.</p></section>}
  </>;
}
