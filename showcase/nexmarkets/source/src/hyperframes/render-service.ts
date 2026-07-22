import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { buildComposition } from "./composition";
import { HeyGenHyperFramesClient } from "./heygen";
import type { CompositionInput } from "./types";

export async function submitHyperFramesRender(
  input: CompositionInput,
  idempotencyKey: string
) {
  const bundle = await buildComposition(input);
  const callbackId = randomUUID();

  if (!env.heygenApiKey) throw new Error("HEYGEN_API_KEY is required for HyperFrames video rendering.");

  const client = new HeyGenHyperFramesClient();
  const upload = await client.upload(bundle, `${idempotencyKey}:asset`);
  const result = await client.submit({
    assetId: upload.assetId,
    composition: bundle.entry,
    fps: 30,
    quality: "standard",
    format: "mp4",
    resolution: "1080p",
    aspectRatio: input.aspectRatio,
    callbackId,
    callbackUrl: env.heygenCallbackUrl,
    idempotencyKey: `${idempotencyKey}:render`
  });
  return { mode: "heygen-cloud" as const, callbackId, bundle, assetId: upload.assetId, result };
}
