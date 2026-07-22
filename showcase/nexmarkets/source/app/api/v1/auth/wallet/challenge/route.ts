import { z } from "zod";
import { getSession, randomToken, sha256 } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { json, problem, requestId, zodProblem } from "@/lib/http";
import { requireTrustedOrigin } from "@/lib/route-auth";
import { consumeRateLimit, requestIpHash } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.union([z.literal(4663), z.literal(46630)])
});

export async function POST(request: Request) {
  const id = requestId(request);
  const originError = requireTrustedOrigin(request, id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(id, parsed.error);
  const prisma = getPrisma();
  if (!prisma) return problem(id, 503, "DATABASE_REQUIRED", "Authentication unavailable", "A persistent database is required.");
  const ipLimit = await consumeRateLimit(requestIpHash(request), "wallet_challenge_ip", 20, 10 * 60_000);
  if (!ipLimit.allowed) return problem(id, 429, "WALLET_RATE_LIMITED", "Too many wallet challenges", `Wait ${ipLimit.retryAfterSeconds} seconds before requesting another signature message.`);
  const currentSession = await getSession(request);
  const recent = await prisma.authChallenge.count({ where: { purpose: "WALLET_VERIFY", identifier: parsed.data.address.toLowerCase(), createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 10) return problem(id, 429, "WALLET_RATE_LIMITED", "Too many wallet challenges", "Wait 10 minutes before requesting another signature message.");
  const nonce = randomToken(18);
  const origin = new URL(request.url).origin;
  const domain = new URL(origin).host;
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000);
  const message = `${domain} wants you to verify this wallet.\n\nURI: ${origin}\nVersion: 1\nChain ID: ${parsed.data.chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`;
  const challenge = await prisma.authChallenge.create({
    data: {
      userId: currentSession?.userId,
      purpose: "WALLET_VERIFY",
      identifier: parsed.data.address.toLowerCase(),
      secretHash: sha256(nonce),
      payload: { message, chainId: parsed.data.chainId },
      expiresAt
    }
  });
  return json({ challengeId: challenge.id, message, expiresAt }, id, { status: 201 });
}
