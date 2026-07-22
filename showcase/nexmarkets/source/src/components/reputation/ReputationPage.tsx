"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import type { ReputationView } from "@/components/product/types";
import { NexCard } from "./NexCard";
import { compactNumber, metricTotal, reputationData, topicShares } from "./reputation-data";

function nexBalance(atomic: string | null) {
  if (!atomic) return 0;
  try { return Number(BigInt(atomic) / 10n ** 18n); } catch { return 0; }
}

export function ReputationPage() {
  const { data, loading, error, api, refresh, notify } = useProduct();
  const [working, setWorking] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  if (loading || error || !data) return <LoadState label="Loading NexCard" />;

  const connected = data.integrations.x.connected;
  const profile = data.reputation;

  const connectX = () => {
    window.location.assign("/api/v1/x/connect");
  };

  const analyse = async () => {
    if (!connected) {
      connectX();
      return;
    }
    setWorking(true);
    try {
      await api<ReputationView>("/api/v1/reputation/analyse", { method: "POST", body: "{}" });
      await refresh();
      notify("NexCard ready", "NexMind organised the connected X account into a public NexCard.");
    } catch (reason) {
      notify("NexMind analysis failed", reason instanceof Error ? reason.message : "The connected X account could not be analysed.");
    } finally {
      setWorking(false);
    }
  };

  if (working) return <ReputationAnalysis handle={data.user?.handle || data.user?.displayName || "Connected X"} />;

  if (!connected || !profile) return <>
    <section className="signal-entry signal-entry-welcome">
      <div className="signal-entry-copy"><span className="page-kicker">NEXCARD</span><h1>Let your public work speak before you have to explain it.</h1><p>Connect X to turn the work, ideas and conversations already visible on your account into a clear signal people can understand and share.</p><div className="signal-entry-actions"><button className="btn primary" onClick={connected ? () => void analyse() : connectX}>{connected ? "Create my NexCard" : "Connect X to begin"} <Icon name="arrow" size="sm" /></button><button className="btn ghost" onClick={() => setChecksOpen(true)}>See what NexMarkets checks</button></div><div className="signal-entry-assurance"><i><Icon name="check" size="sm" /></i><span><b>You review the card before anything becomes public.</b><small>NexMarkets never requests direct messages, drafts, bookmarks or private lists.</small></span></div></div>
      <aside className="signal-entry-preview" aria-label="Preview of a base NexCard"><header><span>YOUR PUBLIC SIGNAL</span><small>LAST 90 DAYS</small></header><div className="signal-preview-person"><i>X</i><span><b>Your X profile</b><small>Name - handle - location - account history</small></span></div><div className="signal-preview-grid"><article><span>Reach</span><i /></article><article><span>Conversation</span><i /></article><article><span>Consistency</span><i /></article><article><span>Topics</span><i /></article></div><footer><span>No job title written for you.</span><b>No public score.</b></footer></aside>
      <div className="signal-source-line"><article><span>01</span><div><b>X supplies the public record</b><small>Profile details, recent posts and the response around them.</small></div></article><article><span>02</span><div><b>NexMind organises the signal</b><small>Public activity becomes identity, work signature, capabilities and evidence.</small></div></article><article><span>03</span><div><b>NexMarkets adds completed work</b><small>Only Marketplace delivery approved by the hiring side.</small></div></article></div>
    </section>
    <div className={`backdrop ${checksOpen ? "open" : ""}`} onClick={() => setChecksOpen(false)} />
    <section className={`modal ${checksOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="What X contributes"><header className="modal-head"><h2>What X contributes</h2><button className="close-button" onClick={() => setChecksOpen(false)}><Icon name="close" size="sm" /></button></header><div className="modal-body"><p className="modal-lead">The base NexCard is built from information already public on the connected account.</p><div className="consent-list"><div className="consent-item"><span><b>Profile and account history</b><span>Name, handle, profile image, location and account age.</span></span></div><div className="consent-item"><span><b>Recent public activity</b><span>Posts, public links, posting rhythm and recurring topics.</span></span></div><div className="consent-item"><span><b>Public response</b><span>Impressions, replies, reposts and quotes available from the public account signal.</span></span></div></div><p className="modal-fine">X does not supply your professional role, availability, preferred work or contribution to a project. Those remain empty until you add them.</p></div><footer className="modal-actions"><button className="btn ghost" onClick={() => setChecksOpen(false)}>Close</button><button className="btn primary" onClick={connected ? () => void analyse() : connectX}>{connected ? "Create NexCard" : "Connect X"}</button></footer></section>
  </>;

  return <ReputationCardPage profile={profile} onRefresh={analyse} />;
}

function ReputationAnalysis({ handle }: { handle: string }) {
  const steps = [["Profile and account history", "Name, handle, profile image, location and account age"], ["Recent public posts", "The last 90 days of posts and linked public work"], ["Reach and conversation", "Impressions, replies, reposts and quotes"], ["Recurring topics", "The subjects that keep returning across the account"], ["Standout posts", "The posts that travelled furthest or started real discussion"], ["Base NexCard", "A shareable snapshot prepared for your review"]];
  const visible = 4;
  return <section className="signal-analysis"><header><span className="page-kicker">@{handle.replace(/^@/, "")}</span><h1>Reading the public account, not writing a biography.</h1><p>NexMind is organising what X can actually show. Your role, availability and professional direction are left open for you.</p></header><div className="signal-analysis-progress"><i style={{ "--progress": `${Math.round((visible / steps.length) * 100)}%` } as React.CSSProperties} /></div><div className="signal-analysis-layout"><main>{steps.map(([label, copy], index) => <article className={index < visible ? "ready" : "waiting"} key={label}><span>{index < visible ? <Icon name="check" size="sm" /> : String(index + 1).padStart(2, "0")}</span><div><b>{label}</b><small>{copy}</small></div><em>{index < visible ? index === visible - 1 ? "Reading" : "Ready" : "Waiting"}</em></article>)}</main><aside><span>WINDOW</span><strong>90 days</strong><div><b>{Math.min(96, visible * 16)}</b><small>data points checked</small></div><div><b>{Math.min(3, Math.ceil(visible / 2))}</b><small>recurring topics</small></div><div><b>{Math.min(5, visible)}</b><small>standout posts</small></div><p>Nothing is public until you open and share the finished card.</p></aside></div></section>;
}

function ReputationCardPage({ profile, onRefresh }: { profile: ReputationView; onRefresh: () => Promise<void> }) {
  const router = useRouter();
  const { data, notify } = useProduct();
  const { identity, analysis, enhanced, settings, visibility } = reputationData(profile);
  const isEnhanced = profile.status === "ENHANCED_CARD_READY";
  const balance = nexBalance(data?.wallet.nexAtomic || null);
  const eligible = balance >= 50_000;
  const published = settings.published === true;
  const topics = topicShares(analysis.topics);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/profile/${profile.publicSlug}`;
  const copy = async () => { await navigator.clipboard.writeText(url); notify("Link copied", "The public NexCard link is on your clipboard."); };
  const share = async () => { if (navigator.share) await navigator.share({ title: `${identity.name || profile.handle} - NexCard`, url }); else await copy(); };
  const enhanceSoon = () => notify("Coming soon", "Enhance with NexMind is not available in this production view yet.");
  const download = () => {
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 900; const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#101010"; context.fillRect(0, 0, 1600, 900); context.fillStyle = "#d2a84a"; context.fillRect(0, 0, 24, 900); context.fillStyle = "#f4efe3"; context.font = "700 34px system-ui"; context.fillText("NEXCARD", 90, 100); context.font = "700 82px system-ui"; context.fillText(identity.name || profile.handle, 90, 260); context.font = "32px system-ui"; context.fillStyle = "#c9c4b8"; context.fillText(`@${identity.username || profile.handle} - ${identity.location || ""}`, 90, 325); context.font = "42px system-ui"; context.fillStyle = "#f4efe3"; const line = typeof enhanced.workLine === "string" && visibility.workLine ? enhanced.workLine : identity.description || "Public activity from X"; context.fillText(line.slice(0, 62), 90, 445); context.fillStyle = "#d2a84a"; context.font = "700 100px system-ui"; context.fillText(compactNumber(analysis.totals?.impressions), 90, 670); context.fillStyle = "#c9c4b8"; context.font = "28px system-ui"; context.fillText("RECENT PUBLIC IMPRESSIONS", 90, 715); const anchor = document.createElement("a"); anchor.href = canvas.toDataURL("image/png"); anchor.download = `${profile.publicSlug}-nexcard.png`; anchor.click();
  };
  const posts = analysis.standout || [];
  return <><header className="signal-page-head"><div><span className="page-kicker">NEXCARD</span><h1>{isEnhanced ? "X showed the pattern. You added the work behind it." : "Here is what your X activity shows."}</h1><p>{isEnhanced ? "Your role, availability and preferred work now sit alongside the public activity people can already see." : "Reach, conversation, consistency and recurring topics - without inventing a role, expertise or availability."}</p></div><button className="btn ghost" onClick={() => void onRefresh()}><Icon name="refresh" size="sm" /> Refresh X data</button></header><section className="signal-card-layout"><main><div className="signal-card-frame"><NexCard profile={profile} /></div><div className="signal-card-actions"><button className="btn primary" disabled={!published} onClick={() => router.push(`/profile/${profile.publicSlug}`)}>Open public profile <Icon name="arrow" size="sm" /></button><button className="btn ghost" disabled={!published} onClick={copy}><Icon name="copy" size="sm" /> Copy link</button><button className="btn ghost" onClick={download}><Icon name="download" size="sm" /> Download card</button><button className="btn ghost" disabled={!published} onClick={share}><Icon name="share" size="sm" /> Share</button></div><section className="signal-patterns"><header><span>{isEnhanced ? "AVAILABLE WORK" : "TOPICS"}</span><h2>{isEnhanced ? "What this person wants to be hired for." : "What appears most often in the account."}</h2></header><div>{topics.map((topic, index) => <article className={isEnhanced ? "signal-capability-row" : "signal-topic-row"} key={topic.name}><strong>{isEnhanced ? String(index + 1).padStart(2, "0") : `${topic.share}%`}</strong><div><h3>{topic.name}</h3><p>{topic.count} public references in the analysed window.</p></div></article>)}</div></section><details className="signal-posts"><summary><span>Posts behind this snapshot</span><small>{posts.length} standout posts from {analysis.tweetsChecked || 0} data points checked</small></summary><div>{posts.map((post, index) => <article key={post.id}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{post.text}</b><small>{compactNumber(metricTotal(post.metrics))} public interactions</small></div>{post.url ? <a className="btn text" href={post.url} target="_blank" rel="noreferrer">View</a> : null}</article>)}</div></details></main><aside className="signal-card-rail signal-card-rail-v3"><section className="signal-context-card matching-lock"><span><Icon name="mic" size="lg" /></span><h2>Enhance with NexMind</h2><p>Coming soon. The live profile session will let you confirm your role, availability and preferred work before anything new becomes public.</p><div className="signal-access"><b>{data?.wallet.address ? `${balance.toLocaleString()} $NEX detected` : "Wallet not connected"}</b><small>{eligible ? "Profile enhancement will be available from this card." : "50,000 $NEX access check will apply when enhancement opens."}</small></div><button className="btn primary full" disabled onClick={enhanceSoon}><Icon name="mic" size="sm" /> Coming soon</button></section></aside></section></>;
}
