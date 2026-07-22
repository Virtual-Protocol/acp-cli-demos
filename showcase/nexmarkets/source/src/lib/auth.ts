import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { getPrisma } from "./db";
import { DEV_SIMULATION_WALLET, isDevSimulationEnabled } from "./dev-simulation";

export const SESSION_COOKIE = "nex_session";
const SESSION_DAYS = 30;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  const prisma = getPrisma();

  // Dev bypass: if the token matches the dev token, ensure it exists in the DB
  if (
    token === "nex-dev-bypass-token" &&
    isDevSimulationEnabled() &&
    process.env.DEV_AUTH_BYPASS !== "false" &&
    prisma
  ) {
    return getOrCreateDevSession(prisma);
  }


  if (!token) return null;
  if (!prisma) return null;
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          wallets: { orderBy: [{ isPrimary: "desc" }, { verifiedAt: "desc" }] },
          xAccounts: { where: { revokedAt: null }, orderBy: { connectedAt: "desc" } },
          telegramConnections: { where: { revokedAt: null }, orderBy: { verifiedAt: "desc" } },
          workspaceMemberships: { include: { workspace: true } }
        }
      }
    }
  });
  if (!session || session.status !== "ACTIVE" || session.revokedAt || session.expiresAt <= now) {
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return session;
}

const DEV_EMAIL = "dev@nexmarkets.local";
const DEV_TOKEN_HASH = sha256("nex-dev-bypass-token");

async function getOrCreateDevSession(prisma: NonNullable<ReturnType<typeof getPrisma>>) {
  const sessionInclude = {
    user: {
      include: {
        wallets: { orderBy: [{ isPrimary: "desc" as const }, { verifiedAt: "desc" as const }] },
        xAccounts: { where: { revokedAt: null }, orderBy: { connectedAt: "desc" as const } },
        telegramConnections: { where: { revokedAt: null }, orderBy: { verifiedAt: "desc" as const } },
        workspaceMemberships: { include: { workspace: true } }
      }
    }
  };

  // Try to find an existing dev session
  const existing = await prisma.session.findUnique({
    where: { tokenHash: DEV_TOKEN_HASH },
    include: sessionInclude
  });
  if (existing && existing.status === "ACTIVE" && !existing.revokedAt && existing.expiresAt > new Date()) {
    return existing;
  }

  // Find or create the dev user
  let user = await prisma.user.findUnique({ where: { email: DEV_EMAIL }, include: { wallets: true } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        handle: "dev",
        displayName: "Dev User",
        bio: "Local development account",
        location: "localhost",
        theme: "dark",
        settings: {}
      },
      include: { wallets: true }
    });
    // Create a personal workspace for the dev user
    await prisma.workspace.create({
      data: {
        ownerUserId: user.id,
        slug: `dev-${user.id.slice(0, 12)}`,
        name: "Dev workspace",
        type: "HUMAN",
        settings: {},
        memberships: { create: { userId: user.id, role: "OWNER" } }
      }
    });
  }

  // Ensure dev user has a primary wallet in development mode
  if (user.wallets.length === 0) {
    const chainId = process.env.ROBINHOOD_NETWORK === "mainnet" ? 4663 : 46630;
    const mockWallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        address: DEV_SIMULATION_WALLET,
        chainId,
        verifiedAt: new Date(),
        isPrimary: true
      }
    });
    user.wallets.push(mockWallet);
  }

  // Upsert the dev session
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.upsert({
    where: { tokenHash: DEV_TOKEN_HASH },
    update: { expiresAt, status: "ACTIVE", revokedAt: null, lastSeenAt: new Date() },
    create: { userId: user.id, tokenHash: DEV_TOKEN_HASH, expiresAt, userAgent: "dev-bypass", ipHash: null },
    include: sessionInclude
  });
  return session;
}

export async function createSession(userId: string, request: Request) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Persistent database is required for authentication.");
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: request.headers.get("user-agent")?.slice(0, 500),
      ipHash: request.headers.get("x-forwarded-for")
        ? sha256(request.headers.get("x-forwarded-for")!.split(",")[0].trim())
        : null
    }
  });
  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date, request: Request) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(0)
  });
}

export async function ensurePersonalWorkspace(userId: string, displayName?: string | null) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Persistent database is required.");
  const existing = await prisma.workspace.findFirst({
    where: { ownerUserId: userId, type: "HUMAN" }
  });
  if (existing) return existing;
  return prisma.workspace.create({
    data: {
      ownerUserId: userId,
      slug: `personal-${userId.slice(0, 12)}`,
      name: displayName?.trim() || "Personal workspace",
      type: "HUMAN",
      settings: {},
      memberships: { create: { userId, role: "OWNER" } }
    }
  });
}

export function publicUser(user: {
  id: string;
  email: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  theme: string;
  settings: unknown;
  wallets?: unknown[];
  xAccounts?: unknown[];
  telegramConnections?: unknown[];
  workspaceMemberships?: unknown[];
}) {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    theme: user.theme,
    settings: user.settings,
    wallets: user.wallets ?? [],
    xAccounts: user.xAccounts ?? [],
    telegramConnections: user.telegramConnections ?? [],
    workspaces: (user.workspaceMemberships ?? []).map((membership) => {
      const record = membership as { role: string; workspace: unknown };
      return { ...(record.workspace as object), role: record.role };
    })
  };
}
