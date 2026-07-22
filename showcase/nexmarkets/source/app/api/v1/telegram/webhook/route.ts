import { sha256 } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, requestId } from "@/lib/http";
import { encryptSecret } from "@/lib/secrets";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Update = { update_id?: number; message?: { text?: string; chat?: { id?: number; username?: string }; from?: { username?: string } } };
export async function POST(request: Request) {
  const id = requestId(request);
  if (!env.telegramWebhookSecret || request.headers.get("x-telegram-bot-api-secret-token") !== env.telegramWebhookSecret) return problem(id, 401, "TELEGRAM_SIGNATURE_INVALID", "Telegram webhook rejected", "The webhook secret did not match.");
  const update = await request.json().catch(() => null) as Update | null;
  const token = update?.message?.text?.match(/^\/start\s+([A-Za-z0-9_-]+)$/)?.[1]; const chatId = update?.message?.chat?.id;
  if (!token || chatId == null) return json({ accepted: true, linked: false }, id);
  const prisma = getPrisma()!; const challenge = await prisma.authChallenge.findFirst({ where: { purpose: "TELEGRAM_CONNECT", secretHash: sha256(token), usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!challenge?.userId) return json({ accepted: true, linked: false }, id);
  await prisma.$transaction(async (tx) => {
    await tx.telegramConnection.create({ data: { userId: challenge.userId!, chatIdEncrypted: encryptSecret(String(chatId)), username: update.message?.from?.username || update.message?.chat?.username, verifiedAt: new Date() } });
    await tx.authChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    await createNotification(tx, { userId: challenge.userId!, kind: "TELEGRAM_CONNECTED", title: "Telegram connected", body: "Important production milestones can now reach this Telegram chat.", deepLink: "/settings?tab=connections" });
  });
  return json({ accepted: true, linked: true }, id);
}
