import { json, problem, requestId } from "@/lib/http";
import { publicProfileByIdentifier } from "@/lib/public-profile";
export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, context: Context) { const id = requestId(request); const { slug } = await context.params; const profile = await publicProfileByIdentifier(slug); return profile ? json(profile, id) : problem(id, 404, "PUBLIC_PROFILE_NOT_FOUND", "Public profile not found", "This NexCard is not published or is paused."); }
