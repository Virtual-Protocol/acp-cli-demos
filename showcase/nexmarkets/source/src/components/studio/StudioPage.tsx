"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreationCard } from "./CreationCard";
import { Icon } from "@/components/product/Icon";
import { EmptyState, LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";

type Mode = "video" | "infographic";
type Step = "entry" | "direction" | "review";

const videoTypes = ["Launch film", "Protocol explainer", "Product demo", "Market recap", "Thread-to-video", "Community recap", "Let NexMind recommend"];
const durations = ["Recommended", "15 seconds", "30 seconds", "45 seconds", "60 seconds"];
const destinations = ["X", "Instagram", "TikTok", "YouTube", "Website", "Presentation", "Multiple formats"];
const directions = ["Product-led and minimal", "Cinematic and assured", "Fast and social", "Editorial and precise", "Let NexMind recommend"];

function ChoiceButtons({ values, selected, onChange }: { values: string[]; selected: string; onChange: (value: string) => void }) {
  return <div className="direction-choices">{values.map((value) => <button type="button" key={value} className={selected === value ? "active" : ""} onClick={() => onChange(value)}>{value}</button>)}</div>;
}

function titleFromSource(source: string, mode: Mode) {
  const trimmed = source.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try { return `${new URL(trimmed).hostname.replace(/^www\./, "")} ${mode}`.slice(0, 120); } catch { /* use text fallback */ }
  }
  const firstLine = trimmed.split(/[\n.!?]/)[0]?.trim();
  return (firstLine || `Untitled ${mode}`).slice(0, 120);
}

function recommendedStudioDirection(input: { source: string; videoType: string; direction: string; voice: string; duration: string; destination: string }) {
  const sourceKind = /^https?:\/\//i.test(input.source) ? "linked source" : "supplied context";
  const recommendedType = input.videoType === "Let NexMind recommend";
  const recommendedDirection = input.direction === "Let NexMind recommend";
  const recommendedVoice = input.voice === "Let NexMind recommend";
  return {
    requested: recommendedType || recommendedDirection || recommendedVoice || input.duration === "Recommended",
    sourceKind,
    videoType: recommendedType ? "NexMind should classify the best output from the supplied context" : input.videoType,
    visualDirection: recommendedDirection ? "NexMind should infer the visual direction from brand/context and explain the choice" : input.direction,
    voiceRoute: recommendedVoice ? "NexMind should recommend voiceover, captions, or product-only treatment based on the objective" : input.voice,
    duration: input.duration === "Recommended" ? "NexMind should choose the shortest duration that can carry the message" : input.duration,
    destination: input.destination,
  };
}

export function StudioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, loading, error, api, refresh, connectWallet, notify } = useProduct();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "infographic" ? "infographic" : "video");
  const [step, setStep] = useState<Step>("entry");
  const [source, setSource] = useState("");
  const [brief, setBrief] = useState("");
  const [videoType, setVideoType] = useState("Let NexMind recommend");
  const [duration, setDuration] = useState("30 seconds");
  const [destination, setDestination] = useState("X");
  const [direction, setDirection] = useState("Product-led and minimal");
  const [voice, setVoice] = useState("Let NexMind recommend");
  const [colour, setColour] = useState("#ffb000");
  const [mustInclude, setMustInclude] = useState("");
  const [mustAvoid, setMustAvoid] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [rightsAttested, setRightsAttested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const fileInput = useRef<HTMLInputElement>(null);

  const creations = useMemo(() => {
    if (!data) return [];
    return data.creations.filter((item) => {
      if (filter === "all") return true;
      if (filter === "videos") return item.type === "video";
      if (filter === "infographics") return item.type === "infographic";
      if (filter === "completed") return item.state === "completed" || item.state === "review";
      return item.state === filter;
    });
  }, [data, filter]);

  if (loading || error || !data) return <LoadState label="Loading Studio" />;

  const continueFromEntry = () => {
    if (source.trim().length < 2) {
      notify("Add the source", "Paste a page, source text or a clear description of the finished piece.");
      return;
    }
    if (!brief) setBrief(source);
    setStep("direction");
  };

  const persist = async () => {
    if (!rightsAttested) {
      notify("Confirm source rights", "You must confirm that you can use the supplied material before Studio stores or processes it.");
      return;
    }
    setSaving(true);
    try {
      if (!data.authenticated) await connectWallet();
      const workspaceId = typeof data.workspaces[0]?.id === "string" ? data.workspaces[0].id : undefined;
      const production = await api<{ id: string }>("/api/v1/productions", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ kind: mode === "video" ? "VIDEO" : "INFOGRAPHIC", title: titleFromSource(source, mode), source, workspaceId }),
      });
      const uploadedSourceIds: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        form.set("rightsAttested", "true");
        form.set("isReusable", "true");
        if (workspaceId) form.set("workspaceId", workspaceId);
        const uploaded = await api<{ id: string }>("/api/v1/sources", { method: "POST", body: form });
        uploadedSourceIds.push(uploaded.id);
      }
      const recommendation = recommendedStudioDirection({ source, videoType, direction, voice, duration, destination });
      const directionRecord = mode === "video" ? {
        videoType, objective: brief.trim() || source, audience: "To be refined with NexMind", duration, durationSeconds: 30, destination, creativeDirection: direction, visualDirection: direction, voice, primaryColour: colour,
        mustInclude, mustAvoid, sourceIds: [...resourceIds, ...uploadedSourceIds], aspectRatio: "16:9", productionStage: "DISCOVERY", nexMindRecommendations: recommendation,
      } : {
        size: duration, primaryColour: colour, branding: voice, mustInclude, mustAvoid,
        sourceIds: [...resourceIds, ...uploadedSourceIds], aspectRatio: duration === "1080x1080" ? "1:1" : "16:9",
      };
      await api(`/api/v1/productions/${production.id}`, {
        method: "PATCH",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ direction: directionRecord, brief: { message: brief.trim(), source, approvedSourceRights: true, objective: brief.trim() || source, nexMindRecommendations: recommendation, productionLock: mode === "video" ? { Objective: brief.trim() || source, Audience: "To be refined with NexMind", Format: destination, Duration: "30 seconds", "Core message": brief.trim() || "To be shaped from supplied context", Structure: "Hook, context, proof, close", "Visual direction": direction, Assets: files.length + resourceIds.length ? `${files.length + resourceIds.length} selected` : "Supplied source only", Data: "Use supplied data only", "External references": /^https?:\/\//i.test(source) ? source : "None supplied", "Voice / audio": voice, "Must include": mustInclude || "None specified", "Must avoid": mustAvoid || "Unsupported claims" } : undefined } }),
      });
      await refresh();
      router.push(`/studio/${production.id}`);
    } catch (reason) {
      notify("Studio could not save the creation", reason instanceof Error ? reason.message : "Review the supplied material and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (step === "review") {
    const fields = mode === "video" ? [
      ["Source", /^https?:\/\//i.test(source) ? "Website and supplied material" : "Pasted source and supplied context"],
      ["Finished piece", videoType], ["Duration", duration], ["Destination", destination], ["Creative direction", direction],
      ["Voice route", voice], ["Primary colour", colour.toUpperCase()],
      ["Selected resources", files.length + resourceIds.length ? `${files.length + resourceIds.length} selected` : "No saved resources selected"],
      ["Production", "The live chain quote is requested only after this direction is stored"],
    ] : [
      ["Description", brief], ["Output", `${duration} · PNG`], ["Source", /^https?:\/\//i.test(source) ? "Website and supplied material" : "Pasted material and supplied context"],
      ["Assets", files.length + resourceIds.length ? `${files.length + resourceIds.length} selected` : "No additional assets"], ["Branding", `${voice} · ${colour.toUpperCase()}`],
      ["Must include", mustInclude || "No additional requirement"], ["Must not include", mustAvoid || "No exclusions added"],
    ];
    return <section className={`studio-review ${mode === "infographic" ? "infographic-review" : ""}`}>
      <header><button className="btn text" onClick={() => setStep("direction")}><Icon name="arrowleft" size="sm" /> Edit {mode === "video" ? "choices" : "task"}</button><span className="page-kicker">{mode === "video" ? "Production lock draft" : "Task ready"}</span><h1>{mode === "video" ? "Review the first production lock." : "Check what Studio will create."}</h1><p>{mode === "video" ? "This stores the source, outcome, constraints and first creative direction. NexMind can refine the brief before any final render is submitted." : "NexMind has organised your description, source, size and assets into one production task. Correct anything that is wrong before you approve it."}</p></header>
      <div className={`studio-review-object ${mode === "infographic" ? "infographic-review-object" : ""}`}>{fields.map(([label, value]) => <article key={label}><span>{label}</span><b>{value}</b></article>)}</div>
      <section className={mode === "video" ? "studio-review-call" : "infographic-approval-card"}>
        {mode === "video" ? <><div className="review-presence-mini" aria-hidden="true"><i/><i/><i/></div><span>NexMind direction</span><h2>Save the project and refine with NexMind.</h2><p>The record remains editable. Conversation and browser preview happen before a paid final render is submitted.</p></> : <div><span>Ready to create</span><h2>Approve the task and save it to Studio.</h2><p>Studio will use the approved description and supplied material. There is no live conversation for infographic creation.</p></div>}
        <aside><label className="consent-item"><input type="checkbox" checked={rightsAttested} onChange={(event) => setRightsAttested(event.target.checked)} /><span><b>I can use this material</b><span>The source and uploads are authorised for this production.</span></span></label><button className="btn primary" disabled={saving} onClick={() => void persist()}>{saving ? "Saving…" : data.authenticated ? "Approve and continue" : "Connect wallet and continue"} <Icon name="arrow" size="sm" /></button></aside>
      </section>
    </section>;
  }

  if (step === "direction") {
    const isVideo = mode === "video";
    return <><header className="page-head compact-head"><div className="page-head-copy"><button className="btn text" onClick={() => setStep("entry")}><Icon name="arrowleft" size="sm" /> Change source</button><span className="page-kicker">{isVideo ? "Context review" : "Infographic"}</span><h1>{isVideo ? "Shape the first production lock." : "Set the task."}</h1><p>{isVideo ? "NexMind can refine this later. Change only the decisions that materially alter the finished work." : "Describe what the visual must communicate, choose the output size and add the material Studio should use."}</p></div></header>
      <section className={`studio-direction-layout ${isVideo ? "" : "infographic-direction-layout"}`}><main className="direction-work"><article className="source-summary"><header><span><b>{/^https?:\/\//i.test(source) ? "Website" : "Pasted material"} reviewed</b><small>{source.slice(0, 96)}{source.length > 96 ? "…" : ""}</small></span><span className="pill green">Ready</span></header><div className="source-facts"><div><span>Source</span><b>{/^https?:\/\//i.test(source) ? "Website" : "Text"}</b></div><div><span>Output</span><b>{isVideo ? videoType : duration}</b></div><div><span>Assets</span><b>{files.length + resourceIds.length || "None added"}</b></div><div><span>Payment</span><b>Quoted on Robinhood Chain</b></div></div></article>
      <section className={`direction-form ${isVideo ? "" : "infographic-form"}`}>
        {!isVideo ? <div className="direction-field infographic-brief-field"><label>What should the finished infographic communicate?</label><textarea className="textarea" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Show the main point, supporting facts and reading order."/><small>NexMind organises this into a production task, not a simulated live session.</small></div> : <><div className="direction-field"><label>What are you making?</label><ChoiceButtons values={videoTypes} selected={videoType} onChange={setVideoType}/></div><div className="direction-field"><label>Duration</label><ChoiceButtons values={durations} selected={duration} onChange={setDuration}/></div><div className="direction-field"><label>Destination</label><ChoiceButtons values={destinations} selected={destination} onChange={setDestination}/></div><div className="direction-field"><label>Direction</label><ChoiceButtons values={directions} selected={direction} onChange={setDirection}/></div></>}
        {!isVideo ? <div className="direction-field"><label>Output size</label><ChoiceButtons values={["1920x1080", "1080x1080"]} selected={duration} onChange={setDuration}/></div> : null}
        <div className="direction-split"><div className="field"><label>Primary colour</label><div className="colour-control"><button style={{ "--swatch": "#0d0d0d" } as React.CSSProperties} onClick={() => setColour("#0d0d0d")} aria-label="Use charcoal"/><button style={{ "--swatch": "#f5f2ea" } as React.CSSProperties} onClick={() => setColour("#f5f2ea")} aria-label="Use warm white"/><button style={{ "--swatch": "#ffb000" } as React.CSSProperties} onClick={() => setColour("#ffb000")} aria-label="Use gold"/><input className="input" value={colour} maxLength={7} onChange={(event) => setColour(event.target.value)}/></div></div><div className="field"><label>{isVideo ? "Voice" : "Branding"}</label><select className="select" value={voice} onChange={(event) => setVoice(event.target.value)}>{(isVideo ? ["Let NexMind recommend", "Voiceover", "Product-only", "Upload a voice", "Use project voice"] : ["Use source branding", "Use uploaded assets", "Use selected colours only"]).map((value) => <option key={value}>{value}</option>)}</select></div></div>
        <div className="infographic-assets"><header><div><b>Relevant assets</b><span>Logo, screenshots, photos, data files or reference material.</span></div><button className="tool-button" onClick={() => fileInput.current?.click()}><Icon name="upload" size="sm" /> Add assets</button></header>{files.length ? <div className="infographic-asset-list">{files.map((file) => <span key={`${file.name}:${file.size}`}><Icon name="file" size="sm" /> {file.name}</span>)}</div> : <p>No new files added.</p>}<button className="btn text" onClick={() => setResourcesOpen((value) => !value)}>Choose from Your resources <Icon name="arrow" size="sm" /></button>{resourcesOpen ? <div className="resource-picker-list">{data.sources.length ? data.sources.map((item) => <label key={item.id} className="consent-item"><input type="checkbox" checked={resourceIds.includes(item.id)} onChange={() => setResourceIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])}/><span><b>{item.name || item.originalUrl || "Untitled source"}</b><span>{item.kind} · {item.status}</span></span></label>) : <p>Your resources is empty.</p>}</div> : null}</div>
        <div className="direction-split infographic-constraints"><div className="field"><label>Must include <small>Optional</small></label><textarea className="textarea" value={mustInclude} onChange={(event) => setMustInclude(event.target.value)} placeholder="A figure, statement or element that must appear."/></div><div className="field"><label>Must not include <small>Optional</small></label><textarea className="textarea" value={mustAvoid} onChange={(event) => setMustAvoid(event.target.value)} placeholder="Anything outdated, private or off-limits."/></div></div>
      </section></main><aside className="direction-side">{isVideo ? <article className="direction-preview" style={{ "--preview-accent": colour } as React.CSSProperties}><header><span>Direction preview</span><small>{destination} · 30 seconds</small></header><div className="preview-frame"><span>{titleFromSource(source, mode)}</span><h2>{brief.slice(0, 90) || "The main information. Ready to understand."}</h2><i/><small>{direction}</small></div><p>This is the one representative still direction preview. Finished motion begins only after a real payment is confirmed.</p></article> : <article className="no-preview"><span className="page-kicker">No free final preview</span><h2>The infographic is rendered after payment.</h2><p>Review the task, size, source and constraints here. The final HTML/CSS composition is not generated until the 0.10 USDC payment is confirmed.</p></article>}<article className="pricing-card"><span>{isVideo ? "Video production" : "Infographic creation"}</span><strong>A live chain quote appears after approval</strong><small>Balance and $NEX eligibility are read from the verified wallet.</small></article><button className="btn primary full studio-primary" onClick={() => setStep("review")}>Review task <Icon name="arrow" size="sm" /></button><small className="payment-note">Nothing is charged on this screen.</small></aside></section></>;
  }

  const isVideo = mode === "video";
  return <><header className="page-head studio-final-head"><div className="page-head-copy"><span className="page-kicker">NexMarkets Studio</span><h1>What are you trying to make?</h1><p>{isVideo ? "Start with an idea, a goal, a website, a dataset, or assets. NexMind turns context into a production brief before Studio renders the final video." : "Describe the visual, add the source material and attach anything Studio should use."}</p></div></header>
  <section className="studio-source-card"><div className="studio-mode"><button className={isVideo ? "active" : ""} onClick={() => { setMode("video"); setDuration("30 seconds"); }}>Video <small>Intent to finished work</small></button><button className={!isVideo ? "active" : ""} onClick={() => { setMode("infographic"); setDuration("1920x1080"); }}>Infographic <small>0.10 USDC</small></button></div><label className="universal-source"><span>{isVideo ? "Start with an idea, goal, or context." : "Describe the infographic you want."}</span><textarea value={source} onChange={(event) => setSource(event.target.value)} placeholder={isVideo ? "Example: Turn this protocol site and launch notes into a 30-second cinematic X video for crypto-native users." : "Describe what the visual should communicate. You can also paste a website, report, announcement, post or raw data."}/></label><div className="source-actions"><button className="tool-button" onClick={() => document.querySelector<HTMLTextAreaElement>(".universal-source textarea")?.focus()}><Icon name="link" size="sm" /> Add a link</button><button className="tool-button" onClick={() => document.querySelector<HTMLTextAreaElement>(".universal-source textarea")?.focus()}><Icon name="message" size="sm" /> Paste context</button><button className="tool-button" onClick={() => fileInput.current?.click()}><Icon name="upload" size="sm" /> Upload assets</button><button className="tool-button" onClick={() => setResourcesOpen((value) => !value)}><Icon name="vault" size="sm" /> Add data</button><button className="tool-button" onClick={() => router.push("/marketplace?tab=my-work")}><Icon name="market" size="sm" /> Marketplace work</button></div><input ref={fileInput} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.pdf,.csv,.txt,.docx,.pptx,.xlsx" onChange={(event) => setFiles(Array.from(event.target.files || []))}/>{files.length ? <div className="infographic-upload-summary"><b>{files.length} asset{files.length === 1 ? "" : "s"} selected</b><span>{files.map((file) => file.name).join(" · ")}</span></div> : null}{resourcesOpen ? <div className="resource-picker-list">{data.authenticated && data.sources.length ? data.sources.map((item) => <label key={item.id} className="consent-item"><input type="checkbox" checked={resourceIds.includes(item.id)} onChange={() => setResourceIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])}/><span><b>{item.name || item.originalUrl || "Untitled source"}</b><span>{item.kind} · {item.status}</span></span></label>) : <p>{data.authenticated ? "Your resources is empty." : "Connect a wallet to use saved resources."}</p>}</div> : null}<footer className="studio-source-footer"><span><b>{isVideo ? "Conversation first. Render after approval." : "0.10 USDC infographic"}</b><small>{isVideo ? "Brief, storyboard and browser preview stay separate from the paid final render." : "NexMind organises the task in text. Payment is requested only after approval."}</small></span><button className="btn primary" onClick={continueFromEntry}>{isVideo ? "Start direction" : "Continue"} <Icon name="arrow" size="sm" /></button></footer></section><p className="entry-access-note">{isVideo ? "Upload-first context is preserved. NexMind starts from supplied files, links, data and the objective instead of forcing a template choice." : "Add the description and source material first. Payment is requested only after you approve the task."}</p>
  <StudioGallery creations={creations} filter={filter} setFilter={setFilter} onOpen={(id) => router.push(`/studio/${id}`)} /></>;
}

function StudioGallery({ creations, filter, setFilter, onOpen }: { creations: import("@/components/product/types").CreationView[]; filter: string; setFilter: (value: string) => void; onOpen: (id: string) => void }) {
  const filters = [["all", "All"], ["videos", "Videos"], ["infographics", "Infographics"], ["draft", "Drafts"], ["production", "Producing"], ["completed", "Ready"]];
  return <><div className="studio-toolbar"><h2>Your Studio</h2><div className="filter-row">{filters.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div>{creations.length ? <section className="creation-grid">{creations.map((item) => <CreationCard key={item.id} item={item} onOpen={() => onOpen(item.id)}/>)}</section> : <EmptyState icon="studio" title="No creations in this view." text="Start with a source above. Persisted Studio records appear here; sample projects are never inserted."/>}</>;
}
