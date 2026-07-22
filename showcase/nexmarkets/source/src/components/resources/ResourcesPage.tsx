"use client";

import { useState } from "react";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import type { SourceView } from "@/components/product/types";

type UploadMode = "file" | "url" | "text";

function code(source: SourceView) {
  if (source.mimeType?.startsWith("image/")) return "IM";
  if (source.kind === "WEBSITE") return "URL";
  if (source.kind === "TEXT") return "TXT";
  return (source.name?.split(".").pop() || source.kind).slice(0, 3).toUpperCase();
}
function sourceKind(source: SourceView) { return source.mimeType?.startsWith("image/") ? "image" : source.kind === "WEBSITE" ? "url" : "doc"; }
function size(value: SourceView["sizeBytes"]) {
  const bytes = Number(value || 0); if (!bytes) return "Stored source";
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
function sourceGroup(source: SourceView) {
  const rights = source.rights && typeof source.rights === "object" && !Array.isArray(source.rights) ? source.rights as Record<string, unknown> : {};
  const group = typeof rights.group === "string" ? rights.group.toLowerCase() : "";
  if (["brand", "product", "briefs", "research", "output", "work"].includes(group)) return group;
  if (source.usage?.some((item) => item.type === "workroom")) return "work";
  if (source.usage?.some((item) => item.type === "production")) return "output";
  if (source.kind === "WEBSITE") return "research";
  if (source.kind === "TEXT") return "briefs";
  if (source.mimeType?.startsWith("image/")) return "brand";
  return "product";
}

export function ResourcesPage() {
  const { data, loading, error, api, refresh, connectWallet, notify } = useProduct();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [mode, setMode] = useState<UploadMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [reusable, setReusable] = useState(true);
  const [rights, setRights] = useState(false);
  const [working, setWorking] = useState(false);
  const sources = data?.sources ?? [];
  const filtered = filter === "all" ? sources : sources.filter((source) => sourceGroup(source) === filter);
  const selected = sources.find((source) => source.id === selectedId) || filtered[0] || null;
  if (loading || error || !data) return <LoadState label="Loading your resources" />;

  const requireAccount = async () => { if (!data.authenticated) await connectWallet(); };
  const upload = async () => {
    if (!rights) { notify("Permission confirmation required", "Confirm that you are allowed to use this source."); return; }
    setWorking(true);
    try {
      await requireAccount();
      let source: SourceView;
      if (mode === "file") {
        if (!file) throw new Error("Choose a file first.");
        const form = new FormData(); form.set("file", file); form.set("rightsAttested", "true"); form.set("isReusable", String(reusable));
        source = await api<SourceView>("/api/v1/sources", { method: "POST", body: form });
      } else {
        source = await api<SourceView>("/api/v1/sources", { method: "POST", body: JSON.stringify({ name: name || undefined, ...(mode === "url" ? { url } : { text }), isReusable: reusable, rightsAttested: true }) });
      }
      await refresh(); setSelectedId(source.id); setShowUpload(false); setFile(null); setName(""); setUrl(""); setText(""); setRights(false); notify("Resource saved", "The real source and its permission record are now available to Studio.");
    } catch (reason) { notify("Resource not saved", reason instanceof Error ? reason.message : "The source could not be saved."); }
    finally { setWorking(false); }
  };
  const remove = async (source: SourceView) => {
    if (!window.confirm(`Remove ${source.name || "this source"} from future use?`)) return;
    setWorking(true); try { await api(`/api/v1/sources/${source.id}`, { method: "DELETE" }); await refresh(); setSelectedId(null); notify("Resource removed", "Historical work remains intact; the source is no longer reusable."); } catch (reason) { notify("Resource not removed", reason instanceof Error ? reason.message : "The source may still be in use."); } finally { setWorking(false); }
  };
  const analyse = async (source: SourceView) => { setWorking(true); try { await api(`/api/v1/sources/${source.id}/analyse`, { method: "POST", body: "{}" }); await refresh(); notify("Source refreshed", "The latest readable content and hash were saved."); } catch (reason) { notify("Source not refreshed", reason instanceof Error ? reason.message : "The URL could not be read."); } finally { setWorking(false); } };

  return <><header className="page-head"><div className="page-head-copy"><span className="page-kicker">Your resources</span><h1>{sources.length ? "Approved context behind the work." : "No saved resources yet."}</h1><p>{sources.length ? "Files, claims and references stay traceable to the projects and outputs that use them." : "Upload a source you are allowed to use, then choose whether it can be reused across Studio work."}</p></div><div className="head-actions"><button className="btn primary" onClick={() => setShowUpload(true)}><Icon name="upload" size="sm" /> Upload source</button></div></header>
    {showUpload ? <section className="settings-section resource-upload"><header className="settings-head"><div><span className="page-kicker">New resource</span><h2>Save material Studio may use.</h2><p>The source, checksum and permission confirmation are persisted together.</p></div><button className="close-button" onClick={() => setShowUpload(false)} aria-label="Close"><Icon name="close" size="sm" /></button></header><div className="filter-row">{(["file", "url", "text"] as UploadMode[]).map((value) => <button className={mode === value ? "active" : ""} key={value} onClick={() => setMode(value)}>{value === "file" ? "File" : value === "url" ? "Website" : "Text"}</button>)}</div>{mode === "file" ? <div className="field"><label>File</label><input className="input" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>Maximum 25 MB. The uploaded bytes are stored under a private account key.</small></div> : <><div className="field"><label>Name</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="A clear reusable name" /></div>{mode === "url" ? <div className="field"><label>Public website URL</label><input className="input" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></div> : <div className="field"><label>Source text</label><textarea className="textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste approved product facts, notes or source copy." /></div>}</>}<label className="rights-check"><input type="checkbox" checked={reusable} onChange={(event) => setReusable(event.target.checked)} /><span><b>Make this reusable</b><small>Show this source in future Studio resource pickers.</small></span></label><label className="rights-check"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} /><span><b>I am allowed to use this source</b><small>This confirmation is required and stored with the source.</small></span></label><button className="btn primary" disabled={working || !rights || (mode === "file" ? !file : mode === "url" ? !url : text.trim().length < 2)} onClick={upload}>{working ? "Saving…" : "Save resource"}</button></section> : null}
    {sources.length ? <><div className="filter-row" style={{ marginBottom: 14 }}>{[["all", "All"], ["brand", "Brand"], ["product", "Product"], ["briefs", "Briefs"], ["research", "Research"], ["output", "Output"], ["work", "Work"]].map(([value, label]) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div><section className="vault-browser"><div className="asset-grid">{filtered.map((source) => <button className={`asset-card ${selected?.id === source.id ? "active" : ""}`} key={source.id} onClick={() => setSelectedId(source.id)}><div className={`asset-preview ${sourceKind(source)}`}><b>{code(source)}</b></div><b>{source.name || source.originalUrl || "Untitled source"}</b><span>{source.mimeType || source.kind} · {size(source.sizeBytes)}</span></button>)}</div>{selected ? <aside className="asset-side"><span className={`pill ${selected.status === "READY" ? "green" : "gold"}`}>{selected.status}</span><h2 style={{ marginTop: 13 }}>{selected.name || selected.originalUrl || "Untitled source"}</h2><p style={{ color: "var(--muted)" }}>{selected.mimeType || selected.kind} · {size(selected.sizeBytes)}</p><div className="detail-section"><span>Permission</span><b>{selected.isReusable ? "Reusable in this account" : "Current work only"}</b></div><div className="detail-section"><span>Resource group</span><b>{sourceGroup(selected)}</b></div><div className="detail-section"><span>Source kind</span><b>{selected.kind.replaceAll("_", " ")}</b></div><div className="detail-section"><span>Last reviewed</span><b>{new Date(selected.updatedAt).toLocaleString()}</b></div><div className="detail-section"><span>Analysis</span><b>{typeof selected.extracted?.characters === "number" ? `${selected.extracted.characters.toLocaleString()} readable characters` : selected.status}</b></div><div className="detail-section"><span>Used by</span><b>{selected.usage?.length ? selected.usage.map((usage) => usage.title).join(" · ") : "No persisted output or Workroom yet"}</b></div><div className="resource-actions">{selected.objectKey ? <a className="btn primary full" href={`/api/v1/sources/${selected.id}/content`}>Download file</a> : null}{selected.originalUrl ? <><a className="btn ghost full" href={selected.originalUrl} target="_blank" rel="noreferrer">Open original <Icon name="external" size="sm" /></a><button className="btn ghost full" disabled={working} onClick={() => analyse(selected)}><Icon name="refresh" size="sm" /> Refresh analysis</button></> : null}<button className="btn danger full" disabled={working} onClick={() => remove(selected)}>Remove resource</button></div></aside> : null}</section></> : <section className="market-empty"><h2>Your resource library is empty.</h2><p>Nothing is substituted with sample files.</p></section>}
  </>;
}
