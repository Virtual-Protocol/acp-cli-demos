import { Suspense } from "react";
import { WorkroomPage } from "@/components/workrooms/WorkroomPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<div className="market-empty"><h2>Loading Workroomâ€¦</h2></div>}><WorkroomPage id={id} /></Suspense>;
}
