import { NextResponse, type NextRequest } from "next/server";

const lockedProductPrefixes = [
  "/admin",
  "/buy-nex",
  "/dashboard",
  "/docs",
  "/marketplace",
  "/nex",
  "/nexmind",
  "/resources",
  "/settings",
  "/studio",
  "/wallet",
  "/workrooms",
];

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return NextResponse.next();
  const { pathname } = request.nextUrl;
  const locked = lockedProductPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!locked) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/reputation";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};