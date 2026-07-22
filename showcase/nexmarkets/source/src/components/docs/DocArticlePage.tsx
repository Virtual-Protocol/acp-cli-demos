"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { actionHref, docHref, docsArticles } from "./docs-data";

export function DocArticlePage({ slug }: { slug: string }) {
  const router = useRouter();
  const current = docsArticles.findIndex((item) => item.id === slug);
  const article = docsArticles[current];
  const previous = docsArticles[(current - 1 + docsArticles.length) % docsArticles.length];
  const next = docsArticles[(current + 1) % docsArticles.length];
  const related = article ? docsArticles.filter((item) => item.categoryId === article.categoryId && item.id !== article.id).slice(0, 4) : [];
  const minutes = useMemo(() => article ? Math.max(2, Math.ceil([article.summary, ...article.sections.map((section) => `${section.body} ${(section.points || []).join(" ")}`)].join(" ").split(/\s+/).length / 210)) : 0, [article]);
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".view-scroll");
    const progress = document.querySelector<HTMLElement>(".reading-progress i");
    if (!scroller || !progress) return;
    const update = () => { const maximum = scroller.scrollHeight - scroller.clientHeight; progress.style.width = maximum > 0 ? `${Math.min(100, scroller.scrollTop / maximum * 100)}%` : "100%"; };
    update(); scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [slug]);
  if (!article) return <section className="empty-state"><div><span className="empty-mark"><Icon name="docs" /></span><h2>Guide not found.</h2><p>The requested guide is not part of the local NexMarkets Docs library.</p><button className="btn primary" onClick={() => router.push("/docs")}>All Docs</button></div></section>;
  const openAction = () => router.push(actionHref(article.action));
  return <><div className="reading-progress" aria-hidden="true"><i /></div><div className="docs-article-top"><button className="btn text article-back" onClick={() => router.push("/docs")}><Icon name="chevron" size="sm" /> All Docs</button>{article.action ? <button className="btn primary compact" onClick={openAction}>{article.action.label} <Icon name="arrow" size="sm" /></button> : null}</div><section className="docs-article-layout"><aside className="article-toc"><span>{article.category}</span><h3>On this page</h3>{article.sections.map((section, index) => <button key={section.title} onClick={() => document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: "smooth" })}>{section.title}</button>)}</aside><article className="article docs-article"><header><div className="article-meta"><span>{article.category}</span><span>Updated 13 Jul 2026</span><span>{minutes} min read</span></div><h1>{article.topic}</h1><p>{article.summary}</p>{article.facts?.length ? <dl className="doc-facts">{article.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}</header>{article.sections.map((section, index) => <section className="article-section" id={`section-${index}`} key={section.title}><span className="doc-section-number">{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2><p>{section.body}</p>{section.points?.length ? section.ordered ? <ol className="doc-steps">{section.points.map((point, pointIndex) => <li key={point}><span>{String(pointIndex + 1).padStart(2, "0")}</span><p>{point}</p></li>)}</ol> : <ul className="doc-points">{section.points.map((point) => <li key={point}><p>{point}</p></li>)}</ul> : null}</section>)}<section className="doc-next-action"><span>Continue in NexMarkets</span><h2>{article.action?.label || "Return to the product"}</h2><p>The guide ends where the real record begins. Open the relevant page and continue from your own account state.</p><button className="btn primary" onClick={openAction}>{article.action?.label || "Open NexMarkets"} <Icon name="arrow" size="sm" /></button></section><nav className="article-pagination"><button className="doc-page-link" onClick={() => router.push(docHref(previous.id))}><small>Previous</small><b>{previous.topic}</b></button><button className="doc-page-link next" onClick={() => router.push(docHref(next.id))}><small>Next</small><b>{next.topic}</b></button></nav><section className="docs-related"><div className="section-top"><h2>Related guides</h2><span>{article.category}</span></div>{related.map((item) => <button key={item.id} onClick={() => router.push(docHref(item.id))}><b>{item.topic}</b><span>{item.summary}</span><Icon name="arrow" size="sm" /></button>)}</section></article></section></>;
}
