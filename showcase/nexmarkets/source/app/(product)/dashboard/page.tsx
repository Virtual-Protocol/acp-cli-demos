import { redirect } from "next/navigation";
import { DashboardPage } from "@/components/dashboard/DashboardPage";

export default function Page() {
  if (process.env.NODE_ENV !== "development") redirect("/reputation");
  return <DashboardPage />;
}
