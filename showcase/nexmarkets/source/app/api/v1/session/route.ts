import { clearSessionCookie, getSession, publicUser } from "@/lib/auth";
import { json, requestId } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  const session = await getSession(request);
  const response = json(
    session
      ? { authenticated: true, user: publicUser(session.user), expiresAt: session.expiresAt }
      : { authenticated: false, user: null },
    id
  );
  if (!session) clearSessionCookie(response);
  return response;
}
