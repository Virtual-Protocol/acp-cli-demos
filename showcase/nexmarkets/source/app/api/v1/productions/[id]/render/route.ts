import { z } from "zod";
import { submitHyperFramesRender } from "@/hyperframes/render-service";
import { buildComposition } from "@/hyperframes/composition";
import { renderStill } from "@/stills/renderer";
import { getPrisma } from "@/lib/db";
import { completeDevSimulatedVideoVersion, saveCompositionVersion, saveInfographicVersion } from "@/lib/production-artifacts";
import { contentHash, getIdempotentResult, getProduction, saveIdempotentResult, saveRenderJob, transitionProduction } from "@/lib/store";
import { json, problem, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { productionImageAssets, sourceIdsFromUnknown } from "@/lib/source-grounding";
import { env } from "@/lib/env";
import { createNotification } from "@/lib/notifications";
import { isDevSimulationEnabled } from "@/lib/dev-simulation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const renderSchema = z.object({
  message: z.string().trim().min(2).max(240),
  callToAction: z.string().trim().min(2).max(64),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  revisionNote: z.string().trim().min(2).max(2_000).optional()
});

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const requestIdValue = auth.id;
  const originError = requireTrustedOrigin(request, requestIdValue);
  if (originError) return originError;
  const key = readIdempotencyKey(request, requestIdValue);
  if (key.response) return key.response;
  const idempotencyKey = key.value!;
  const parsed = renderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(requestIdValue, parsed.error);
  const { id } = await context.params;
  const hash = contentHash(parsed.data);

  try {
    const scope = `users:${auth.session.userId}:productions:${id}:render`;
    const existing = await getIdempotentResult(scope, idempotencyKey, hash);
    if (existing) return json(existing.response, requestIdValue, { status: existing.statusCode });
    const production = await getProduction(id, auth.session.userId);
    if (!production) return problem(requestIdValue, 404, "PRODUCTION_NOT_FOUND", "Production not found", "No production exists with that identifier.");
    if (!production.priceAtomic && !["INFOGRAPHIC"].includes(production.kind)) return problem(requestIdValue, 409, "PAYMENT_REQUIRED", "Payment is not confirmed", "Confirm the production payment before submitting the final video render.");
    const allowedVideoStates = isDevSimulationEnabled()
      ? new Set(["PAID", "BRIEF_REVIEW", "REVISION_REQUESTED", "FAILED"])
      : new Set(["BRIEF_REVIEW", "REVISION_REQUESTED", "FAILED"]);
    if (production.kind === "VIDEO" && !allowedVideoStates.has(production.status)) return problem(requestIdValue, 409, "BRIEF_APPROVAL_REQUIRED", "Video brief review required", isDevSimulationEnabled() ? "Confirm local simulated payment before rendering the video." : "Finish the NexMind direction session and review its structured brief before production.");
    if (production.kind === "VIDEO" && !isDevSimulationEnabled()) {
      const telegram = await getPrisma()!.telegramConnection.findFirst({ where: { userId: auth.session.userId, revokedAt: null }, select: { id: true } });
      if (!env.telegramBotToken || !env.telegramBotUsername || !telegram) {
        return problem(requestIdValue, 409, "TELEGRAM_CONFIRMATION_REQUIRED", "Confirm Telegram updates", "Connect and verify Telegram in Settings before a video can enter production.");
      }
    }
    if (production.kind === "INFOGRAPHIC" && !new Set(["PAID", "REVISION_REQUESTED", "FAILED"]).has(production.status)) return problem(requestIdValue, 409, "PAYMENT_REQUIRED", "Payment is not confirmed", "Confirm the production payment before rendering.");
    if (production.kind === "INFOGRAPHIC" && parsed.data.aspectRatio === "9:16") return problem(requestIdValue, 422, "STILL_FORMAT_UNSUPPORTED", "Still format is not supported", "Choose 16:9 or 1:1 for the infographic export.");
    if (production.status === "FAILED" && !production.priceAtomic) return problem(requestIdValue, 409, "RETRY_NOT_ALLOWED", "Production retry is unavailable", "Only a paid production can retry a failed render.");
    const selectedSourceIds = [...new Set([...(production.sourceId ? [production.sourceId] : []), ...sourceIdsFromUnknown(production.direction.sourceIds)])];
    const imageAssets = await productionImageAssets(auth.session.userId, selectedSourceIds);
    await getPrisma()!.approval.create({ data: { userId: auth.session.userId, productionId: id, artifactType: "PRODUCTION_RENDER_BRIEF", artifactId: id, artifactHash: contentHash({ direction: production.direction, brief: production.brief, render: parsed.data }), decision: "APPROVED" } });

    if (production.status === "REVISION_REQUESTED" || production.status === "FAILED") {
      await transitionProduction(id, ["QUEUED"], auth.session.userId);
    } else if (production.kind === "VIDEO" && isDevSimulationEnabled() && production.status === "PAID") {
      await transitionProduction(id, ["QUEUED"], auth.session.userId);
    } else if (production.kind === "VIDEO") {
      await transitionProduction(id, ["STORYBOARD_REVIEW", "QUEUED"], auth.session.userId);
    } else {
      await transitionProduction(id, ["QUEUED"], auth.session.userId);
    }
    if (production.kind === "INFOGRAPHIC") {
      const still = await renderStill({
        title: production.title,
        message: parsed.data.message,
        callToAction: parsed.data.callToAction,
        accent: parsed.data.accent,
        aspectRatio: parsed.data.aspectRatio === "9:16" ? "16:9" : parsed.data.aspectRatio,
        asset: imageAssets[0]
      });
      const version = await saveInfographicVersion(id, still.png, { width: still.width, height: still.height, sourceHash: still.sha256 });
      await transitionProduction(id, ["REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "RENDERING", "VERSION_READY"], auth.session.userId);
      const renderJob = await saveRenderJob({
        productionId: id,
        provider: "playwright",
        compositionHash: still.sha256,
        idempotencyKey,
        status: "COMPLETED",
        outputObjectKey: version.outputObjectKey ?? undefined,
        callbackId: crypto.randomUUID(),
        request: parsed.data,
        response: { width: still.width, height: still.height, outputHash: still.sha256 }
      });
      await getPrisma()!.$transaction((tx) => createNotification(tx, { userId: auth.session.userId, kind: "PRODUCTION_VERSION_READY", title: "Infographic ready", body: `${production.title} is ready for your review.`, deepLink: `/studio/${id}` }));
      const response = {
        renderJob,
        version,
        still: {
          width: still.width,
          height: still.height,
          hash: still.sha256,
          mimeType: "image/png",
          dataUrl: `data:image/png;base64,${still.png.toString("base64")}`
        }
      };
      await saveIdempotentResult(scope, idempotencyKey, hash, 201, response);
      return json(response, requestIdValue, { status: 201 });
    }

    const compositionInput = {
      productionId: id,
      title: production.title,
      message: parsed.data.message,
      callToAction: parsed.data.callToAction,
      accent: parsed.data.accent,
      aspectRatio: parsed.data.aspectRatio,
      durationSeconds: 30 as const,
      assets: imageAssets
    };
    if (isDevSimulationEnabled()) {
      const bundle = await buildComposition(compositionInput);
      const version = await saveCompositionVersion(id, bundle);
      const completedVersion = await completeDevSimulatedVideoVersion(id, version.id);
      await transitionProduction(id, ["REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING", "VERSION_READY"], auth.session.userId);
      const renderJob = await saveRenderJob({
        productionId: id,
        provider: "dev-simulated-hyperframes-heygen",
        providerJobId: `dev-${crypto.randomUUID()}`,
        providerAssetId: `dev-asset-${crypto.randomUUID()}`,
        compositionHash: bundle.manifest.compositionHash,
        idempotencyKey,
        status: "COMPLETED",
        callbackId: crypto.randomUUID(),
        outputObjectKey: completedVersion.outputObjectKey ?? undefined,
        request: { ...parsed.data, versionId: version.id, simulated: true },
        response: { status: "completed", simulated: true, outputObjectKey: completedVersion.outputObjectKey }
      });
      await getPrisma()!.$transaction((tx) => createNotification(tx, { userId: auth.session.userId, kind: "PRODUCTION_VERSION_READY", title: "Simulated video ready", body: `${production.title} completed through the local development simulator.`, deepLink: `/studio/${id}` }));
      const response = {
        renderJob,
        version: completedVersion,
        composition: {
          hyperframesVersion: bundle.hyperframesVersion,
          hash: bundle.manifest.compositionHash,
          width: bundle.width,
          height: bundle.height,
          durationSeconds: bundle.durationSeconds,
          simulated: true
        }
      };
      await saveIdempotentResult(scope, idempotencyKey, hash, 201, response);
      return json(response, requestIdValue, { status: 201 });
    }

    const submitted = await submitHyperFramesRender(compositionInput, idempotencyKey);
    const version = await saveCompositionVersion(id, submitted.bundle);
    const renderJob = await saveRenderJob({
      productionId: id,
      provider: submitted.mode,
      providerJobId: submitted.result.renderId,
      providerAssetId: submitted.assetId,
      compositionHash: submitted.bundle.manifest.compositionHash,
      idempotencyKey,
      status: submitted.result.status === "failed" ? "FAILED" : "QUEUED",
      callbackId: submitted.callbackId,
      request: { ...parsed.data, versionId: version.id },
      response: submitted.result.raw
    });
    const response = {
      renderJob,
      version,
      composition: {
        hyperframesVersion: submitted.bundle.hyperframesVersion,
        hash: submitted.bundle.manifest.compositionHash,
        width: submitted.bundle.width,
        height: submitted.bundle.height,
        durationSeconds: submitted.bundle.durationSeconds
      }
    };
    await saveIdempotentResult(scope, idempotencyKey, hash, 202, response);
    return json(response, requestIdValue, { status: 202 });
  } catch (error) {
    const failed = await getProduction(id, auth.session.userId).catch(() => null);
    if (failed && ["QUEUED", "REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING"].includes(failed.status)) {
      await transitionProduction(id, ["FAILED"], auth.session.userId).catch(() => null);
    }
    return problem(requestIdValue, 409, "RENDER_SUBMISSION_FAILED", "Production could not start", error instanceof Error ? error.message : "The render could not be submitted.");
  }
}
