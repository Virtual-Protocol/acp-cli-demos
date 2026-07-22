import { Suspense } from "react";
import { PostWorkPage } from "@/components/marketplace/PostWorkPage";

export default function Page() { return <Suspense fallback={<div className="market-empty"><h2>Loading work formâ€¦</h2></div>}><PostWorkPage /></Suspense>; }
