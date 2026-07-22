"use client";

import { Icon } from "@/components/product/Icon";
import type { NexMindHistoryItem, RouteKey } from "./types";
import { purposeLabel } from "./types";

function when(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString();
}

export function NexMindHome({
  outcome,
  setOutcome,
  route,
  history,
  sourceNames,
  busy,
  onStart,
  onAddLink,
  onAddFiles,
  onResume,
}: {
  outcome: string;
  setOutcome: (value: string) => void;
  route: RouteKey;
  history: NexMindHistoryItem[];
  sourceNames: string[];
  busy: boolean;
  onStart: (route?: RouteKey) => void;
  onAddLink: () => void;
  onAddFiles: () => void;
  onResume: (id: string) => void;
}) {
  const routes: Array<[RouteKey, string]> = [["video", "Create a video"], ["infographic", "Create an infographic"], ["post", "Post work"], ["application", "Prepare an application"], ["find", "Find suitable work"]];
  return <section className="mind-home">
    <div className="mind-home-main">
      <h1>Bring the unfinished thought.</h1>
      <p>A launch to explain. A role to fill. Work worth winning. Give NexMind the destination and shape the decisions together.</p>
      <div className="outcome-composer">
        <textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Describe what should exist when the work is finished. Add a link or source if you have one." />
        {sourceNames.length ? <div className="quick-routes" aria-label="Attached Project Vault sources">{sourceNames.map((name) => <span className="pill green" key={name}><Icon name="check" size="sm" /> {name}</span>)}</div> : null}
        <div className="composer-tools">
          <button className="tool-button" onClick={onAddLink}><Icon name="link" size="sm" /> Add link</button>
          <button className="tool-button" onClick={onAddFiles}><Icon name="upload" size="sm" /> Add files</button>
          <button className="btn primary" disabled={busy || !outcome.trim()} onClick={() => onStart()}>{busy ? "Opening session…" : "Shape this with NexMind"} <Icon name="arrow" size="sm" /></button>
        </div>
      </div>
      <div className="quick-routes">{routes.map(([key, label]) => <button className={`quick-route ${route === key ? "active" : ""}`} key={key} onClick={() => onStart(key)}>{label}</button>)}</div>
    </div>
    <aside className="history-rail">
      <header className="history-head"><b>Recent outcomes</b><span className="history-toggle" aria-hidden="true"><Icon name="chevron" size="sm" /></span></header>
      <div className="history-list">{history.length ? history.map((item) => <button className="history-item" key={item.id} onClick={() => onResume(item.id)}><b>{item.title || purposeLabel(item.purpose)}</b><span>{purposeLabel(item.purpose)} · {item.state.toLowerCase().replaceAll("_", " ")}</span><small>{when(item.updatedAt)}</small></button>) : <div className="market-empty"><h2>No saved outcomes yet.</h2><p>Your persisted NexMind sessions will appear here.</p></div>}</div>
    </aside>
  </section>;
}
