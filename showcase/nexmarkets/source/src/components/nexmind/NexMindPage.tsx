"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadState } from "@/components/product/LoadState";
import { Icon } from "@/components/product/Icon";
import { useProduct } from "@/components/product/ProductProvider";
import { LiveConversation } from "./LiveConversation";
import { NexMindHome } from "./NexMindHome";
import { NexMindOutcome, type ReputationVisibility } from "./NexMindOutcome";
import { NexMindSessionView } from "./NexMindSession";
import type { NexMindHistoryItem, NexMindProposal, NexMindSession, ProposalField, RouteKey } from "./types";
import { nexMindRouteCopy, routePurpose } from "./types";

type SourceRecord = { id: string; name: string | null; originalUrl: string | null; status: string };
type MessageResponse = { assistant: { text: string } };
type NativeLiveTurnResponse = { saved: boolean };

function sessionFields(session: NexMindSession): ProposalField[] {
  if (session.context.proposal?.fields) return session.context.proposal.fields;
  const fields: ProposalField[] = [];
  if (session.context.outcome) fields.push({ label: "Goal", value: session.context.outcome, status: "confirmed" });
  for (const source of session.context.sources || []) {
    const value = typeof source.name === "string" ? source.name : typeof source.originalUrl === "string" ? source.originalUrl : null;
    if (value) fields.push({ label: "Source", value, status: source.status === "READY" || source.status == null ? "confirmed" : "unconfirmed" });
  }
  if (session.context.currentQuestion) fields.push({ label: "Open question", value: session.context.currentQuestion, status: "open" });
  return fields;
}

export function NexMindPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading, error, api, connectWallet, refresh, notify } = useProduct();
  const [history, setHistory] = useState<NexMindHistoryItem[]>([]);
  const [session, setSession] = useState<NexMindSession | null>(null);
  const reputationPurpose = searchParams.get("purpose") === "reputation";
  const [outcome, setOutcome] = useState(reputationPurpose ? "Add reviewed professional context to my NexCard." : "");
  const [route, setRoute] = useState<RouteKey>(reputationPurpose ? "reputation" : "video");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [approvedHref, setApprovedHref] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<ReputationVisibility>({ role: true, workLine: true, areas: true, availability: true, location: false, northstar: true });
  const fileInput = useRef<HTMLInputElement>(null);
  const booted = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!data?.authenticated) { setHistory([]); return; }
    try {
      const result = await api<{ items: NexMindHistoryItem[] }>("/api/v1/nexmind/sessions");
      setHistory(result.items);
    } catch { setHistory([]); }
  }, [api, data?.authenticated]);

  const loadSession = useCallback(async (id: string) => {
    const next = await api<NexMindSession>(`/api/v1/nexmind/sessions/${id}`);
    setSession(next);
    setOutcome(next.context.outcome || "");
    const suppliedRoute = next.context.route;
    if (suppliedRoute && suppliedRoute in nexMindRouteCopy) setRoute(suppliedRoute as RouteKey);
    return next;
  }, [api]);

  useEffect(() => {
    if (!data?.authenticated) return;
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [data?.authenticated, loadHistory]);
  useEffect(() => {
    if (!data?.authenticated) return;
    const id = searchParams.get("session");
    if (!id || booted.current === id) return;
    booted.current = id;
    const timer = window.setTimeout(() => {
      void loadSession(id).then(() => {
        if (searchParams.get("live") === "1") setLive(true);
      }).catch((reason) => notify("Session unavailable", reason instanceof Error ? reason.message : "The NexMind session could not be loaded."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data?.authenticated, loadSession, notify, searchParams]);

  const sendToSession = useCallback(async (id: string, text: string, inputMode: "TEXT" | "VOICE" = "TEXT") => {
    if (!text.trim()) return null;
    setBusy(true);
    try {
      const response = await api<MessageResponse>(`/api/v1/nexmind/sessions/${id}/messages`, { method: "POST", body: JSON.stringify({ text, inputMode }) });
      await loadSession(id);
      return response.assistant.text;
    } catch (reason) {
      await loadSession(id).catch(() => undefined);
      notify("NexMind did not respond", reason instanceof Error ? reason.message : "The configured provider did not return a response.");
      return null;
    } finally { setBusy(false); }
  }, [api, loadSession, notify]);

  const start = async (nextRoute: RouteKey = route) => {
    setRoute(nextRoute);
    if (nextRoute === "find") { router.push("/marketplace?tab=discover"); return; }
    if (!outcome.trim()) { notify("Describe the finished outcome", `Add what the ${nexMindRouteCopy[nextRoute].label.toLowerCase()} should accomplish before opening the session.`); return; }
    setBusy(true);
    try {
      if (!data?.authenticated) await connectWallet();
      const purpose = routePurpose(nextRoute);
      const profileId = purpose === "REPUTATION_ENHANCEMENT" ? searchParams.get("profile") || data?.reputation?.id : undefined;
      const productionId = searchParams.get("production") || undefined;
      const created = await api<NexMindSession>("/api/v1/nexmind/sessions", { method: "POST", body: JSON.stringify({ purpose, productionId, reputationProfileId: profileId, context: { outcome: outcome.trim(), route: nextRoute, productionKind: nexMindRouteCopy[nextRoute].productionKind, sourceIds } }) });
      setSession({ ...created, messages: [], context: created.context || { outcome: outcome.trim(), route: nextRoute } });
      booted.current = created.id;
      router.replace(`/nexmind?session=${created.id}`);
      setBusy(false);
      await sendToSession(created.id, outcome.trim());
      await loadHistory();
      if (purpose === "REPUTATION_ENHANCEMENT") setLive(true);
    } catch (reason) {
      notify("Session unavailable", reason instanceof Error ? reason.message : "NexMind could not start this outcome.");
      setBusy(false);
    }
  };

  const resume = async (id: string) => {
    setBusy(true);
    try { await loadSession(id); booted.current = id; router.replace(`/nexmind?session=${id}`); }
    catch (reason) { notify("Session unavailable", reason instanceof Error ? reason.message : "The saved session could not be opened."); }
    finally { setBusy(false); }
  };

  const attachSource = useCallback(async (source: SourceRecord) => {
    setSourceIds((items) => items.includes(source.id) ? items : [...items, source.id]);
    const name = source.name || source.originalUrl || "Project Vault source";
    setSourceNames((items) => items.includes(name) ? items : [...items, name]);
    if (session) {
      await api(`/api/v1/nexmind/sessions/${session.id}`, { method: "PATCH", body: JSON.stringify({ sourceId: source.id }) });
      await loadSession(session.id);
    }
  }, [api, loadSession, session]);

  const saveLink = async () => {
    setBusy(true);
    try {
      let source = await api<SourceRecord>("/api/v1/sources", { method: "POST", body: JSON.stringify({ url: linkValue.trim(), rightsAttested: true, isReusable: true }) });
      if (source.status === "PENDING") source = await api<SourceRecord>(`/api/v1/sources/${source.id}/analyse`, { method: "POST", body: "{}" });
      await attachSource(source);
      setLinkOpen(false); setLinkValue("");
      notify("Source attached", `${source.name || source.originalUrl || "The page"} is now grounded session context.`);
    } catch (reason) { notify("Source not attached", reason instanceof Error ? reason.message : "The page could not be added."); }
    finally { setBusy(false); }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData(); form.set("file", file); form.set("rightsAttested", "true"); form.set("isReusable", "true");
        await attachSource(await api<SourceRecord>("/api/v1/sources", { method: "POST", body: form }));
      }
      notify("Files attached", `${files.length} Project Vault source${files.length === 1 ? " is" : "s are"} available to this session.`);
    } catch (reason) { notify("Files not attached", reason instanceof Error ? reason.message : "The upload did not complete."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const complete = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await api(`/api/v1/nexmind/sessions/${session.id}/complete`, { method: "POST", body: "{}" });
      setLive(false);
      await Promise.all([loadSession(session.id), loadHistory()]);
      if (session.productionId) {
        router.push(`/studio/${session.productionId}`);
      }
    }
    catch (reason) { notify("Outcome not ready", reason instanceof Error ? reason.message : "NexMind could not prepare the approval object."); }
    finally { setBusy(false); }
  }, [api, loadHistory, loadSession, notify, session, router]);

  const approve = async () => {
    if (!session?.context.proposal) return;
    const proposal = session.context.proposal;
    if (session.state === "APPROVED" && proposal.kind !== "reputation") { router.push(approvedHref || (session.productionId ? `/studio/${session.productionId}` : "/marketplace")); return; }
    setBusy(true);
    try {
      let href = approvedHref;
      if (session.state !== "APPROVED") {
        const result = await api<{ href: string }>(`/api/v1/nexmind/sessions/${session.id}/approve`, { method: "POST", body: "{}" });
        href = result.href; setApprovedHref(result.href);
      }
      if (proposal.kind === "reputation" && proposal.profile) {
        await api("/api/v1/reputation/publish", { method: "POST", body: JSON.stringify({ mode: "enhanced", fields: proposal.profile, visibility }) });
        href = "/reputation";
      }
      await Promise.all([refresh(), loadHistory()]);
      router.push(href || "/dashboard");
    } catch (reason) { notify("Approval not applied", reason instanceof Error ? reason.message : "The reviewed outcome remains saved and unchanged."); }
    finally { setBusy(false); }
  };

  const persist = useCallback(async (partial: string | null, liveState: "listening" | "understanding" | "speaking" | "paused" | "reviewing") => {
    if (!session) return;
    await api(`/api/v1/nexmind/sessions/${session.id}`, { method: "PATCH", body: JSON.stringify({ partialTranscript: partial, liveState }) }).catch(() => undefined);
  }, [api, session]);

  const nativeLiveTurn = useCallback(async (userText: string | null, assistantText: string | null) => {
    if (!session || (!userText?.trim() && !assistantText?.trim())) return;
    await api<NativeLiveTurnResponse>(`/api/v1/nexmind/sessions/${session.id}/native-live-turns`, { method: "POST", body: JSON.stringify({ userText: userText?.trim() || undefined, assistantText: assistantText?.trim() || undefined, provider: "gemini-live" }) });
    await loadSession(session.id);
  }, [api, loadSession, session]);

  const proposal = session?.context.proposal as NexMindProposal | undefined;
  const fields = useMemo(() => session ? sessionFields(session) : [], [session]);
  if (loading || error || !data) return <LoadState label="Loading NexMind" />;

  return <>
    <input className="sr-only" ref={fileInput} type="file" multiple onChange={(event) => void uploadFiles(event.target.files)} />
    {!session ? <NexMindHome outcome={outcome} setOutcome={setOutcome} route={route} history={history} sourceNames={sourceNames} busy={busy} onStart={(next) => void start(next)} onAddLink={() => setLinkOpen(true)} onAddFiles={() => fileInput.current?.click()} onResume={(id) => void resume(id)} /> : proposal && new Set(["REVIEW", "APPROVED"]).has(session.state) ? <NexMindOutcome proposal={proposal} state={session.state} busy={busy} visibility={visibility} setVisibility={setVisibility} onContinue={() => setSession({ ...session, state: "ACTIVE" })} onApprove={() => void approve()} /> : <NexMindSessionView session={session} value={message} setValue={setMessage} busy={busy} contextOpen={contextOpen} setContextOpen={setContextOpen} onBack={() => { setSession(null); router.replace("/nexmind"); void loadHistory(); }} onSend={() => { const next = message; setMessage(""); void sendToSession(session.id, next); }} onSource={() => fileInput.current?.click()} onLive={() => setLive(true)} onComplete={() => void complete()} />}
    {live && session ? <LiveConversation session={session} fields={fields} onClose={() => { setLive(false); void persist(null, "reviewing"); }} onComplete={complete} onPersist={persist} onNativeTurn={nativeLiveTurn} /> : null}
    <div className={`backdrop ${linkOpen ? "open" : ""}`} onClick={() => setLinkOpen(false)} />
    <section className={`modal ${linkOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Add a public source"><header className="modal-head"><h2>Add a source link</h2><button className="close-button" onClick={() => setLinkOpen(false)}><Icon name="close" size="sm" /></button></header><div className="modal-body"><div className="field"><label>Public page</label><input className="input" type="url" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://" /></div><p className="form-note">Only add a page you are permitted to use. NexMarkets verifies the address and stores its extracted source record before attaching it.</p></div><footer className="modal-actions"><button className="btn ghost" onClick={() => setLinkOpen(false)}>Cancel</button><button className="btn primary" disabled={busy || !/^https?:\/\//i.test(linkValue)} onClick={() => void saveLink()}>{busy ? "Reading sourceâ€¦" : "Attach source"}</button></footer></section>
  </>;
}
