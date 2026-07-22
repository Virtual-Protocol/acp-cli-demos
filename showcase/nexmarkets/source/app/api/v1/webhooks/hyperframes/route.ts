import { z } from "zod";
import { env } from "@/lib/env";
import { verifyHeyGenWebhook } from "@/hyperframes/webhook";
import { completeVideoVersion } from "@/lib/production-artifacts";
import { record } from "@/lib/product-view";
import { findRenderJobByCallback, getProduction, transitionProduction, updateRenderJob } from "@/lib/store";
import { json, problem, requestId, zodProblem } from "@/lib/http";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

const callbackSchema = z.object({
  callback_id: z.string().uuid(),
  render_id: z.string().min(1),
  status: z.enum(["queued", "rendering", "completed", "failed", "cancelled"]),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  error: z.string().optional()
});

export async function POST(request: Request) {
  const requestIdValue = requestId(request);
  const raw = await request.text();
  if (!env.heygenCallbackSecret) {
    return problem(requestIdValue, 503, "WEBHOOK_SECRET_REQUIRED", "Webhook verification is not configured", "Configure HEYGEN_HYPERFRAMES_CALLBACK_SECRET.");
  }
  const signature = request.headers.get("x-heygen-signature") ?? request.headers.get("x-webhook-signature");
  if (!verifyHeyGenWebhook(raw, signature, env.heygenCallbackSecret)) {
    return problem(requestIdValue, 401, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature is invalid", "The callback was not accepted.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return problem(requestIdValue, 400, "INVALID_JSON", "Webhook body is invalid", "The callback body must be valid JSON.");
  }
  const parsed = callbackSchema.safeParse(payload);
  if (!parsed.success) return zodProblem(requestIdValue, parsed.error);
  const job = await findRenderJobByCallback(parsed.data.callback_id);
  if (!job) return problem(requestIdValue, 404, "RENDER_JOB_NOT_FOUND", "Render job not found", "The callback identifier is unknown.");
  if (parsed.data.status === "completed" && job.status === "COMPLETED" && job.outputObjectKey) {
    return json(job, requestIdValue);
  }

  const statusMap = {
    queued: "QUEUED",
    rendering: "RENDERING",
    completed: "COMPLETED",
    failed: "FAILED",
    cancelled: "CANCELLED"
  } as const;
  if (parsed.data.status === "completed") {
    if (!parsed.data.video_url) {
      return problem(requestIdValue, 422, "PROVIDER_OUTPUT_MISSING", "Provider output is missing", "A completed callback must include video_url.");
    }
    const versionId = record(job.request).versionId;
    if (typeof versionId !== "string") {
      return problem(requestIdValue, 409, "PRODUCTION_VERSION_MISSING", "Production version is missing", "The render job has no persisted composition version.");
    }
    await updateRenderJob(job.id, {
      status: "DOWNLOADING",
      providerJobId: parsed.data.render_id,
      outputUrl: parsed.data.video_url,
      response: parsed.data
    });
    try {
      const version = await completeVideoVersion(job.productionId, versionId, parsed.data.video_url, parsed.data.thumbnail_url);
      const production = await getProduction(job.productionId);
      const paths = {
        QUEUED: ["REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING", "VERSION_READY"],
        REVIEWING_SOURCE: ["BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING", "VERSION_READY"],
        BUILDING_STORY: ["PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING", "VERSION_READY"],
        PRODUCING_SCENES: ["ADDING_AUDIO", "RENDERING", "VERSION_READY"],
        ADDING_AUDIO: ["RENDERING", "VERSION_READY"],
        RENDERING: ["VERSION_READY"]
      } as const;
      if (production && production.status in paths) {
        await transitionProduction(job.productionId, [...paths[production.status as keyof typeof paths]]);
      }
      const updated = await getPrisma()!.$transaction(async (tx) => {
        const completed = await tx.renderJob.update({ where: { id: job.id }, data: {
          status: "COMPLETED",
          outputObjectKey: version.outputObjectKey ?? undefined,
          outputUrl: parsed.data.video_url,
          response: parsed.data,
        } });
        const owner = await tx.production.findUnique({ where: { id: job.productionId }, select: { ownerUserId: true, title: true } });
        if (owner) await createNotification(tx, { userId: owner.ownerUserId, kind: "PRODUCTION_VERSION_READY", title: "Studio version ready", body: `${owner.title} finished production and is ready for your review.`, deepLink: `/studio/${job.productionId}` });
        return completed;
      });
      return json(updated, requestIdValue);
    } catch (error) {
      await updateRenderJob(job.id, {
        status: "FAILED",
        errorCode: "OUTPUT_PERSISTENCE_FAILED",
        response: { ...parsed.data, persistenceError: error instanceof Error ? error.message : "Provider output could not be persisted." }
      });
      const production = await getProduction(job.productionId);
      if (production && ["QUEUED", "REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING"].includes(production.status)) {
        await transitionProduction(job.productionId, ["FAILED"]);
      }
      return problem(requestIdValue, 502, "OUTPUT_PERSISTENCE_FAILED", "Provider output could not be persisted", error instanceof Error ? error.message : "The provider output download failed.");
    }
  }

  const updated = await updateRenderJob(job.id, {
    status: statusMap[parsed.data.status],
    providerJobId: parsed.data.render_id,
    outputUrl: parsed.data.video_url,
    errorCode: parsed.data.error,
    response: parsed.data
  });
  if (parsed.data.status === "rendering") {
    const production = await getProduction(job.productionId);
    if (production?.status === "QUEUED") await transitionProduction(job.productionId, ["REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING"]);
  }
  if (parsed.data.status === "failed" || parsed.data.status === "cancelled") {
    const production = await getProduction(job.productionId);
    if (production && ["QUEUED", "REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING"].includes(production.status)) {
      await transitionProduction(job.productionId, ["FAILED"]);
    }
    const owner = await getPrisma()!.production.findUnique({ where: { id: job.productionId }, select: { ownerUserId: true, title: true } });
    if (owner) await getPrisma()!.$transaction((tx) => createNotification(tx, { userId: owner.ownerUserId, kind: "PRODUCTION_NEEDS_ATTENTION", title: "Studio production needs attention", body: parsed.data.error || `${owner.title} did not complete at the render provider.`, deepLink: `/studio/${job.productionId}` }));
  }
  return json(updated, requestIdValue);
}
