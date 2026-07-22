import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { env } from "@/lib/env";
import type { AspectRatio, CompositionBundle, CompositionInput } from "./types";

const dimensions: Record<AspectRatio, readonly [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080]
};

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character];
  });
}

async function loadGsap() {
  // Avoid require.resolve here: Turbopack rewrites it to an internal numeric module id.
  const path = resolve(/* turbopackIgnore: true */ process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js");
  return readFile(path, "utf8");
}

export async function buildComposition(input: CompositionInput): Promise<CompositionBundle> {
  const [width, height] = dimensions[input.aspectRatio];
  const accent = /^#[0-9a-f]{6}$/i.test(input.accent ?? "") ? input.accent! : "#ffb000";
  const title = escapeHtml(input.title);
  const message = escapeHtml(input.message);
  const callToAction = escapeHtml(input.callToAction);
  const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
  const sourceAssets = (input.assets || []).filter((asset) => extensions[asset.mimeType]).slice(0, 5).map((asset, index) => ({
    ...asset,
    path: `assets/source-${String(index + 1).padStart(2, "0")}.${extensions[asset.mimeType]}`,
  }));
  const primaryAsset = sourceAssets[0];

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080808;color:#f5f1e8;font-family:Arial,Helvetica,sans-serif}
    #stage{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#080808}
    .scene{position:absolute;inset:0;padding:${Math.round(width * 0.065)}px;display:flex;align-items:center}
    .scene-content{width:100%;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,.6fr);gap:${Math.round(width * 0.05)}px;align-items:end}
    .eyebrow{color:${accent};font-size:${Math.max(22, Math.round(width * 0.016))}px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin:0 0 24px}
    h1{font-size:${Math.round(width * 0.073)}px;line-height:.92;letter-spacing:-.065em;max-width:11ch;margin:0}
    .message{font-size:${Math.max(30, Math.round(width * 0.024))}px;line-height:1.18;color:#c8c3b8;margin:36px 0 0;max-width:30ch}
    .proof{border:1px solid #36332e;background:#111;padding:34px;min-height:240px;display:flex;flex-direction:column;justify-content:space-between;gap:24px;overflow:hidden}
    .source-visual{width:100%;height:${Math.round(height * 0.24)}px;object-fit:cover;border:1px solid #2d2a25;filter:saturate(.82) contrast(1.04)}
    .proof b{font-size:${Math.max(34, Math.round(width * 0.03))}px;line-height:1}.proof span{color:#99958d;font-size:${Math.max(18, Math.round(width * 0.013))}px;line-height:1.45}
    .rule{position:absolute;left:${Math.round(width * 0.065)}px;right:${Math.round(width * 0.065)}px;top:${Math.round(height * 0.09)}px;height:2px;background:linear-gradient(90deg,${accent} 0 18%,#2b2925 18% 100%)}
    .mark{position:absolute;right:${Math.round(width * 0.065)}px;top:${Math.round(height * 0.045)}px;font-size:${Math.max(20, Math.round(width * 0.015))}px;font-weight:800}
    @media (orientation:portrait){.scene-content{grid-template-columns:1fr;align-content:end}.proof{min-height:210px}h1{font-size:${Math.round(width * 0.105)}px}.message{font-size:${Math.round(width * 0.044)}px}}
  </style>
  <script src="./assets/gsap.min.js"></script>
</head>
<body>
  <div id="stage" data-composition-id="nexmarkets-production" data-start="0" data-duration="30" data-width="${width}" data-height="${height}">
    <div id="hero" class="scene clip" data-start="0" data-duration="30" data-track-index="0">
      <div class="rule"></div><div class="mark">NexMarkets</div>
      <div class="scene-content">
        <div><p class="eyebrow">NexStudio · Built with HyperFrames</p><h1>${title}</h1><p class="message">${message}</p></div>
        <aside class="proof">${primaryAsset ? `<img class="source-visual" src="./${primaryAsset.path}" alt="Approved source asset">` : ""}<span>One approved direction.<br>One deterministic production.</span><b>${callToAction}</b></aside>
      </div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.from(".rule", { scaleX: 0, transformOrigin: "left", duration: 1.1, ease: "power3.out" }, 0.15);
    tl.from(".eyebrow", { y: 30, autoAlpha: 0, duration: .7, ease: "power3.out" }, .25);
    tl.from("h1", { y: 60, autoAlpha: 0, duration: 1, ease: "power3.out" }, .45);
    tl.from(".message", { y: 24, autoAlpha: 0, duration: .8, ease: "power2.out" }, .85);
    tl.from(".proof", { x: 70, autoAlpha: 0, duration: .9, ease: "power3.out" }, .65);
    tl.to(".proof", { y: -8, duration: 5, ease: "sine.inOut", repeat: 4, yoyo: true }, 1.2);
    window.__timelines["nexmarkets-production"] = tl;
  </script>
</body>
</html>`;

  const design = `# NexMarkets Camera-Ready Design\n\n- Background: #080808\n- Foreground: #f5f1e8\n- Accent: ${accent}\n- Typography: high-contrast grotesk, tight display tracking\n- Motion: seek-safe, restrained, purposeful\n- Forbidden: generic glow, fake waveforms, wall-clock animation\n`;
  const storyboard = `# Storyboard\n\n- 00:00–00:05 — Brand rule and outcome enter.\n- 00:05–00:25 — Approved message holds while the proof card breathes.\n- 00:25–00:30 — CTA remains clear for capture and delivery.\n\nTotal: 30.000 seconds.\n`;
  const script = `# Script\n\n${input.message}\n\nCTA: ${input.callToAction}\n`;
  const gsap = await loadGsap();
  const files: Record<string, string | Uint8Array> = {
    "index.html": html,
    "assets/gsap.min.js": gsap,
    "DESIGN.md": design,
    "STORYBOARD.md": storyboard,
    "SCRIPT.md": script
  };
  for (const asset of sourceAssets) files[asset.path] = asset.bytes;
  const assets = Object.entries(files).map(([path, value]) => ({ path, sha256: sha256(value) }));
  const sourceHash = sha256(JSON.stringify({
    ...input,
    assets: sourceAssets.map((asset) => ({ sourceId: asset.sourceId, name: asset.name, mimeType: asset.mimeType, contentHash: asset.contentHash, sha256: sha256(asset.bytes) })),
  }));
  const compositionHash = sha256(
    assets.map((asset) => `${asset.path}:${asset.sha256}`).sort().join("|")
  );

  return {
    entry: "index.html",
    hyperframesVersion: env.hyperframesVersion,
    width,
    height,
    durationSeconds: 30,
    files,
    manifest: {
      productionId: input.productionId,
      compositionHash,
      sourceHash,
      createdAt: new Date().toISOString(),
      assets
    }
  };
}
