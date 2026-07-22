import { getPrisma } from "@/lib/db";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/route-auth";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const prisma = getPrisma()!; const userId = auth.session.userId;
  const [user, workspaces, sources, productions, listings, applications, workrooms, reputation, notifications, payments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { wallets: true, xAccounts: true, telegramConnections: true } }),
    prisma.workspaceMembership.findMany({ where: { userId }, include: { workspace: true } }), prisma.source.findMany({ where: { ownerUserId: userId } }),
    prisma.production.findMany({ where: { ownerUserId: userId }, include: { versions: true, approvals: true } }), prisma.listing.findMany({ where: { ownerUserId: userId } }),
    prisma.application.findMany({ where: { applicantUserId: userId } }), prisma.workroom.findMany({ where: { OR: [{ founderUserId: userId }, { workerUserId: userId }] }, include: { messages: true, deliveries: true, revisions: true, disputes: true } }),
    prisma.reputationProfile.findMany({ where: { userId }, include: { evidence: true } }), prisma.notification.findMany({ where: { userId } }), prisma.paymentIntent.findMany({ where: { userId } })
  ]);
  const safeUser = user ? {
    ...user,
    xAccounts: user.xAccounts.map((account) => ({
      id: account.id,
      userId: account.userId,
      providerUserId: account.providerUserId,
      handle: account.handle,
      scopes: account.scopes,
      connectedAt: account.connectedAt,
      revokedAt: account.revokedAt,
    })),
    telegramConnections: user.telegramConnections.map(({ chatIdEncrypted, ...connection }) => ({ ...connection, chatId: decryptSecret(chatIdEncrypted) })),
  } : null;
  const exportedSources = sources.map(({ rawTextEncrypted, ...source }) => ({ ...source, textContent: rawTextEncrypted ? decryptSecret(rawTextEncrypted) : null }));
  return json({ exportedAt: new Date(), user: safeUser, workspaces, sources: exportedSources, productions, listings, applications, workrooms, reputation, notifications, payments }, auth.id, { headers: { "content-disposition": `attachment; filename="nexmarkets-account-${userId}.json"`, "cache-control": "private, no-store" } });
}
