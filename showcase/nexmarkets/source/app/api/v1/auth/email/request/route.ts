import { z } from "zod";
import { getSession, randomToken, sha256 } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, requestId, zodProblem } from "@/lib/http";
import { requireTrustedOrigin } from "@/lib/route-auth";
import { consumeRateLimit, requestIpHash } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({
  email: z.string().trim().email().max(320),
  workspaceName: z.string().trim().min(1).max(100).optional()
});

export async function POST(request: Request) {
  const id = requestId(request);
  const originError = requireTrustedOrigin(request, id);
  if (originError) return originError;
  if (!env.resendApiKey || !env.emailFrom) return problem(id, 503, "EMAIL_AUTH_NOT_CONFIGURED", "Email access is unavailable", "Configure RESEND_API_KEY and EMAIL_FROM.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(id, parsed.error);
  const email = parsed.data.email.toLowerCase();
  const prisma = getPrisma();
  if (!prisma) return problem(id, 503, "DATABASE_REQUIRED", "Email access is unavailable", "A persistent database is required.");
  const ipLimit = await consumeRateLimit(requestIpHash(request), "email_magic_ip", 10, 60 * 60_000);
  if (!ipLimit.allowed) return problem(id, 429, "EMAIL_RATE_LIMITED", "Too many email links requested", `Wait ${ipLimit.retryAfterSeconds} seconds before requesting another access link.`);
  const recent = await prisma.authChallenge.count({ where: { purpose: "EMAIL_MAGIC", identifier: email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
  if (recent >= 3) return problem(id, 429, "EMAIL_RATE_LIMITED", "Too many email links requested", "Wait 15 minutes before requesting another access link.");
  const session = await getSession(request);
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const challenge = await prisma.authChallenge.create({
    data: {
      userId: session?.userId,
      purpose: "EMAIL_MAGIC",
      identifier: email,
      secretHash: sha256(token),
      payload: { workspaceName: parsed.data.workspaceName || null },
      expiresAt
    }
  });
  const url = `${env.appOrigin}/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: [email], subject: "Your NexMarkets access link", html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:28px">Open NexMarkets</h1><p>This one-time link expires in 15 minutes.</p><p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">Open NexMarkets</a></p><p style="color:#666;font-size:13px">If you did not request this, you can ignore it.</p></div>` }),
    signal: AbortSignal.timeout(15_000)
  }).catch(() => null);
  if (!response?.ok) {
    await prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => null);
    return problem(id, 502, "EMAIL_DELIVERY_FAILED", "Access link could not be sent", "The email provider did not accept the message. Try again shortly.");
  }
  return json({ sent: true, expiresAt }, id, { status: 202 });
}
