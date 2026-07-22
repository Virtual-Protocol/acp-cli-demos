"use client";

import type { CSSProperties } from "react";
import type { ReputationView } from "@/components/product/types";
import { compactNumber, initial, reputationData, topicShares } from "./reputation-data";

export function NexCard({ profile }: { profile: ReputationView }) {
  const { identity, analysis, enhanced, visibility } = reputationData(profile);
  const isEnhanced = profile.status === "ENHANCED_CARD_READY";
  const name = identity.name || profile.handle;
  const handle = identity.username || profile.handle;
  const location = isEnhanced && visibility.location && typeof enhanced.location === "string" ? enhanced.location : identity.location || "Location not supplied";
  const role = isEnhanced && visibility.role && typeof enhanced.role === "string" ? enhanced.role : "";
  const line = isEnhanced && visibility.workLine && typeof enhanced.workLine === "string" ? enhanced.workLine : identity.description || "Public activity from X.";
  const availability = isEnhanced && visibility.availability && typeof enhanced.availability === "string" ? enhanced.availability : "";
  const topics = topicShares(analysis.topics);
  const reach = analysis.totals?.impressions || 0;
  const activePerWeek = analysis.activeDays && analysis.windowDays ? analysis.activeDays / (analysis.windowDays / 7) : 0;

  return <article className={`signal-card ${isEnhanced ? "signal-card-enhanced" : "signal-card-base"}`} id="nexCardExport">
    <header className="signal-card-top"><div><img src="/nexmarkets-mark.png" alt="" /><span>NEXCARD</span></div><small>{isEnhanced ? `VERSION ${profile.currentCardVersion}` : `X SNAPSHOT · ${analysis.windowDays || 90} DAYS`}</small></header>
    <div className="signal-card-main signal-card-main-v3">
      <section className="signal-card-identity signal-card-identity-v3">
        <div className="signal-person"><span className="signal-avatar">{initial(name)}</span><p>@{handle} · <span>{location}</span></p></div>
        <div className="signal-card-name"><h2>{name}</h2><div className="signal-card-context"><span>{role || `X activity · last ${analysis.windowDays || 90} days`}</span><b>{isEnhanced ? "Context reviewed by the account owner" : "No role or availability inferred"}</b></div></div>
        <p className="signal-card-position">{line}</p>
        {availability ? <div className="signal-card-availability"><small>AVAILABLE</small><span>{availability}</span></div> : null}
      </section>
      <section className="signal-card-data signal-card-data-v3">
        <div className="signal-reach signal-reach-v3"><div><span>RECENT REACH</span><strong>{compactNumber(reach)}</strong><small>public impressions</small></div><svg viewBox="0 0 320 92" preserveAspectRatio="none" aria-hidden="true"><path d="M2 79 C34 72 46 75 67 58 S108 54 128 60 S164 39 186 44 S224 24 246 31 S282 10 318 15"/><path className="fill" d="M2 79 C34 72 46 75 67 58 S108 54 128 60 S164 39 186 44 S224 24 246 31 S282 10 318 15 L318 92 L2 92 Z"/></svg></div>
        <div className="signal-mini-stats signal-mini-stats-v3"><article><b>{compactNumber(analysis.totals?.replies)}</b><span>public replies</span></article><article><b>{activePerWeek.toFixed(1)}</b><span>active days / week</span></article><article><b>{analysis.tweetsChecked || 0}</b><span>posts checked</span></article></div>
        <div className="signal-topic-bars signal-topic-bars-v3">{topics.map((topic) => <article key={topic.name}><span>{topic.name}</span><i><b style={{ "--w": `${topic.share}%` } as CSSProperties}></b></i><em>{topic.share}%</em></article>)}</div>
      </section>
    </div>
    <footer className="signal-card-bottom signal-card-bottom-v3"><span><b>{analysis.tweetsChecked || 0}</b> data points checked</span><span><b>{analysis.topics?.length || 0}</b> recurring topics</span><span>{isEnhanced ? <><b>{profile.evidence.filter((item) => item.sourceType === "MARKETPLACE_WORK").length}</b> completed through NexMarkets</> : `Updated ${new Date(profile.lastXRefreshAt || profile.updatedAt).toLocaleDateString()}`}</span></footer>
  </article>;
}
