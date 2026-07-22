import { NextResponse } from "next/server";
import { getPrisma } from "./db";
import { randomToken, sha256 } from "./auth";

export const REPUTATION_SESSION_COOKIE = "nex_reputation_session";
const REPUTATION_SESSION_DAYS = 7;

type ReputationSessionPayload = { userId?: string };

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function createReputationSession(userId: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Persistent database is required for reputation sessions.");
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + REPUTATION_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.authChallenge.create({
    data: {
      userId,
      purpose: "REPUTATION_X_SESSION",
      identifier: tokenHash,
      secretHash: tokenHash,
      payload: { userId },
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export function setReputationSessionCookie(response: NextResponse, token: string, expiresAt: Date, request: Request) {
  response.cookies.set(REPUTATION_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    expires: expiresAt,
  });
}

export async function getReputationSession(request: Request) {
  const token = cookieValue(request, REPUTATION_SESSION_COOKIE);
  const prisma = getPrisma();
  if (!token || !prisma) return null;
  const tokenHash = sha256(token);
  const record = await prisma.authChallenge.findFirst({
    where: {
      purpose: "REPUTATION_X_SESSION",
      identifier: tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  const payload = record?.payload as ReputationSessionPayload | null;
  if (!record || !payload?.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { xAccounts: { where: { revokedAt: null }, orderBy: { connectedAt: "desc" } } },
  });
  if (!user) return null;
  return { userId: user.id, user, xAccount: user.xAccounts[0] ?? null };
}