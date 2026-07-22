import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { isProductionOperator } from "@/lib/roles";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  if (!isProductionOperator(auth.session.user)) return problem(auth.id, 403, "PRODUCTION_OPERATOR_REQUIRED", "Production operator access required", "Use the verified wallet configured for the production payment operator role.");
  const items = await getPrisma()!.production.findMany({
    where: { status: { in: ["APPROVED", "FAILED", "PAID", "LIVE_SESSION_READY", "BRIEF_REVIEW"] }, paymentIntents: { some: { status: "CONFIRMED" } } },
    include: {
      owner: { select: { id: true, displayName: true, handle: true } },
      paymentIntents: { where: { status: "CONFIRMED" }, orderBy: { createdAt: "desc" }, take: 1 },
      approvals: { where: { artifactType: "PRODUCTION_REFUND_REQUEST" }, orderBy: { createdAt: "desc" }, take: 1 },
      currentVersion: { select: { id: true, approvedAt: true, outputObjectKey: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  return json({ items: items.filter((item) => item.status === "APPROVED" || item.status === "FAILED" || item.approvals.length > 0) }, auth.id);
}
