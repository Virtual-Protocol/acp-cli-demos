import { randomToken, sha256 } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  if (!env.telegramBotToken || !env.telegramBotUsername) return problem(auth.id, 503, "TELEGRAM_NOT_CONFIGURED", "Telegram connection is unavailable", "Configure TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME.");
  const token = randomToken(24);
  await getPrisma()!.authChallenge.create({ data: { userId: auth.session.userId, purpose: "TELEGRAM_CONNECT", identifier: auth.session.userId, secretHash: sha256(token), payload: {}, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  return json({ url: `https://t.me/${env.telegramBotUsername}?start=${token}`, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }, auth.id, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  await getPrisma()!.telegramConnection.updateMany({ where: { userId: auth.session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return json({ connected: false }, auth.id);
}
