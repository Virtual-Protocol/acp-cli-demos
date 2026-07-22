"use client";

import { Icon } from "./Icon";
import { useProduct } from "./ProductProvider";

export function LoadState({ label = "Loading your NexMarkets workspace" }: { label?: string }) {
  const { loading, error, refresh } = useProduct();
  if (loading) {
    return <section className="empty-state"><div><span className="empty-mark"><Icon name="refresh" /></span><h2>Loading</h2><p>{label}.</p></div></section>;
  }
  if (error) {
    return <section className="empty-state"><div><span className="empty-mark"><Icon name="close" /></span><h2>Product data is unavailable.</h2><p>{error}</p><button className="btn primary" onClick={() => void refresh()}>Try again</button></div></section>;
  }
  return null;
}

export function EmptyState({ icon = "file", title, text, action }: { icon?: Parameters<typeof Icon>[0]["name"]; title: string; text: string; action?: React.ReactNode }) {
  return <section className="empty-state"><div><span className="empty-mark"><Icon name={icon} /></span><h2>{title}</h2><p>{text}</p>{action}</div></section>;
}
