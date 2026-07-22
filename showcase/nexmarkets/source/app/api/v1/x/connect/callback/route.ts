import { createHash } from "node:crypto";
import { clearSessionCookie, getSession, ensurePersonalWorkspace } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { problem, requestId } from "@/lib/http";
import { createReputationSession, setReputationSessionCookie } from "@/lib/reputation-session";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { getXMe } from "@/lib/x-provider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const id = requestId(request);
  const session = await getSession(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) {
    return Response.redirect(`${env.appOrigin}/reputation?x=declined`, 302);
  }
  if (!code || !state || !env.xClientId) {
    return problem(id, 422, "X_CALLBACK_INVALID", "X connection could not be completed", "The OAuth callback is missing required values.");
  }
  const prisma = getPrisma()!;
  const challenge = await prisma.authChallenge.findFirst({
    where: {
      purpose: "X_OAUTH",
      secretHash: createHash("sha256").update(state).digest("hex"),
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });
  const payload = challenge?.payload as { verifier?: string; redirectUri?: string } | null;
  if (!challenge || !payload?.verifier || !payload.redirectUri) {
    return problem(id, 410, "X_CHALLENGE_EXPIRED", "X connection expired", "Start the X connection again.");
  }
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: payload.redirectUri,
    code_verifier: decryptSecret(payload.verifier),
    client_id: env.xClientId
  });
  const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(env.xClientSecret ? { authorization: `Basic ${Buffer.from(`${env.xClientId}:${env.xClientSecret}`).toString("base64")}` } : {})
    },
    body: form,
    signal: AbortSignal.timeout(20_000)
  });
  const token = await tokenResponse.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; scope?: string; error_description?: string };
  if (!tokenResponse.ok || !token.access_token) {
    return problem(id, 502, "X_TOKEN_FAILED", "X connection failed", token.error_description || `X token exchange returned HTTP ${tokenResponse.status}.`);
  }
  const encryptedAccess = encryptSecret(token.access_token);
  const me = await getXMe(encryptedAccess);
  const linked = await prisma.xAccount.findUnique({ where: { providerUserId: me.id }, select: { userId: true } });

  let targetUserId: string;
  if (session) {
    if (linked && linked.userId !== session.userId) {
      return problem(id, 409, "X_ACCOUNT_ALREADY_LINKED", "X account already linked", "This X account belongs to another NexMarkets account.");
    }
    targetUserId = session.userId;
  } else if (linked) {
    targetUserId = linked.userId;
  } else {
    const user = await prisma.user.create({
      data: {
        handle: me.username,
        displayName: me.name,
        avatarUrl: me.profile_image_url,
        bio: me.description,
        location: me.location,
        settings: { reputationOnly: true }
      }
    });
    targetUserId = user.id;
    await ensurePersonalWorkspace(user.id, user.displayName);
  }

  await prisma.$transaction([
    prisma.xAccount.upsert({
      where: { providerUserId: me.id },
      update: {
        userId: targetUserId,
        handle: me.username,
        accessTokenEncrypted: encryptedAccess,
        refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : undefined,
        scopes: token.scope?.split(" ") || [],
        connectedAt: new Date(),
        revokedAt: null
      },
      create: {
        userId: targetUserId,
        providerUserId: me.id,
        handle: me.username,
        accessTokenEncrypted: encryptedAccess,
        refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        scopes: token.scope?.split(" ") || []
      }
    }),
    prisma.user.update({
      where: { id: targetUserId },
      data: {
        handle: me.username,
        displayName: me.name,
        avatarUrl: me.profile_image_url,
        bio: me.description,
        location: me.location
      }
    }),
    prisma.authChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } })
  ]);

  if (session) {
    return Response.redirect(`${env.appOrigin}/reputation?x=connected`, 302);
  }

  const scoped = await createReputationSession(targetUserId);
  const response = NextResponse.redirect(`${env.appOrigin}/reputation?x=connected`, 302);
  setReputationSessionCookie(response, scoped.token, scoped.expiresAt, request);
  return response;
}