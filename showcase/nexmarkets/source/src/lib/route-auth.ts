import { getSession } from "./auth";
import { env } from "./env";
import { problem, requestId } from "./http";
import { consumeRateLimit, requestIpHash } from "./rate-limit";

export async function requireSession(request: Request) {
  const id = requestId(request);
  const session = await getSession(request);
  if (!session) {
    return {
      id,
      session: null,
      response: problem(
        id,
        401,
        "AUTHENTICATION_REQUIRED",
        "Sign in required",
        "Connect and verify your wallet to continue.",
        [{ label: "Connect wallet", action: "connect-wallet" }]
      )
    } as const;
  }
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(request.method.toUpperCase())) {
    const [accountLimit, ipLimit] = await Promise.all([
      consumeRateLimit(session.userId, "authenticated_mutation", 120, 60_000),
      consumeRateLimit(requestIpHash(request), "authenticated_mutation_ip", 240, 60_000),
    ]);
    const limit = accountLimit.allowed ? ipLimit : accountLimit;
    if (!accountLimit.allowed || !ipLimit.allowed) return { id, session: null, response: problem(id, 429, "MUTATION_RATE_LIMITED", "Too many changes", `Wait ${limit.retryAfterSeconds} seconds before trying again.`) } as const;
  }
  return { id, session, response: null } as const;
}

export function requireTrustedOrigin(request: Request, id: string) {
  const origin = request.headers.get("origin");
  if (!origin && request.headers.has("cookie")) {
    return problem(id, 403, "ORIGIN_REQUIRED", "Request origin required", "Reload NexMarkets from its configured application origin.");
  }
  if (origin && origin !== env.appOrigin && origin !== new URL(request.url).origin) {
    return problem(id, 403, "ORIGIN_REJECTED", "Request origin rejected", "Reload NexMarkets from its configured application origin.");
  }
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(request.method.toUpperCase()) && !request.headers.get("idempotency-key")?.trim()) {
    return problem(id, 428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required", "Every mutation must include an Idempotency-Key header.");
  }
  return null;
}

export function idempotencyKey(request: Request, id: string) {
  const value = request.headers.get("idempotency-key")?.trim();
  return value
    ? { value, response: null }
    : {
        value: null,
        response: problem(id, 428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required", "Every mutation must include an Idempotency-Key header.")
      };
}
