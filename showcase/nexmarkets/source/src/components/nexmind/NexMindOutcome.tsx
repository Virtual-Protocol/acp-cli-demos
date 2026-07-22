"use client";

import { Icon } from "@/components/product/Icon";
import type { NexMindProposal } from "./types";

export type ReputationVisibility = Record<"role" | "workLine" | "areas" | "availability" | "location" | "northstar", boolean>;

export function NexMindOutcome({ proposal, state, busy, visibility, setVisibility, onContinue, onApprove }: {
  proposal: NexMindProposal;
  state: string;
  busy: boolean;
  visibility: ReputationVisibility;
  setVisibility: (value: ReputationVisibility) => void;
  onContinue: () => void;
  onApprove: () => void;
}) {
  const marketplace = proposal.kind === "listing";
  const application = proposal.kind === "application";
  const reputation = proposal.kind === "reputation";
  const approved = state === "APPROVED";
  const heading = marketplace ? "Listing draft ready" : application ? "Application ready" : reputation ? "NexCard context ready" : "Production brief ready";
  const action = approved ? "Open approved outcome" : marketplace ? "Approve Listing draft" : application ? "Approve and submit" : reputation ? "Approve and publish NexCard" : "Approve and open Studio";
  const visibilityKeys: Array<keyof ReputationVisibility> = ["role", "workLine", "areas", "availability", "location", "northstar"];
  return <section className="outcome-card">
    <span className="page-kicker">Structured outcome</span>
    <h2>{heading}</h2>
    <p>{proposal.summary} Nothing publishes, submits or enters production until you approve it.</p>
    <div className="outcome-grid">{proposal.fields.map((field, index) => <div className="outcome-field" key={`${field.label}:${index}`}><span>{field.label} · {field.status === "confirmed" ? "confirmed" : field.status === "unconfirmed" ? "needs confirmation" : "open"}</span><b>{field.value}</b></div>)}</div>
    {reputation && proposal.profile && !approved ? <section className="detail-section"><span className="page-kicker">Public field choices</span><p>Only checked fields will appear on the public NexCard. The reviewed values remain private in your account when unchecked.</p><div className="filter-checks">{visibilityKeys.map((key) => <label key={key}><input type="checkbox" checked={visibility[key]} onChange={(event) => setVisibility({ ...visibility, [key]: event.target.checked })} /><span>{key.replace(/([A-Z])/g, " $1")}</span></label>)}</div></section> : null}
    <div className="outcome-actions">{!approved ? <><button className="btn ghost" disabled={busy} onClick={onContinue}>Continue conversation</button><button className="btn ghost" disabled={busy} onClick={onContinue}>Edit {marketplace ? "Listing" : reputation ? "profile context" : application ? "application" : "brief"}</button></> : null}<button className="btn primary" disabled={busy} onClick={onApprove}>{busy ? "Applying approval…" : action} <Icon name="arrow" size="sm" /></button></div>
  </section>;
}
