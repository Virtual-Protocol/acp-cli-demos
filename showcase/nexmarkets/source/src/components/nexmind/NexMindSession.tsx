"use client";

import { useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/product/Icon";
import type { NexMindContext, NexMindSession as SessionRecord, ProposalField } from "./types";
import { purposeLabel } from "./types";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contextFields(context: NexMindContext): ProposalField[] {
  if (context.proposal?.fields.length) return context.proposal.fields;
  const production = context.production && typeof context.production === "object" ? context.production : null;
  const fields: ProposalField[] = [];
  if (text(context.outcome)) fields.push({ label: "Goal", value: text(context.outcome)!, status: "confirmed" });
  if (production && text(production.title)) fields.push({ label: "Production", value: `${text(production.title)}${text(production.kind) ? ` · ${text(production.kind)}` : ""}`, status: "confirmed" });
  for (const source of context.sources || []) {
    const name = text(source.name) || text(source.originalUrl);
    if (name) fields.push({ label: "Source", value: name, status: source.status === "READY" || !source.status ? "confirmed" : "unconfirmed" });
  }
  if (text(context.currentQuestion)) fields.push({ label: "Open question", value: text(context.currentQuestion)!, status: "open" });
  return fields;
}

export function NexMindSessionView({
  session,
  value,
  setValue,
  busy,
  contextOpen,
  setContextOpen,
  onBack,
  onSend,
  onSource,
  onLive,
  onComplete,
}: {
  session: SessionRecord;
  value: string;
  setValue: (value: string) => void;
  busy: boolean;
  contextOpen: boolean;
  setContextOpen: (value: boolean) => void;
  onBack: () => void;
  onSend: () => void;
  onSource: () => void;
  onLive: () => void;
  onComplete: () => void;
}) {
  const thread = useRef<HTMLDivElement>(null);
  const fields = useMemo(() => contextFields(session.context), [session.context]);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" }); }, [session.messages.length, busy]);
  const closed = new Set(["ENDED", "APPROVED"]).has(session.state);
  return <section className="mind-session">
    <div className="session-main">
      <header className="session-head">
        <button className="round-button" onClick={onBack} aria-label="Back"><Icon name="chevron" size="sm" /></button>
        <span className="session-head-copy"><b>{session.context.proposal?.title || text(session.context.outcome) || purposeLabel(session.purpose)}</b><span>{purposeLabel(session.purpose)} · persisted session</span></span>
        <button className="btn" onClick={() => setContextOpen(!contextOpen)}><Icon name="vault" size="sm" /><span>Context</span></button>
        <button className="btn primary" disabled={busy || closed} onClick={onLive}><Icon name="mic" size="sm" /><span>Talk live</span></button>
      </header>
      <div className="thread" ref={thread}>{session.messages.length ? session.messages.map((message) => <article className={`message ${message.speaker === "USER" ? "user" : "agent"}`} key={message.id || message.sequence}><div className="message-label">{message.speaker === "USER" ? "You" : "NexMind"}</div><div className="bubble">{message.text}</div></article>) : <div className="market-empty"><h2>The session is ready.</h2><p>Add the intended outcome to begin the persisted conversation.</p></div>}{busy ? <article className="message agent"><div className="message-label">NexMind</div><div className="bubble">Waiting for the configured provider…</div></article> : null}</div>
      <div className="session-composer"><div className="session-input"><button className="round-button" onClick={onSource} aria-label="Add a Project Vault source"><Icon name="plus" size="sm" /></button><textarea value={value} disabled={busy || closed} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder={closed ? "This session is closed." : "Add a detail or answer the open question…"} /><button className="round-button send" disabled={busy || closed || !value.trim()} onClick={onSend} aria-label="Send"><Icon name="send" size="sm" /></button></div></div>
    </div>
    <aside className={`structure-panel ${contextOpen ? "open" : ""}`}>
      <header className="structure-head"><h2>Work taking shape</h2><button className="close-button" onClick={() => setContextOpen(false)} aria-label="Close context"><Icon name="close" size="sm" /></button></header>
      <div className="structure-stack">{fields.length ? fields.map((field, index) => <article className={`structure-card ${field.status}`} key={`${field.label}:${index}`}><header><span>{field.label}</span><span>{field.status === "confirmed" ? "Confirmed" : field.status === "unconfirmed" ? "Needs confirmation" : "Open"}</span></header><p>{field.value}</p></article>) : <article className="structure-card open"><header><span>Context</span><span>Open</span></header><p>Add the outcome or attach a Project Vault source. NexMind will not fill this panel with invented details.</p></article>}</div>
      {!closed ? <button className="btn primary full" disabled={busy || session.messages.length === 0} onClick={onComplete}>Prepare outcome for review <Icon name="arrow" size="sm" /></button> : null}
    </aside>
  </section>;
}
