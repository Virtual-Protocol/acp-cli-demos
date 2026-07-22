import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LandingPage } from "@/components/product/LandingPage";

export default async function Home() {
  const headerMap = await headers();
  const req = new Request("http://localhost", {
    headers: headerMap,
  });
  const session = await getSession(req);

  if (session && process.env.NODE_ENV !== "development") {
    redirect("/reputation");
  }

  return <LandingPage />;
}
