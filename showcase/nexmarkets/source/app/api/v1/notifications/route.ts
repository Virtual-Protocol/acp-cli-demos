import { getPrisma } from "@/lib/db";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const url = new URL(request.url); const cursor = url.searchParams.get("cursor") || undefined;
  const items = await getPrisma()!.notification.findMany({ where: { userId: auth.session.userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0, take: 51 });
  const page = items.slice(0, 50); return json({ items: page.map(({ deepLink, ...item }) => ({ ...item, href: deepLink })), nextCursor: items.length > 50 ? page.at(-1)?.id ?? null : null }, auth.id);
}
