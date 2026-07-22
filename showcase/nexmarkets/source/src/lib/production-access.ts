import { getPrisma } from "./db";
import { record } from "./product-view";

export type ProductionCapability = "view" | "brief" | "approveBrief";

export async function productionAccess(userId: string, productionId: string) {
  const prisma = getPrisma()!;
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { id: true, ownerUserId: true, sessionParticipantUserId: true },
  });
  if (!production) return null;
  if (production.ownerUserId === userId) return { production, owner: true, canView: true, canBrief: true, canApproveBrief: true, workroomId: null as string | null, expiresAt: null as string | null };
  if (production.sessionParticipantUserId !== userId) return { production, owner: false, canView: false, canBrief: false, canApproveBrief: false, workroomId: null, expiresAt: null };
  const rooms = await prisma.workroom.findMany({
    where: { founderUserId: production.ownerUserId, workerUserId: userId, status: { in: ["FUNDED", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED", "APPROVED"] } },
    select: { id: true, permissions: true },
    orderBy: { updatedAt: "desc" },
  });
  for (const room of rooms) {
    const delegation = record(record(room.permissions).productionDelegation);
    if (delegation.productionId !== productionId || delegation.delegateUserId !== userId || delegation.revokedAt) continue;
    const expiresAt = typeof delegation.expiresAt === "string" ? delegation.expiresAt : null;
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) continue;
    const canBrief = delegation.canBrief === true;
    return { production, owner: false, canView: canBrief, canBrief, canApproveBrief: canBrief && delegation.canApproveBrief === true, workroomId: room.id, expiresAt };
  }
  return { production, owner: false, canView: false, canBrief: false, canApproveBrief: false, workroomId: null, expiresAt: null };
}

export async function requireProductionCapability(userId: string, productionId: string, capability: ProductionCapability) {
  const access = await productionAccess(userId, productionId);
  const allowed = access && (capability === "view" ? access.canView : capability === "brief" ? access.canBrief : access.canApproveBrief);
  return allowed ? access : null;
}
