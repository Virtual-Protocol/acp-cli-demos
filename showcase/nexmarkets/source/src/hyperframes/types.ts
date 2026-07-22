export type AspectRatio = "16:9" | "9:16" | "1:1";
export type RenderQuality = "draft" | "standard" | "high";

export type CompositionInput = {
  productionId: string;
  title: string;
  message: string;
  callToAction: string;
  accent?: string;
  aspectRatio: AspectRatio;
  durationSeconds?: 30;
  assets?: {
    sourceId: string;
    name: string;
    mimeType: string;
    contentHash: string;
    bytes: Uint8Array;
  }[];
};

export type CompositionBundle = {
  entry: "index.html";
  hyperframesVersion: string;
  width: number;
  height: number;
  durationSeconds: 30;
  files: Record<string, string | Uint8Array>;
  manifest: {
    productionId: string;
    compositionHash: string;
    sourceHash: string;
    createdAt: string;
    assets: { path: string; sha256: string }[];
  };
};

export type CloudRenderRequest = {
  assetId: string;
  composition?: string;
  fps?: number;
  quality?: RenderQuality;
  format?: "mp4" | "webm" | "mov";
  resolution?: "1080p" | "4k";
  aspectRatio?: AspectRatio;
  callbackUrl?: string;
  callbackId?: string;
  idempotencyKey: string;
};

export type CloudRenderResult = {
  renderId: string;
  status: "queued" | "rendering" | "completed" | "failed";
  assetId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  raw: Record<string, unknown>;
};
