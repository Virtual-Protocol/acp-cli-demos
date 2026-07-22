import { getPrisma } from "@/lib/db";
import { clearSessionCookie } from "@/lib/auth";
import { json, problem } from "@/lib/http";
import { deleteObject, deleteObjectPrefix } from "@/lib/object-storage";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const prisma = getPrisma()!; const userId = auth.session.userId;
  const [activeRooms, pendingPayments, fundedListings, activeProductions] = await Promise.all([
    prisma.workroom.count({ where: { OR: [{ founderUserId: userId }, { workerUserId: userId }], status: { in: ["FUNDED", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED", "APPROVED", "DISPUTED"] } } }),
    prisma.paymentIntent.count({ where: { userId, status: { in: ["CREATED", "SUBMITTED", "CONFIRMING"] } } }),
    prisma.listing.count({ where: { ownerUserId: userId, funded: true, status: { in: ["FUNDING", "OPEN"] } } }),
    prisma.production.count({ where: { ownerUserId: userId, status: { in: ["PAYMENT_PENDING", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "STORYBOARD_REVIEW", "QUEUED", "REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING"] } } })
  ]);
  if (activeRooms || pendingPayments || fundedListings || activeProductions) return problem(auth.id, 409, "ACCOUNT_OBLIGATIONS_OPEN", "Account cannot be deleted yet", `${activeRooms} active Workroom(s), ${pendingPayments} pending payment(s), ${fundedListings} funded Listing reserve(s), and ${activeProductions} active production(s) must be completed, cancelled or refunded first.`);
  const [sources, productions] = await Promise.all([
    prisma.source.findMany({ where: { ownerUserId: userId }, select: { objectKey: true } }),
    prisma.production.findMany({ where: { ownerUserId: userId }, select: { id: true } })
  ]);
  await prisma.$transaction(async (tx) => {
    await tx.listing.updateMany({ where: { invitedUserId: userId }, data: { invitedUserId: null } });
    await tx.production.deleteMany({ where: { ownerUserId: userId } });
    await tx.source.deleteMany({ where: { ownerUserId: userId } });
    await tx.draft.deleteMany({ where: { ownerUserId: userId } });
    await tx.xAccount.deleteMany({ where: { userId } });
    await tx.telegramConnection.deleteMany({ where: { userId } });
    await tx.reputationProfile.deleteMany({ where: { userId } });
    await tx.application.deleteMany({ where: { applicantUserId: userId } });
    await tx.workroomMessage.deleteMany({ where: { authorId: userId } });
    await tx.workroomDelivery.deleteMany({ where: { submittedById: userId } });
    await tx.workroomRevision.deleteMany({ where: { requestedById: userId } });
    await tx.workroomDispute.deleteMany({ where: { openedById: userId } });
    await tx.workroomDispute.updateMany({ where: { resolvedById: userId }, data: { resolvedById: null } });
    await tx.approval.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.wallet.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.authChallenge.deleteMany({ where: { userId } });
    await tx.listing.updateMany({ where: { ownerUserId: userId }, data: { title: "Deleted Listing", outcome: "Account data removed", detail: {}, visibility: "PRIVATE", invitedUserId: null } });
    await tx.workspace.updateMany({ where: { ownerUserId: userId, type: "HUMAN" }, data: { name: "Deleted workspace", settings: {} } });
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date(), email: null, handle: null, displayName: "Deleted account", bio: null, location: null, avatarUrl: null, settings: {} } });
  });
  const objectKeys = sources.flatMap((source) => source.objectKey ? [source.objectKey] : []);
  await Promise.allSettled([
    ...objectKeys.map((objectKey) => deleteObject(objectKey)),
    ...productions.map((production) => deleteObjectPrefix(`productions/${production.id}`))
  ]);
  const response = json({ deleted: true }, auth.id); clearSessionCookie(response); return response;
}
