"use client";

import type { CreationView } from "@/components/product/types";
import { formatDate } from "@/components/product/format";

export function CreationCard({ item, onOpen }: { item: CreationView; onOpen: () => void }) {
  return <button className="creation-card" data-type={item.type} data-state={item.state} onClick={onOpen}>
    <div className={`creation-thumb ${item.type === "infographic" ? "info" : item.state === "completed" ? "video" : "dark"}`}>
      <b>{item.headline}</b><span>{item.duration}</span><i>{item.type === "video" ? "▶" : "↗"}</i>
    </div>
    <div className="creation-meta"><h3>{item.title}</h3><p>{item.format}</p><footer><span>{item.state[0].toUpperCase() + item.state.slice(1)}</span><span>{formatDate(item.edited)}</span></footer></div>
  </button>;
}
