import { clearSessionCookie, getSession, sha256, SESSION_COOKIE } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const id = requestId(request);
  const originError = requireTrustedOrigin(request, id);
  if (originError) return originError;
  const session = await getSession(request);
  if (session) {
    await getPrisma()!.session.update({
      where: { id: session.id },
      data: { status: "REVOKED", revokedAt: new Date() }
    });
  } else {
    const token = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === SESSION_COOKIE)?.[1];
    if (token) {
      await getPrisma()?.session.updateMany({
        where: { tokenHash: sha256(decodeURIComponent(token)), status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() }
      });
    }
  }
  const response = json({ signedOut: true }, id);
  clearSessionCookie(response);
  return response;
}
