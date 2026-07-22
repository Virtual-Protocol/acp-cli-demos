import { publicUser } from "@/lib/auth";
import { walletSnapshot } from "@/lib/chain";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, requestId } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { getReputationSession } from "@/lib/reputation-session";
import { listingView, productionView, record, strings, usdc } from "@/lib/product-view";

export const runtime = "nodejs";

function workStatus(status: string) {
  const values: Record<string, string> = {
    DRAFT: "Draft", FUNDING: "Funding", OPEN: "Posted", PAUSED: "Paused", ASSIGNED: "Active",
    COMPLETED: "Completed", CANCELLED: "Cancelled", SUBMITTED: "Applied", SHORTLISTED: "Shortlisted",
    ACCEPTED: "Active", DECLINED: "Declined", WITHDRAWN: "Withdrawn", FUNDED: "Active",
    IN_PROGRESS: "Active", DELIVERED: "Waiting for approval", REVISION_REQUESTED: "Active",
    APPROVED: "Waiting for release", RELEASED: "Completed", DISPUTED: "Disputed", REFUNDED: "Refunded"
  };
  return values[status] || status;
}

export async function GET(request: Request) {
  const id = requestId(request);
  const prisma = getPrisma();
  if (!prisma) return problem(id, 503, "DATABASE_REQUIRED", "Persistent data unavailable", "NexMarkets needs Prisma persistence; demo mode does not serve product data.");
  const session = await getSession(request);

  const publicListings = await prisma.listing.findMany({
    where: { status: "OPEN", visibility: "PUBLIC" },
    include: { owner: true, workspace: true, _count: { select: { applications: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51
  });
  const listingPage = publicListings.slice(0, 50).map(listingView);

  if (!session) {
    const reputationSession = await getReputationSession(request);
    const reputation = reputationSession
      ? await prisma.reputationProfile.findFirst({ where: { userId: reputationSession.userId }, include: { evidence: true }, orderBy: { updatedAt: "desc" } })
      : null;
    return json({
      authenticated: false,
      user: null,
      workspaces: [], productions: [], creations: [], listings: listingPage, nextListingCursor: publicListings.length > 50 ? publicListings[49].id : null,
      applications: [], ownedListings: [], myWork: [], workrooms: [], sources: [], vaultAssets: [], notifications: [], reputation,
      wallet: { configured: false, address: null, usdcAtomic: null, nexAtomic: null, nativeAtomic: null },
      integrations: {
        x: { configured: Boolean(env.xClientId), connected: Boolean(reputationSession?.xAccount) },
        telegram: { configured: Boolean(env.telegramBotToken && env.telegramBotUsername), connected: false },
        nexmind: { configured: Boolean(env.nexmindApiUrl && env.nexmindApiKey) },
        heygen: { configured: Boolean(env.heygenApiKey) }
        ,email: { configured: Boolean(env.resendApiKey && env.emailFrom) }
      }
    }, id);
  }

  const userId = session.userId;
  const [productions, ownedListings, invitedListings, applications, workrooms, sources, notifications, reputation, payments] = await Promise.all([
    prisma.production.findMany({ where: { ownerUserId: userId }, include: { currentVersion: true, renderJobs: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.listing.findMany({ where: { ownerUserId: userId }, include: { owner: true, workspace: true, _count: { select: { applications: true } } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.listing.findMany({ where: { invitedUserId: userId, status: "OPEN" }, include: { owner: true, workspace: true, _count: { select: { applications: true } } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.application.findMany({ where: { applicantUserId: userId }, include: { listing: { include: { owner: true, workspace: true, _count: { select: { applications: true } } } } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.workroom.findMany({ where: { OR: [{ founderUserId: userId }, { workerUserId: userId }] }, include: { listing: true, founder: true, worker: true, messages: { include: { author: true }, orderBy: { createdAt: "asc" } }, deliveries: { orderBy: { version: "desc" } }, revisions: { orderBy: { createdAt: "desc" } }, disputes: { orderBy: { createdAt: "desc" } } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.source.findMany({ where: { ownerUserId: userId }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.reputationProfile.findFirst({ where: { userId }, include: { evidence: true }, orderBy: { updatedAt: "desc" } }),
    prisma.paymentIntent.findMany({ where: { userId }, include: { production: true }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  const primaryWallet = session.user.wallets.find((wallet) => wallet.isPrimary) ?? session.user.wallets[0];
  let wallet: Awaited<ReturnType<typeof walletSnapshot>> | { configured: boolean; chainId: number; address: string | null; usdcAtomic: null; nexAtomic: null; nativeAtomic: null; error?: string } = {
    configured: false, chainId: env.robinhoodChainId, address: primaryWallet?.address ?? null, usdcAtomic: null, nexAtomic: null, nativeAtomic: null
  };
  if (primaryWallet) {
    wallet = await walletSnapshot(primaryWallet.address as `0x${string}`).catch((error: unknown) => ({
      configured: true, chainId: env.robinhoodChainId, address: primaryWallet.address, usdcAtomic: null, nexAtomic: null, nativeAtomic: null,
      error: error instanceof Error ? error.message : "Wallet balances could not be read."
    }));
  }

  const ownedViews = ownedListings.map(listingView);
  const invitedViews = invitedListings.map(listingView);
  const workItems = [
    ...ownedListings.map((item) => ({
      id: `listing:${item.id}`, entityId: item.id, title: item.title, type: item.type, status: workStatus(item.status),
      detail: `${item._count.applications} response${item._count.applications === 1 ? "" : "s"}`, due: item.deadline?.toISOString() ?? "Open",
      route: "marketplace", side: "Hiring", offer: usdc(item.budgetAtomic) ? `${usdc(item.budgetAtomic)} USDC` : "Terms set", submitted: item.createdAt.toISOString(), next: "Open the Listing to review its current state.", note: item.outcome
    })),
    ...applications.map((item) => ({
      id: `application:${item.id}`, entityId: item.id, listingId: item.listingId, title: item.listing.title, type: item.listing.type,
      status: workStatus(item.status), detail: item.response, due: item.listing.deadline?.toISOString() ?? "Open", route: "marketplace", side: "Applied",
      offer: usdc(item.proposedFeeAtomic) ? `${usdc(item.proposedFeeAtomic)} USDC` : "Published terms", submitted: item.createdAt.toISOString(), next: `Application status: ${workStatus(item.status)}.`, note: item.deliveryPlan || item.response
    })),
    ...invitedListings.filter((listing) => !applications.some((application) => application.listingId === listing.id)).map((item) => ({
      id: `invite:${item.id}`, entityId: item.id, listingId: item.id, title: item.title, type: item.type, status: "Posted",
      detail: record(item.detail).serviceRequest === true ? "Funded private Service request" : "Private Direct Hire offer", due: item.deadline?.toISOString() ?? "Open", route: "marketplace", side: "Invited",
      offer: usdc(item.budgetAtomic) ? `${usdc(item.budgetAtomic)} USDC` : "Terms set", submitted: item.createdAt.toISOString(), next: "Review and respond to this private offer.", note: item.outcome
    })),
    ...workrooms.map((item) => ({
      id: `workroom:${item.id}`, entityId: item.id, title: item.listing.title, type: item.listing.type, status: workStatus(item.status),
      detail: item.status.replaceAll("_", " ").toLowerCase(), due: item.reviewDeadline?.toISOString() ?? "In progress", route: "workroom",
      side: item.workerUserId === userId ? "Doing" : "Hiring", offer: usdc(item.listing.budgetAtomic) ? `${usdc(item.listing.budgetAtomic)} USDC` : "Terms set",
      submitted: item.createdAt.toISOString(), next: "Open the Workroom for messages, delivery, review and payment state.", note: item.listing.outcome
    }))
  ].sort((a, b) => b.submitted.localeCompare(a.submitted));
  const sourceViews = sources.map((source) => {
    const usage = [
      ...productions.filter((production) => production.sourceId === source.id || strings(record(production.direction).sourceIds).includes(source.id)).map((production) => ({ type: "production", id: production.id, title: production.title, href: `/studio/${production.id}` })),
      ...workrooms.filter((room) => room.deliveries.some((delivery) => source.objectKey ? strings(delivery.objectKeys).includes(source.objectKey) : false) || room.messages.some((message) => strings(message.attachments).includes(source.id))).map((room) => ({ type: "workroom", id: room.id, title: room.listing.title, href: `/workrooms/${room.id}` })),
    ];
    return { ...source, usage };
  });

  return json({
    authenticated: true,
    user: publicUser(session.user),
    workspaces: session.user.workspaceMemberships.map((membership) => ({ ...membership.workspace, role: membership.role })),
    productions,
    creations: productions.map(productionView),
    listings: [...invitedViews, ...listingPage.filter((listing) => !invitedViews.some((invited) => invited.id === listing.id))],
    nextListingCursor: publicListings.length > 50 ? publicListings[49].id : null,
    ownedListings: ownedViews,
    applications,
    myWork: workItems,
    workrooms,
    sources: sourceViews,
    vaultAssets: sourceViews.map((source) => ({
      id: source.id, kind: source.mimeType?.startsWith("image/") ? "image" : source.kind === "FILE" ? "doc" : "url",
      code: source.kind.slice(0, 3), name: source.name || source.originalUrl || "Untitled source",
      meta: [source.mimeType, source.sizeBytes ? `${source.sizeBytes} bytes` : null].filter(Boolean).join(" Â· ") || source.kind,
      group: record(source.rights).group || "all", status: source.status, usage: source.usage
    })),
    notifications: notifications.map(({ deepLink, ...notification }) => ({ ...notification, href: deepLink })),
    reputation,
    payments,
    wallet,
    integrations: {
      x: { configured: Boolean(env.xClientId), connected: session.user.xAccounts.length > 0 },
      telegram: { configured: Boolean(env.telegramBotToken && env.telegramBotUsername), connected: session.user.telegramConnections.length > 0 },
      nexmind: { configured: Boolean(env.nexmindApiUrl && env.nexmindApiKey) },
      heygen: { configured: Boolean(env.heygenApiKey) }
      ,email: { configured: Boolean(env.resendApiKey && env.emailFrom) }
    }
  }, id);
}
