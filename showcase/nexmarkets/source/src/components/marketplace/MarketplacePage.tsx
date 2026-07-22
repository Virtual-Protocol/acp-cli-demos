"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { EmptyState, LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import { formatDate } from "@/components/product/format";
import { ListingCard } from "./ListingCard";

type Tab = "discover" | "my-work" | "services" | "direct";

function tabFromParam(value: string | null): Tab {
  return value === "my-work" || value === "mywork" ? "my-work" : value === "services" || value === "direct" || value === "discover" ? value : "discover";
}

export function MarketplacePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, loading, error } = useProduct();
  const requestedTab = params.get("tab");
  const tab = tabFromParam(requestedTab);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [workStatus, setWorkStatus] = useState("all");

  const chooseTab = (next: Tab) => {
    router.push(next === "discover" ? "/marketplace?tab=discover" : `/marketplace?tab=${next}`);
  };
  const listings = useMemo(() => {
    if (!data) return [];
    let records = data.listings;
    if (tab === "services") records = records.filter((item) => item.type === "Service");
    if (tab === "direct") records = records.filter((item) => item.type === "Direct Hire");
    if (type !== "all") records = records.filter((item) => item.type.toLowerCase().replaceAll(" ", "") === type);
    const needle = query.trim().toLowerCase();
    if (needle) records = records.filter((item) => `${item.title} ${item.outcome} ${item.skills.join(" ")} ${item.owner}`.toLowerCase().includes(needle));
    return records;
  }, [data, query, tab, type]);
  if (loading || error || !data) return <LoadState label="Loading Marketplace" />;

  const work = data.myWork.filter((item) => workStatus === "all" || item.status.toLowerCase().replaceAll(" ", "") === workStatus);
  const tabs: Array<[Tab, string]> = [["discover", "Discover"], ["my-work", "My work"], ["services", "Services"], ["direct", "Direct Hire"]];
  const types = [["all", "All"], ["task", "Tasks"], ["service", "Services"], ["role", "Roles"], ["campaign", "Campaigns"], ["directhire", "Direct Hire"]];
  const statuses = [["all", "All"], ["posted", "Posted"], ["applied", "Applied"], ["shortlisted", "Shortlisted"], ["active", "Active"], ["waitingforapproval", "Waiting for approval"], ["completed", "Completed"], ["declined", "Declined"]];

  return <><header className="page-head market-head"><div className="page-head-copy"><span className="page-kicker">Marketplace</span><h1>Find the right work. Put clear work into motion.</h1><p>Every open opportunity is a persisted Listing. Funding, applications, delivery and approval stay attached to the same record.</p></div><div className="head-actions">{data.authenticated ? <button className="btn primary" onClick={() => router.push(tab === "services" ? "/marketplace/post?type=service" : "/marketplace/post")}><Icon name="plus" size="sm" /> {tab === "services" ? "Offer a Service" : "Post work"}</button> : null}</div></header>
    <nav className="market-primary" aria-label="Marketplace">{tabs.map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => chooseTab(value)}>{label}</button>)}<button onClick={() => router.push(tab === "services" ? "/marketplace/post?type=service" : "/marketplace/post")}>{tab === "services" ? "Offer a Service" : "Post work"}</button></nav>
    {tab === "my-work" ? <><div className="work-status-tabs">{statuses.map(([value, label]) => <button key={value} className={workStatus === value ? "active" : ""} onClick={() => setWorkStatus(value)}>{label}</button>)}</div>{work.length ? <section className="my-work-list">{work.map((item) => <button key={item.id} className="my-work-row" onClick={() => router.push(item.route === "workroom" ? `/workrooms/${item.entityId}` : item.listingId ? `/marketplace/${data.listings.find((listing) => listing.id === item.listingId)?.slug || ""}` : "/marketplace")}><i>{item.type.slice(0, 2).toUpperCase()}</i><span className="my-work-copy"><small>{item.side}</small><b>{item.title}</b><span>{item.detail}</span></span><span className={`pill ${["Active", "Shortlisted"].includes(item.status) ? "gold" : item.status === "Completed" ? "green" : item.status === "Declined" ? "red" : ""}`}>{item.status}</span><time>{formatDate(item.due)}</time><span className="work-row-action">View details <Icon name="arrow" size="sm" /></span></button>)}</section> : <EmptyState icon="workroom" title="No work in this state." text="Choose another status or browse open work." action={<button className="btn primary" onClick={() => chooseTab("discover")}>Discover work</button>} />}</> : <>
      <div className="market-tools"><label className="market-search"><Icon name="search" size="sm" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the work, skill, project or person" /></label><button className={`filter-button ${filtersOpen ? "active" : ""}`} aria-expanded={filtersOpen} aria-controls="market-type-filters" onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size="sm" /> Filters</button><div className="market-view-toggle" aria-label="Choose Marketplace layout"><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>Cards</button><button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Table</button></div></div>
      {filtersOpen ? <div className="filter-row market-type-row" id="market-type-filters">{types.map(([value, label]) => <button key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{label}</button>)}</div> : null}
      <section className={`market-results ${view}`}>{listings.length ? view === "cards" ? <div className="market-card-grid">{listings.map((item) => <ListingCard key={item.id} item={item} onOpen={() => router.push(`/marketplace/${item.slug}`)} />)}</div> : <div className="market-table"><div className="market-table-head"><span>Type</span><span>Work</span><span>Capability</span><span>Offer</span><span /></div>{listings.map((item) => <button className="market-table-row" key={item.id} onClick={() => router.push(`/marketplace/${item.slug}`)}><span><i>{item.type.slice(0, 2).toUpperCase()}</i><b>{item.type}</b></span><span><b>{item.title}</b><small>{item.owner}</small></span><span>{item.skills.join(" · ") || item.outcome}</span><span><b>{item.budget}</b><small>{formatDate(item.deadline)}</small></span><Icon name="arrow" size="sm" /></button>)}</div> : <EmptyState icon="market" title="No open Listings match." text="Change the search or filter. Only genuinely open public records appear here." />}</section>
    </>}
  </>;
}
