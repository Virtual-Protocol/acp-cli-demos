import { Suspense } from "react";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function Page() { return <Suspense fallback={<div className="market-empty"><h2>Loading Settingsâ€¦</h2></div>}><SettingsPage /></Suspense>; }
