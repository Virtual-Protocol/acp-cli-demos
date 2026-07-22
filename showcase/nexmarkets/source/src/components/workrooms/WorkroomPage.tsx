"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import type { WorkroomView } from "@/components/product/types";
import { useSendTransaction } from "wagmi";

type Tab = "overview" | "files" | "messages" | "delivery" | "payment";
type PendingAction = "revision" | "dispute" | null;
type ChainAction = { action: string; payloadHash?: string; call: { to: string; data: string; value: string } };

function person(user: WorkroomView["founder"]) { return user.displayName || (user.handle ? `@${user.handle}` : "NexMarkets member"); }
function initials(user: WorkroomView["founder"]) { return person(user).replace("@", "").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase(); }
function usdc(atomic: string | null) {
  if (!atomic) return "Terms recorded in Listing";
  try { const value = BigInt(atomic); const whole = value / 1_000_000n; const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, ""); return `${whole}${fraction ? `.${fraction}` : ""} USDC`; } catch { return "Terms recorded in Listing"; }
}

export function WorkroomPage({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { data, api, notify, refresh: refreshBootstrap, walletConnected, setConnectWalletOpen } = useProduct();
  const { sendTransactionAsync } = useSendTransaction();
  const [room, setRoom] = useState<WorkroomView | null>(null);
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(requestedTab && ["overview", "files", "messages", "delivery", "payment"].includes(requestedTab) ? requestedTab as Tab : "overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionText, setActionText] = useState("");
  const [working, setWorking] = useState(false);
  const [delegationProductionId, setDelegationProductionId] = useState("");
  const [delegationDays, setDelegationDays] = useState(7);
  const [delegateApproval, setDelegateApproval] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const load = useCallback(async () => { try { setRoom(await api<WorkroomView>(`/api/v1/workrooms/${id}`)); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "The Workroom could not be loaded."); } finally { setLoading(false); } }, [api, id]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, [room?.permissions]);
  const isFounder = room?.founderUserId === data?.user?.id;
  const isWorker = room?.workerUserId === data?.user?.id;
  const latest = room?.deliveries[0];
  const scopeLines = useMemo(() => {
    if (!room) return [];
    const source = room.scope.deliverables ?? room.listing.outcome;
    return Array.isArray(source) ? source.map(String) : String(source || "").split("\n").filter(Boolean);
  }, [room]);
  const permissions = room?.permissions && typeof room.permissions === "object" ? room.permissions : {};
  const delegation = permissions.productionDelegation && typeof permissions.productionDelegation === "object" && !Array.isArray(permissions.productionDelegation) ? permissions.productionDelegation as Record<string, unknown> : null;
  const delegationActive = Boolean(delegation && !delegation.revokedAt && typeof delegation.expiresAt === "string" && currentTime !== null && new Date(delegation.expiresAt).getTime() > currentTime);
  const delegatableProductions = (data?.creations || []).filter((creation) => creation.type === "video" && new Set(["PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]).has(creation.status));
  const selectedDelegationProductionId = delegationProductionId || (typeof delegation?.productionId === "string" ? delegation.productionId : "");

  const sendMessage = async () => {
    if (!message.trim()) return;
    setWorking(true); try { await api(`/api/v1/workrooms/${id}/messages`, { method: "POST", body: JSON.stringify({ body: message, attachments: [] }) }); setMessage(""); await load(); notify("Message sent", "The message is now part of this Workroom record."); } catch (reason) { notify("Message not sent", reason instanceof Error ? reason.message : "Try again."); } finally { setWorking(false); }
  };
  const sendTransaction = async (payload: Record<string, unknown>) => {
    if (!walletConnected) {
      setConnectWalletOpen(true);
      throw new Error("Connect your wallet to execute this action.");
    }
    const action = await api<ChainAction>(`/api/v1/workrooms/${id}/actions`, { method: "POST", body: JSON.stringify(payload) });
    return sendTransactionAsync({
      to: action.call.to as `0x${string}`,
      data: action.call.data as `0x${string}`,
      value: action.call.value ? BigInt(action.call.value) : undefined
    });
  };
  const runChainAction = async (payload: Record<string, unknown>, endpoint: string) => {
    setWorking(true);
    try { const txHash = await sendTransaction(payload); await api(`/api/v1/workrooms/${id}/${endpoint}`, { method: "POST", body: JSON.stringify({ ...payload, txHash, action: undefined }) }); setPendingAction(null); setActionText(""); await Promise.all([load(), refreshBootstrap()]); notify("Chain action confirmed", "The matching Robinhood Chain event has been verified and saved."); }
    catch (reason) { notify("Action not completed", reason instanceof Error ? reason.message : "The chain action could not be verified."); }
    finally { setWorking(false); }
  };
  const submitDelivery = async () => {
    if (!deliveryNote.trim()) return;
    setWorking(true);
    try {
      const objectKeys: string[] = [];
      for (const file of deliveryFiles) { const form = new FormData(); form.set("file", file); form.set("rightsAttested", "true"); form.set("isReusable", "false"); const source = await api<{ objectKey: string }>("/api/v1/sources", { method: "POST", body: form }); objectKeys.push(source.objectKey); }
      const payload = { action: "delivery", message: deliveryNote, objectKeys };
      const txHash = await sendTransaction(payload);
      await api(`/api/v1/workrooms/${id}/deliveries`, { method: "POST", body: JSON.stringify({ message: deliveryNote, objectKeys, txHash }) });
      setDeliveryNote(""); setDeliveryFiles([]); await Promise.all([load(), refreshBootstrap()]); notify("Delivery submitted", "The on-chain delivery event and persisted version now match.");
    } catch (reason) { notify("Delivery not submitted", reason instanceof Error ? reason.message : "The delivery could not be verified."); } finally { setWorking(false); }
  };

  const grantDelegation = async () => {
    if (!selectedDelegationProductionId) return;
    setWorking(true);
    try {
      await api(`/api/v1/workrooms/${id}/production-delegation`, { method: "POST", body: JSON.stringify({ productionId: selectedDelegationProductionId, canApproveBrief: delegateApproval, expiresAt: new Date(Date.now() + delegationDays * 24 * 60 * 60 * 1_000).toISOString() }) });
      await Promise.all([load(), refreshBootstrap()]);
      notify("Briefing access granted", "The worker can open only the selected paid production until the stored expiry.");
    } catch (reason) { notify("Access was not granted", reason instanceof Error ? reason.message : "The production permission could not be saved."); }
    finally { setWorking(false); }
  };

  const revokeDelegation = async () => {
    setWorking(true);
    try {
      await api(`/api/v1/workrooms/${id}/production-delegation`, { method: "DELETE" });
      await Promise.all([load(), refreshBootstrap()]);
      notify("Briefing access revoked", "The worker can no longer open the delegated production.");
    } catch (reason) { notify("Access was not revoked", reason instanceof Error ? reason.message : "The production permission could not be removed."); }
    finally { setWorking(false); }
  };

  if (loading) return <LoadState label="Loading Workroom" />;
  if (error || !room) return <section className="market-empty"><h2>No Workroom selected.</h2><p>{error || "Open accepted work from Marketplace to see its real scope, conversation, delivery and escrow state."}</p><Link className="btn primary" href="/marketplace?tab=my-work">Open My work</Link></section>;
  const amount = usdc(room.listing.budgetAtomic);
  return <><header className="workroom-head"><div className="workroom-title"><span className="pill gold">{room.listing.type.replaceAll("_", " ")} · {room.status.replaceAll("_", " ")}</span><h1>{room.listing.title}</h1><p>Scope, decisions, delivery and escrow stay in one durable record.</p></div><div className="workroom-facts"><div className="workroom-fact"><span>Participants</span><b>{person(room.founder)} · {person(room.worker)}</b></div><div className="workroom-fact"><span>Payment</span><b>{amount}</b></div></div></header><nav className="workroom-tabs">{(["overview", "files", "messages", "delivery", "payment"] as Tab[]).map((value) => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</nav><section className="workroom-pane">
    {tab === "overview" ? <div className="overview-grid"><section className="scope-block"><span className="page-kicker">Recorded scope</span><h2>{room.listing.title}</h2><p>{room.listing.outcome}</p><div className="requirements">{scopeLines.length ? scopeLines.map((item) => <div className="requirement" key={item}><i>✓</i><span>{item}</span></div>) : <div className="requirement"><i>✓</i><span>The accepted Listing outcome is the recorded scope.</span></div>}</div>{room.revisions.length ? <div className="revision-history"><span className="page-kicker">Revision record</span>{room.revisions.map((revision) => <article key={revision.id}><b>{revision.request}</b><small>{new Date(revision.createdAt).toLocaleString()}</small></article>)}</div> : null}<section className="render-approval" style={{ marginTop: 24 }}><span className="page-kicker">Delegated Studio briefing</span><h2>Explicit, production-scoped access</h2><p>{isFounder ? "Choose one paid video production this worker may brief. The permission expires automatically and does not grant payment or final-output approval." : "The hiring side controls whether this Workroom can open one paid Studio briefing."}</p>{delegationActive ? <><div className="detail-section"><span>Production</span><b>{String(delegation?.productionId)}</b></div><div className="detail-section"><span>Expires</span><b>{new Date(String(delegation?.expiresAt)).toLocaleString()}</b></div><div className="detail-section"><span>Brief approval</span><b>{delegation?.canApproveBrief === true ? "Delegated" : "Founder only"}</b></div>{isWorker ? <Link className="btn primary full" href={`/studio/${String(delegation?.productionId)}`}>Open delegated Studio</Link> : <button className="btn danger full" disabled={working} onClick={() => void revokeDelegation()}>Revoke access</button>}</> : isFounder ? <>{delegatableProductions.length ? <><div className="field"><label>Paid video production</label><select className="select" value={selectedDelegationProductionId} onChange={(event) => setDelegationProductionId(event.target.value)}><option value="">Choose a production</option>{delegatableProductions.map((creation) => <option key={creation.id} value={creation.id}>{creation.title} · {creation.status.replaceAll("_", " ")}</option>)}</select></div><div className="field"><label>Permission duration in days</label><input className="input" type="number" min="1" max="30" value={delegationDays} onChange={(event) => setDelegationDays(Math.max(1, Math.min(30, Number(event.target.value))))} /></div><label className="rights-check"><input type="checkbox" checked={delegateApproval} onChange={(event) => setDelegateApproval(event.target.checked)} /><span><b>Allow this worker to approve the NexMind brief</b><small>Leave off when the founder must make the structured direction decision.</small></span></label><button className="btn primary full" disabled={working || !selectedDelegationProductionId} onClick={() => void grantDelegation()}>Grant expiring access</button></> : <p>No paid video production is currently eligible. Studio payment remains separate from this Workroom escrow.</p>}</> : <p>No active Studio briefing permission is attached to this Workroom.</p>}</section></section><aside><h2 style={{ marginTop: 0 }}>Current state</h2><div className="milestones"><article className="milestone current"><i>1</i><span><b>{room.status.replaceAll("_", " ")}</b><span>Backed by the persisted Workroom and escrow record</span></span></article></div></aside></div> : null}
    {tab === "files" ? <div className="file-grid">{room.deliveries.flatMap((delivery) => delivery.objectKeys.map((key) => <a className="file-card" href={`/api/v1/workrooms/${id}/files?key=${encodeURIComponent(key)}`} key={`${delivery.id}:${key}`}><i>FL</i><b>{String(key).split("/").pop()}</b><span>Delivery {delivery.version} · {delivery.status}</span><small>Download</small></a>)).length ? room.deliveries.flatMap((delivery) => delivery.objectKeys.map((key) => <a className="file-card" href={`/api/v1/workrooms/${id}/files?key=${encodeURIComponent(key)}`} key={`${delivery.id}:${key}`}><i>FL</i><b>{String(key).split("/").pop()}</b><span>Delivery {delivery.version} · {delivery.status}</span><small>Download</small></a>)) : <div className="market-empty"><h2>No delivery files yet.</h2><p>Submitted files will appear with their delivery version.</p></div>}</div> : null}
    {tab === "messages" ? <div className="message-list">{room.messages.length ? room.messages.map((item) => <article className="room-message" key={item.id}><i>{initials(item.author)}</i><span><b>{person(item.author)}</b><span>{item.body}</span></span><time>{new Date(item.createdAt).toLocaleString()}</time></article>) : <div className="market-empty"><h2>No messages yet.</h2><p>The first message will remain attached to this Workroom.</p></div>}<div className="session-input" style={{ marginTop: 14 }}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write to the Workroom…" /><button className="round-button send" disabled={working || !message.trim()} onClick={sendMessage} aria-label="Send Workroom message"><Icon name="send" size="sm" /></button></div></div> : null}
    {tab === "delivery" ? <div className="delivery-box">{latest ? <><span className="pill gold">Version {latest.version} · {latest.status}</span><h2 style={{ fontSize: 30, letterSpacing: "-.04em" }}>{latest.message}</h2><p style={{ color: "var(--muted)" }}>Review this exact submission against the recorded scope.</p></> : <><h2>No delivery has been submitted.</h2><p style={{ color: "var(--muted)" }}>{isWorker ? "Submit the finished result when it is ready for review." : "The selected worker has not submitted a delivery yet."}</p></>}{isWorker && (!latest || room.status === "REVISION_REQUESTED") ? <section className="render-approval"><div className="field"><label>{room.status === "REVISION_REQUESTED" ? "Revised delivery note" : "Delivery note"}</label><textarea className="textarea" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Describe the finished result and attached files." /></div><div className="field"><label>Finished files</label><input className="input" type="file" multiple onChange={(event) => setDeliveryFiles(Array.from(event.target.files || []))} /><small>{deliveryFiles.length ? `${deliveryFiles.length} file(s) selected` : "Files are uploaded only when you submit."}</small></div><button className="btn primary" disabled={working || !deliveryNote.trim()} onClick={submitDelivery}>{room.status === "REVISION_REQUESTED" ? "Submit revised delivery" : "Submit delivery"}</button></section> : pendingAction && latest ? <div className="field"><label>{pendingAction === "revision" ? "Exact revision request" : "Reason and relevant evidence"}</label><textarea className="textarea" value={actionText} onChange={(event) => setActionText(event.target.value)} /><div className="delivery-actions"><button className="btn ghost" onClick={() => setPendingAction(null)}>Cancel</button><button className={pendingAction === "dispute" ? "btn danger" : "btn primary"} disabled={working || actionText.trim().length < (pendingAction === "dispute" ? 10 : 2)} onClick={() => void runChainAction(pendingAction === "revision" ? { action: "revision", request: actionText, deliveryId: latest.id } : { action: "dispute", reason: actionText, evidence: [] }, pendingAction === "revision" ? "revisions" : "disputes")}>Confirm in wallet</button></div></div> : latest ? <div className="delivery-actions">{isFounder && room.status === "DELIVERED" ? <><button className="btn ghost" onClick={() => setPendingAction("revision")}>Request revision</button><button className="btn primary" disabled={working} onClick={() => void runChainAction({ action: "approve" }, "approve")}>Approve delivery</button></> : null}{new Set(["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"]).has(room.status) ? <button className="btn danger" onClick={() => setPendingAction("dispute")}>Open dispute</button> : null}</div> : null}</div> : null}
    {tab === "payment" ? <div style={{ maxWidth: 760 }}><span className="page-kicker">Escrow</span><h2 style={{ fontSize: 30, letterSpacing: "-.04em" }}>{amount} · {room.status.replaceAll("_", " ")}</h2><p style={{ color: "var(--muted)" }}>The app changes this state only after the matching Robinhood Chain event is confirmed.</p><div className="payment-lines"><div className="payment-line"><span>Hiring side</span><b>{person(room.founder)}</b></div><div className="payment-line"><span>Worker</span><b>{person(room.worker)}</b></div><div className="payment-line"><span>Escrow reference</span><b>{room.escrowId || "Not funded"}</b></div><div className="payment-line"><span>Review deadline</span><b>{room.reviewDeadline ? new Date(room.reviewDeadline).toLocaleString() : "Not started"}</b></div></div>{room.status === "APPROVED" ? <button className="btn primary" style={{ marginTop: 16 }} disabled={working} onClick={() => void runChainAction({ action: "release" }, "release")}>Release payment</button> : null}{room.status === "RELEASED" ? <span className="pill green" style={{ marginTop: 16 }}>Payment released on Robinhood Chain</span> : null}</div> : null}
  </section><div className="mobile-sticky-action"><button className="btn primary">{tab === "delivery" ? "Review delivery" : tab === "payment" ? "Review payment" : "Open next action"}</button></div></>;
}
