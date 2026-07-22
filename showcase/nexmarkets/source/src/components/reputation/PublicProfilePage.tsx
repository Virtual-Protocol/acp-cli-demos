"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/product/Icon";
import type { PublicReputation } from "@/components/product/types";
import { compactNumber, initial, metricTotal, reputationData, topicShares } from "./reputation-data";

export type { PublicReputation } from "@/components/product/types";

export function PublicProfilePage({ profile }: { profile: PublicReputation }) {
  const url = typeof window === "undefined" ? "" : window.location.href;
  const copy = async () => navigator.clipboard.writeText(url);
  const share = async () => { if (navigator.share) await navigator.share({ title: profile ? `${profile.user.displayName || profile.handle} · NexCard` : "NexCard", url }); else await copy(); };

  return <div className="public-profile-shell"><header className="public-profile-nav"><Link className="public-profile-brand" href="/dashboard" aria-label="Open NexMarkets"><img src="/nexmarkets-mark.png" alt="" /><b>NexMarkets</b></Link><div className="public-profile-nav-actions"><Link className="btn text" href="/marketplace">Marketplace</Link><button className="btn ghost compact pp-share-nav" onClick={share}><Icon name="share" size="sm" /><span>Share</span></button><Link className="btn primary compact" href="/dashboard"><span className="label-desktop">Open NexMarkets</span><span className="label-mobile">Open app</span></Link></div></header><main className="public-profile-main" id="appMain" tabIndex={-1}><div className="route-enter"><Profile profile={profile} copy={copy} share={share} /></div></main></div>;
}

function reachPath(values: number[]) {
  if (values.length < 2) return null;
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => `${2 + index * (416 / (values.length - 1))},${102 - (Math.max(0, value) / maximum) * 84}`);
  const line = `M${points.join(" L")}`;
  return { line, area: `${line} L418,118 L2,118 Z` };
}

function Profile({ profile, copy, share }: { profile: PublicReputation; copy: () => Promise<void>; share: () => Promise<void> }) {
  const { identity, analysis, enhanced, visibility } = reputationData(profile);
  const isEnhanced = profile.status === "ENHANCED_CARD_READY";
  const name = identity.name || profile.user.displayName || profile.handle;
  const handle = identity.username || profile.handle;
  const location = isEnhanced && visibility.location && typeof enhanced.location === "string" ? enhanced.location : identity.location || profile.user.location || "Location not supplied";
  const availability = isEnhanced && visibility.availability && typeof enhanced.availability === "string" ? enhanced.availability : "";
  const role = isEnhanced && visibility.role && typeof enhanced.role === "string" ? enhanced.role : "";
  const workLine = isEnhanced && visibility.workLine && typeof enhanced.workLine === "string" ? enhanced.workLine : "";
  const areas = isEnhanced && visibility.areas && typeof enhanced.areas === "string" ? enhanced.areas : "";
  const topics = topicShares(analysis.topics);
  const posts = analysis.standout || [];
  const completed = profile.evidence.filter((item) => item.sourceType === "MARKETPLACE_WORK" && item.status === "VERIFIED");
  const reach = analysis.totals?.impressions || 0;
  const chart = reachPath(analysis.weeklyReach || []);
  const activePerWeek = analysis.activeDays && analysis.windowDays ? analysis.activeDays / (analysis.windowDays / 7) : 0;
  const hero = workLine || identity.description || `${name} writes most often about ${topics.map((topic) => topic.name).join(", ") || "their public work"}.`;
  const xUrl = `https://x.com/${encodeURIComponent(handle)}`;
  const inviteUrl = `/marketplace/post?type=directhire&invite=${encodeURIComponent(profile.userId)}`;
  const capabilities = areas.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  return <section className={`signal-profile signal-profile-v3 ${isEnhanced ? "is-enhanced" : "is-base"}`}><header className="signal-profile-hero"><div className="signal-profile-intro"><div className="signal-profile-person">{identity.profile_image_url ? <img src={identity.profile_image_url} alt="" /> : <span>{initial(name)}</span>}<div><b>{name}</b><small>@{handle} · {location}</small></div></div><h1>{hero}</h1><p>{isEnhanced ? "This profile combines reviewed context, public X activity and verified NexMarkets work." : `${name} has not added private professional context; this profile reflects only public X activity.`}</p><div className="signal-profile-facts">{isEnhanced ? <><span>{role || "Role kept private"}</span><span>{availability || "Availability kept private"}</span><span>{completed.length} completed through NexMarkets</span></> : <><span>{compactNumber(reach)} recent reach</span><span>{activePerWeek.toFixed(1)} active days / week</span><span>{analysis.topics?.length || 0} recurring topics</span></>}</div><div className="signal-profile-actions">{isEnhanced ? <Link className="btn primary" href={inviteUrl}>Invite {name.split(" ")[0]}</Link> : <a className="btn primary" href={xUrl} target="_blank" rel="noreferrer">View on X</a>}<button className="btn ghost" onClick={copy}><Icon name="copy" size="sm" /> Copy link</button><button className="btn ghost" onClick={share}><Icon name="share" size="sm" /> Share</button></div></div><article className="signal-profile-snapshot"><header><span>PUBLIC ACTIVITY</span><small>LAST {analysis.windowDays || 90} DAYS</small></header><div className="signal-profile-reach"><strong>{compactNumber(reach)}</strong><span>recent reach</span>{chart ? <svg viewBox="0 0 420 118" preserveAspectRatio="none" role="img" aria-label="Weekly public impression totals"><path d={chart.line}/><path className="fill" d={chart.area}/></svg> : <small>Refresh X analysis to store a weekly activity series.</small>}</div><div className="signal-profile-metrics"><article><b>{compactNumber(analysis.totals?.replies)}</b><span>public replies</span></article><article><b>{activePerWeek.toFixed(1)}</b><span>active days / week</span></article><article><b>{analysis.tweetsChecked || 0}</b><span>posts checked</span></article></div><div className="signal-profile-topics">{topics.map((topic) => <span key={topic.name} style={{ "--w": `${topic.share}%` } as CSSProperties}>{topic.name} <b>{topic.share}%</b></span>)}</div></article></header><main className="signal-profile-body-v3">{completed.length ? <section className="signal-profile-section signal-selected-work-v3"><header><span>SELECTED WORK</span><h2>Completed through NexMarkets</h2></header><div className="signal-selected-grid-v3"><article className="signal-feature-work-v3"><div className="signal-feature-art-v3"><div className="signal-feature-brand"><b>NEXMARKETS</b><small>VERIFIED DELIVERY</small></div><div className="signal-feature-frame"><span>01</span><strong>{String(completed[0].excerpt || "Approved Marketplace work")}</strong><div><i /><i /><i /></div></div></div><div className="signal-feature-copy-v3"><span>VERIFIED CONTRIBUTION</span><h3>{String(completed[0].excerpt || "Completed work approved by the hiring side.")}</h3><p>This evidence is attached to the completed NexMarkets Workroom record.</p></div></article><div className="signal-work-list-v3">{completed.slice(1, 3).map((item) => <article key={String(item.id)}><span>COMPLETED WORK</span><h3>{String(item.excerpt || "Approved Marketplace delivery")}</h3><small>Completed through NexMarkets</small></article>)}</div></div></section> : null}<div className="signal-profile-two-col-v3">{capabilities.length ? <section className="signal-profile-section signal-profile-capabilities-v3"><header><span>AVAILABLE WORK</span><h2>What {name.split(" ")[0]} can take on</h2></header><div>{capabilities.map((capability, index) => <article className="signal-capability-row" key={capability}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{capability}</h3><p>Reviewed and approved for public display by the profile owner.</p></div></article>)}</div></section> : null}<section className="signal-profile-section signal-standout-posts-v3"><header><span>FROM X</span><h2>Posts behind the signal</h2></header><div>{posts.slice(0, 3).map((post, index) => <article key={post.id}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{post.text}</h3><p>{compactNumber(metricTotal(post.metrics))} public interactions</p></div></article>)}</div></section></div>{isEnhanced ? <section className="signal-profile-cta signal-profile-cta-v3"><div><span>DIRECT HIRE</span><h2>Have work that matches this profile?</h2><p>Send the outcome, timing and approval condition through a private Direct Hire request in Marketplace.</p></div><Link className="btn primary" href={inviteUrl}>Invite {name.split(" ")[0]}</Link></section> : null}</main></section>;
}
