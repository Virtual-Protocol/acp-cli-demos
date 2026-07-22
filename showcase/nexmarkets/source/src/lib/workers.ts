import { opaqueProductionId, publicClient, verifiedProductionPayment } from "./chain";
import { persistProductionPaymentEvent } from "./chain-events";
import { getPrisma } from "./db";
import { env } from "./env";
import { decryptSecret } from "./secrets";
import { record } from "./product-view";
import { confirmPaymentIntent } from "./store";
import { createNotifications } from "./notifications";
import type { Prisma } from "@/generated/prisma";

async function recomputeAfterOrphan(tx: Prisma.TransactionClient, eventName: string, payload: Record<string, unknown>) {
  const productionId = typeof payload.productionId === "string" ? payload.productionId : null;
  const listingId = typeof payload.listingId === "string" ? payload.listingId : null;
  const workroomId = typeof payload.workroomId === "string" ? payload.workroomId : null;
  const paymentIntentId = typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null;
  if (eventName === "ProductionPaid" && productionId) {
    if (paymentIntentId) await tx.paymentIntent.updateMany({ where: { id: paymentIntentId }, data: { status: "ORPHANED" } });
    const production = await tx.production.findUnique({ where: { id: productionId }, select: { status: true } });
    if (production) await tx.production.update({ where: { id: productionId }, data: { status: new Set(["PAYMENT_PENDING", "PAID", "LIVE_SESSION_READY"]).has(production.status) ? "AWAITING_PAYMENT" : "FAILED", failureCode: "CHAIN_EVENT_ORPHANED" } });
  } else if ((eventName === "ProductionSettled" || eventName === "ProductionRefunded") && productionId) {
    await tx.paymentIntent.updateMany({ where: { productionId, status: { in: ["SETTLED", "REFUNDED"] } }, data: { status: "CONFIRMED" } });
    if (eventName === "ProductionRefunded") await tx.production.updateMany({ where: { id: productionId, status: "REFUNDED" }, data: { status: "FAILED", failureCode: "REFUND_EVENT_ORPHANED" } });
  } else if (eventName === "ListingFunded" && listingId) {
    const rooms = await tx.workroom.count({ where: { listingId } });
    await tx.listing.updateMany({ where: { id: listingId }, data: { funded: false, status: rooms ? "PAUSED" : "DRAFT" } });
    await tx.serviceRequest.updateMany({ where: { requestListingId: listingId, status: { in: ["AWAITING_PROVIDER", "ACCEPTED_PENDING_ALLOCATION"] } }, data: { status: "FUNDS_REQUIRED" } });
    if (rooms) await tx.workroom.updateMany({ where: { listingId, status: { notIn: ["RELEASED", "REFUNDED", "CANCELLED"] } }, data: { status: "DISPUTED" } });
  } else if (eventName === "ListingAllocated" && workroomId) {
    await tx.workroom.updateMany({ where: { id: workroomId, status: { notIn: ["RELEASED", "REFUNDED", "CANCELLED"] } }, data: { status: "DISPUTED" } });
    if (listingId) await tx.serviceRequest.updateMany({ where: { requestListingId: listingId, status: "ACTIVE" }, data: { status: "ACCEPTED_PENDING_ALLOCATION" } });
  } else if (eventName === "ListingRefunded" && listingId) {
    await tx.listing.updateMany({ where: { id: listingId, status: "CANCELLED" }, data: { funded: true, status: "OPEN" } });
  } else if (eventName === "DeliverySubmitted" && workroomId) {
    await tx.workroom.updateMany({ where: { id: workroomId, status: "DELIVERED" }, data: { status: "IN_PROGRESS", reviewDeadline: null } });
    await tx.workroomDelivery.updateMany({ where: { workroomId, status: "SUBMITTED" }, data: { status: "WITHDRAWN" } });
  } else if (eventName === "RevisionRequested" && workroomId) {
    await tx.workroom.updateMany({ where: { id: workroomId, status: "REVISION_REQUESTED" }, data: { status: "DELIVERED" } });
  } else if (eventName === "DeliveryApproved" && workroomId) {
    await tx.workroom.updateMany({ where: { id: workroomId, status: "APPROVED" }, data: { status: "DELIVERED" } });
    await tx.workroomDelivery.updateMany({ where: { workroomId, status: "APPROVED" }, data: { status: "SUBMITTED" } });
  } else if (eventName === "PaymentReleased" && workroomId) {
    await tx.workroom.updateMany({ where: { id: workroomId, status: "RELEASED" }, data: { status: "APPROVED" } });
  } else if (eventName === "DisputeOpened" && workroomId) {
    const delivery = await tx.workroomDelivery.findFirst({ where: { workroomId, status: { in: ["SUBMITTED", "REVISION_REQUESTED", "APPROVED"] } }, select: { id: true } });
    await tx.workroom.updateMany({ where: { id: workroomId, status: "DISPUTED" }, data: { status: delivery ? "DELIVERED" : "IN_PROGRESS" } });
    await tx.workroomDispute.updateMany({ where: { workroomId, status: "OPEN" }, data: { status: "CANCELLED" } });
  } else if (eventName === "DisputeResolved" && workroomId) {
    await tx.workroom.updateMany({ where: { id: workroomId, status: "RELEASED" }, data: { status: "DISPUTED" } });
    await tx.workroomDispute.updateMany({ where: { workroomId, status: "RESOLVED" }, data: { status: "OPEN", resolvedAt: null, resolvedById: null } });
  }
}

export async function enqueueTelegramNotifications(limit = 500) {
  if (!env.telegramBotToken) return { scanned: 0, enqueued: 0, configured: false };
  const prisma = getPrisma()!;
  const notifications = await prisma.notification.findMany({
    where: { user: { telegramConnections: { some: { revokedAt: null } } } },
    include: { user: { include: { telegramConnections: { where: { revokedAt: null } } } } },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  let enqueued = 0;
  for (const notification of notifications) {
    for (const connection of notification.user.telegramConnections) {
      const dedupeKey = `telegram:${connection.id}:notification:${notification.id}`;
      const existing = await prisma.notificationOutbox.findUnique({ where: { dedupeKey }, select: { id: true } });
      if (existing) continue;
      await prisma.notificationOutbox.create({
        data: {
          destination: `telegram:${connection.id}`,
          dedupeKey,
          payload: {
            notificationId: notification.id,
            chatIdEncrypted: connection.chatIdEncrypted,
            title: notification.title,
            body: notification.body,
            deepLink: notification.deepLink
          }
        }
      });
      enqueued += 1;
    }
  }
  return { scanned: notifications.length, enqueued, configured: true };
}

export async function deliverNotificationOutbox(limit = 50) {
  if (!env.telegramBotToken) return { attempted: 0, delivered: 0, configured: false };
  const prisma = getPrisma()!;
  const jobs = await prisma.notificationOutbox.findMany({
    where: { deliveredAt: null, nextAttemptAt: { lte: new Date() }, destination: { startsWith: "telegram:" } },
    orderBy: { createdAt: "asc" },
    take: limit
  });
  let delivered = 0;
  for (const job of jobs) {
    const payload = record(job.payload);
    try {
      if (typeof payload.chatIdEncrypted !== "string" || typeof payload.title !== "string" || typeof payload.body !== "string") throw new Error("Telegram outbox payload is invalid.");
      const deepLink = typeof payload.deepLink === "string" && payload.deepLink.startsWith("/") ? `${env.appOrigin}${payload.deepLink}` : null;
      const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: decryptSecret(payload.chatIdEncrypted), text: [`*${payload.title.replace(/[*_`[\]]/g, "") }*`, payload.body, deepLink].filter(Boolean).join("\n\n"), parse_mode: "Markdown", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15_000)
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.description || `Telegram returned HTTP ${response.status}.`);
      await prisma.notificationOutbox.update({ where: { id: job.id }, data: { deliveredAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      delivered += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
      await prisma.notificationOutbox.update({ where: { id: job.id }, data: { attempts, lastError: error instanceof Error ? error.message.slice(0, 1_000) : "Delivery failed.", nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000) } });
    }
  }
  return { attempted: jobs.length, delivered, configured: true };
}

export async function reconcileSubmittedProductionPayments(limit = 25) {
  const prisma = getPrisma()!;
  if (!env.productionPaymentsAddress || !env.robinhoodRpcUrl) return { scanned: 0, confirmed: 0, configured: false };
  const intents = await prisma.paymentIntent.findMany({
    where: { status: { in: ["SUBMITTED", "CONFIRMING"] }, txHash: { not: null }, productionId: { not: null } },
    include: { production: true },
    orderBy: { updatedAt: "asc" },
    take: limit
  });
  let confirmed = 0;
  for (const intent of intents) {
    if (!intent.txHash || !intent.productionId || !intent.production) continue;
    try {
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "CONFIRMING" } });
      const txHash = intent.txHash as `0x${string}`;
      const verified = await verifiedProductionPayment(txHash, intent.productionId, intent.payer as `0x${string}`, intent.amountAtomic);
      await persistProductionPaymentEvent({ txHash, opaqueId: opaqueProductionId(intent.productionId), payload: { productionId: intent.productionId, paymentIntentId: intent.id, payer: intent.payer, amountAtomic: intent.amountAtomic.toString() }, verified });
      await confirmPaymentIntent(intent.id, verified.event.args.productionId!);
      confirmed += 1;
    } catch (error) {
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "SUBMITTED" } }).catch(() => null);
      if (error instanceof Error && /reverted|did not succeed/i.test(error.message)) {
        await prisma.$transaction([
          prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } }),
          prisma.production.updateMany({ where: { id: intent.productionId, status: "PAYMENT_PENDING" }, data: { status: "AWAITING_PAYMENT" } })
        ]);
      }
    }
  }
  return { scanned: intents.length, confirmed, configured: true };
}

export async function reconcileCanonicalChainEvents(limit = 250) {
  if (!env.robinhoodRpcUrl) return { scanned: 0, orphaned: 0, configured: false };
  const prisma = getPrisma()!;
  const client = publicClient();
  const head = await client.getBlockNumber();
  const events = await prisma.chainEvent.findMany({ where: { confirmedAt: { not: null }, orphanedAt: null }, orderBy: { blockNumber: "desc" }, take: limit });
  let orphaned = 0;
  for (const event of events) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: event.transactionHash as `0x${string}` });
      if (receipt.blockHash.toLowerCase() === event.blockHash.toLowerCase()) continue;
    } catch {
      if (head <= event.blockNumber + BigInt(env.robinhoodConfirmations)) continue;
    }
    const payload = record(event.payload);
    const production = typeof payload.productionId === "string" ? await prisma.production.findUnique({ where: { id: payload.productionId }, select: { ownerUserId: true } }) : null;
    const listing = typeof payload.listingId === "string" ? await prisma.listing.findUnique({ where: { id: payload.listingId }, select: { ownerUserId: true } }) : null;
    const room = typeof payload.workroomId === "string" ? await prisma.workroom.findUnique({ where: { id: payload.workroomId }, select: { founderUserId: true, workerUserId: true } }) : null;
    const users = new Set([production?.ownerUserId, listing?.ownerUserId, room?.founderUserId, room?.workerUserId].filter((value): value is string => Boolean(value)));
    await prisma.$transaction(async (tx) => {
      await tx.chainEvent.update({ where: { id: event.id }, data: { orphanedAt: new Date() } });
      await recomputeAfterOrphan(tx, event.eventName, payload);
      if (users.size) await createNotifications(tx, [...users].map((userId) => ({ userId, kind: "CHAIN_REORG_DETECTED", title: "Chain confirmation needs review", body: `${event.eventName} is no longer in its previously confirmed Robinhood Chain block. NexMarkets has flagged the record for reconciliation.`, deepLink: room ? `/workrooms/${payload.workroomId}?tab=payment` : listing ? "/marketplace?tab=my-work" : production ? `/studio/${payload.productionId}` : "/wallet" })));
    });
    orphaned += 1;
  }
  return { scanned: events.length, orphaned, configured: true };
}

export async function runWorkersOnce() {
  const payments = await reconcileSubmittedProductionPayments();
  const canonical = await reconcileCanonicalChainEvents();
  const delivered = await deliverNotificationOutbox();
  return { payments, canonical, delivered };
}
