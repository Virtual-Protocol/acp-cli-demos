"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/product/Icon";
import { docHref, docsArticles, docsCategories, matchesDoc } from "./docs-data";

export function DocsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => docsArticles.filter((article) => matchesDoc(article, query)), [query]);
  const journeys: Array<[string, string, string, IconName]> = [
    ["Create", "A video or infographic", "studio--create-a-video", "studio"],
    ["Hire", "Post work or request a Service", "marketplace--post-work-for-one-person", "market"],
    ["Find work", "Apply and follow every outcome", "marketplace--find-and-apply-for-work", "check"],
    ["Build reputation", "Connect X and create a NexCard", "reputation--start-and-connect-x", "reputation"],
    ["Money and $NEX", "Fund work, earn and check holder access", "money--wallet-and-usdc", "wallet"],
  ];
  return <section className="docs-home">
    <header className="docs-home-hero"><div><span className="page-kicker">NexMarkets Docs</span><h1>Find the answer before you create, pay or publish.</h1><p>Each guide names the button, amount and approval point you will see in the product.</p></div><label className="docs-search docs-search-large"><Icon name="search" size="sm" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search: post work for a group, create infographic, declined application…" /></label></header>
    {!query ? <section className="docs-journeys"><div className="section-top"><h2>What are you trying to do?</h2><span>Start with the outcome</span></div><div className="docs-journey-grid">{journeys.map(([title, copy, id, icon]) => <button className="docs-journey" key={id} onClick={() => router.push(docHref(id))}><i><Icon name={icon} /></i><span><b>{title}</b><small>{copy}</small></span><Icon name="arrow" size="sm" /></button>)}</div></section> : null}
    <section className="docs-library"><div className="section-top"><h2>{query ? "Search results" : "All guides"}</h2><span>{query ? `${matches.length} result${matches.length === 1 ? "" : "s"}` : `${docsArticles.length} practical guides`}</span></div><div className="docs-library-content">{query ? matches.length ? <><div className="docs-results-head"><span>{matches.length} guide{matches.length === 1 ? "" : "s"}</span><b>Results for “{query}”</b></div><div className="docs-results-list">{matches.map((article) => <button className="docs-result" key={article.id} onClick={() => router.push(docHref(article.id))}><span>{article.category}</span><b>{article.topic}</b><p>{article.summary}</p><Icon name="arrow" size="sm" /></button>)}</div></> : <div className="docs-no-results"><span><Icon name="search" size="lg" /></span><h2>No guide matches “{query}”.</h2><p>Try the action you are taking: create a video, post group work, declined application, buy $NEX or connect X.</p></div> : docsCategories.map((category) => { const guides = docsArticles.filter((article) => article.categoryId === category.id); return <section className="docs-group" key={category.id}><header><span className="docs-group-icon"><Icon name={category.icon as IconName} /></span><div><h2>{category.title}</h2><p>{category.description}</p></div><small>{guides.length} guides</small></header><div className="docs-guide-list">{guides.map((article) => <button key={article.id} onClick={() => router.push(docHref(article.id))}><span><b>{article.topic}</b><small>{article.summary}</small></span><Icon name="arrow" size="sm" /></button>)}</div></section>; })}</div></section>
  </section>;
}
