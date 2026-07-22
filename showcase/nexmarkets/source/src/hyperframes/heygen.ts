import { strToU8, zipSync } from "fflate";
import { env } from "@/lib/env";
import type { CloudRenderRequest, CloudRenderResult, CompositionBundle } from "./types";

function headers(idempotencyKey?: string) {
  if (!env.heygenApiKey) throw new Error("HEYGEN_API_KEY is not configured");
  return {
    "x-api-key": env.heygenApiKey,
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
  };
}

function dataRecord(payload: unknown) {
  const root = payload as Record<string, unknown>;
  return ((root.data as Record<string, unknown> | undefined) ?? root) as Record<string, unknown>;
}

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    let message = payload.message as string | undefined;
    if (!message && payload.error) {
      if (typeof payload.error === "object" && payload.error !== null && "message" in payload.error) {
        const nested = payload.error as { message?: unknown };
        message = typeof nested.message === "string" ? nested.message : undefined;
      } else if (typeof payload.error === "string") {
        message = payload.error;
      }
    }
    if (!message) {
      message = `HeyGen request failed with ${response.status}`;
    }
    throw new Error(message);
  }
  return payload;
}

export function zipComposition(bundle: CompositionBundle) {
  const files = Object.fromEntries(
    Object.entries(bundle.files).map(([path, value]) => [
      path,
      typeof value === "string" ? strToU8(value) : value
    ])
  );
  files["manifest.json"] = strToU8(JSON.stringify(bundle.manifest, null, 2));
  return zipSync(files, { level: 6 });
}

export class HeyGenHyperFramesClient {
  async upload(bundle: CompositionBundle, idempotencyKey: string) {
    const archive = zipComposition(bundle);
    const form = new FormData();
    form.set(
      "file",
      new Blob([archive as BlobPart], { type: "application/zip" }),
      `${bundle.manifest.productionId}.zip`
    );
    const response = await fetch(`${env.heygenApiUrl}/v3/assets`, {
      method: "POST",
      headers: headers(idempotencyKey),
      body: form
    });
    const payload = await parseResponse(response);
    const data = dataRecord(payload);
    const assetId = (data.asset_id ?? data.id) as string | undefined;
    if (!assetId) throw new Error("HeyGen asset upload did not return an asset_id");
    return { assetId, raw: payload };
  }

  async submit(input: CloudRenderRequest): Promise<CloudRenderResult> {
    const response = await fetch(`${env.heygenApiUrl}/v3/hyperframes/renders`, {
      method: "POST",
      headers: {
        ...headers(input.idempotencyKey),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        project: {
          type: "asset_id",
          asset_id: input.assetId
        },
        composition: input.composition ?? "index.html",
        fps: input.fps ?? 30,
        quality: input.quality ?? "standard",
        format: input.format ?? "mp4",
        resolution: input.resolution ?? "1080p",
        aspect_ratio: input.aspectRatio,
        callback_url: input.callbackUrl,
        callback_id: input.callbackId
      })
    });
    const payload = await parseResponse(response);
    return this.normalize(payload, input.assetId);
  }

  async get(renderId: string): Promise<CloudRenderResult> {
    const response = await fetch(
      `${env.heygenApiUrl}/v3/hyperframes/renders/${encodeURIComponent(renderId)}`,
      { headers: headers() }
    );
    return this.normalize(await parseResponse(response));
  }

  private normalize(payload: Record<string, unknown>, assetId?: string): CloudRenderResult {
    const data = dataRecord(payload);
    const renderId = (data.render_id ?? data.id) as string | undefined;
    if (!renderId) throw new Error("HeyGen response did not include a render_id");
    const rawStatus = String(data.status ?? "queued").toLowerCase();
    const status = rawStatus === "complete" ? "completed" : rawStatus;
    return {
      renderId,
      status: new Set(["queued", "rendering", "completed", "failed"]).has(status)
        ? (status as CloudRenderResult["status"])
        : "queued",
      assetId: (data.asset_id as string | undefined) ?? assetId,
      videoUrl: data.video_url as string | undefined,
      thumbnailUrl: data.thumbnail_url as string | undefined,
      error: typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : undefined,
      raw: payload
    };
  }
}
