import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma";

type NotificationStore = Pick<Prisma.TransactionClient, "notification" | "notificationOutbox" | "telegramConnection">;
export type NotificationInput = { userId: string; kind: string; title: string; body: string; deepLink?: string | null };

export async function createNotification(store: NotificationStore, input: NotificationInput) {
  const id = randomUUID();
  const connections = await store.telegramConnection.findMany({ where: { userId: input.userId, revokedAt: null }, select: { id: true, chatIdEncrypted: true } });
  const notification = await store.notification.create({ data: { id, ...input } });
  if (connections.length) await store.notificationOutbox.createMany({
    data: connections.map((connection) => ({
      destination: `telegram:${connection.id}`,
      dedupeKey: `telegram:${connection.id}:notification:${id}`,
      payload: { notificationId: id, chatIdEncrypted: connection.chatIdEncrypted, title: input.title, body: input.body, deepLink: input.deepLink || null },
    })),
  });
  return notification;
}

export async function createNotifications(store: NotificationStore, inputs: NotificationInput[]) {
  const results = [];
  for (const input of inputs) results.push(await createNotification(store, input));
  return results;
}
