import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { problem, requestId } from "@/lib/http";
import { encryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const id = requestId(request);
  const session = await getSession(request);
  const userId = session?.userId || null;
  if (!env.xClientId) return problem(id, 503, "X_NOT_CONFIGURED", "X connection is unavailable", "Set X_CLIENT_ID to enable OAuth 2.0 PKCE.");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const redirectUri = `${env.appOrigin}/api/v1/x/connect/callback`;
  await getPrisma()!.authChallenge.create({
    data: {
      userId,
      purpose: "X_OAUTH",
      identifier: userId || "GUEST",
      secretHash: createHash("sha256").update(state).digest("hex"),
      payload: { verifier: encryptSecret(verifier), redirectUri },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  const query = new URLSearchParams({
    response_type: "code",
    client_id: env.xClientId,
    redirect_uri: redirectUri,
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256"
  });
  return Response.redirect(`https://x.com/i/oauth2/authorize?${query}`, 302);
}
