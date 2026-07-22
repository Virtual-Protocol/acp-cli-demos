import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { isDevSimulationEnabled } from "@/lib/dev-simulation";
import { problem, requestId } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  if (!isDevSimulationEnabled()) {
    return problem(id, 404, "DEV_AUTH_UNAVAILABLE", "Dev login unavailable", "The development login endpoint is disabled outside the local dev server.");
  }
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const response = NextResponse.redirect(new URL(safeNext, url.origin));
  response.cookies.set(SESSION_COOKIE, "nex-dev-bypass-token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
