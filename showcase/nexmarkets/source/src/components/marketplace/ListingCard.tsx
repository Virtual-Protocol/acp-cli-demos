"use client";

import { Icon } from "@/components/product/Icon";
import { formatDate } from "@/components/product/format";
import type { ListingView } from "@/components/product/types";

export function ListingCard({ item, onOpen }: { item: ListingView; onOpen: () => void }) {
  const serviceOffer = item.type === "Service" && item.detail.serviceOffer === true;
  return <button className="market-card" onClick={onOpen}>
    <header><span className="market-kind"><i>{item.type.slice(0, 2).toUpperCase()}</i>{item.type}</span><span className={`funding-state ${item.funded || serviceOffer ? "funded" : ""}`}>{serviceOffer ? "Available" : item.funded ? "Funding secured" : item.status.replaceAll("_", " ")}</span></header>
    <div className="market-card-copy"><h2>{item.title}</h2><p>{item.outcome}</p></div>
    <div className="market-capabilities">{item.skills.length ? item.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>) : <span>Scope-led opportunity</span>}</div>
    <div className="market-proof"><span><small>{serviceOffer ? "Provider" : "Owner"}</small><b>{item.owner}</b></span><span><small>{serviceOffer ? "Delivery" : "Responses"}</small><b>{serviceOffer && typeof item.detail.deliveryDays === "number" ? `${item.detail.deliveryDays} days` : item.applicants}</b></span><span><small>{serviceOffer ? "Price" : "Deadline"}</small><b>{serviceOffer ? item.budget : formatDate(item.deadline)}</b></span></div>
    <footer><strong>{item.budget}</strong><span>View details <Icon name="arrow" size="sm" /></span></footer>
  </button>;
}
