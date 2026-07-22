import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { isDisputeResolver } from "@/lib/roles";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  if (!isDisputeResolver(auth.session.user)) return problem(auth.id, 403, "DISPUTE_RESOLVER_REQUIRED", "Resolver access required", "Use the verified wallet configured for the on-chain dispute resolver role.");
  const items = await getPrisma()!.workroomDispute.findMany({
    where: { status: "OPEN", workroom: { status: "DISPUTED" } },
    include: {
      openedBy: { select: { id: true, displayName: true, handle: true } },
      workroom: { include: { listing: true, founder: { select: { id: true, displayName: true, handle: true } }, worker: { select: { id: true, displayName: true, handle: true } }, deliveries: { orderBy: { version: "desc" } }, revisions: { orderBy: { createdAt: "desc" } }, messages: { orderBy: { createdAt: "asc" } } } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return json({ items }, auth.id);
}
