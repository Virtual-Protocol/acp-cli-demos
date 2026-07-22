import { Suspense } from "react";
import { NexMindPage } from "@/components/nexmind/NexMindPage";

export default function Page() {
  return <Suspense fallback={<div className="market-empty"><h2>Loading NexMind…</h2></div>}><NexMindPage /></Suspense>;
}
