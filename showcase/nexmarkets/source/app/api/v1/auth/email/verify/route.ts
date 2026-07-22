import { problem, requestId } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return problem(requestId(request), 403, "SIGN_IN_DISABLED", "Sign in disabled", "NexMarkets currently allows only X connection for NexCard generation.");
}
