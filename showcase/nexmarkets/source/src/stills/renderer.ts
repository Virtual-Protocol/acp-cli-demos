import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

export type StillInput = {
  title: string;
  message: string;
  callToAction: string;
  accent?: string;
  aspectRatio: "16:9" | "1:1";
  asset?: { mimeType: string; bytes: Uint8Array; contentHash: string };
};

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

export function buildStillHtml(input: StillInput) {
  const [width, height] = input.aspectRatio === "1:1" ? [1080, 1080] : [1920, 1080];
  const accent = /^#[0-9a-f]{6}$/i.test(input.accent ?? "") ? input.accent! : "#ffb000";
  const image = input.asset?.mimeType.startsWith("image/") ? `data:${input.asset.mimeType};base64,${Buffer.from(input.asset.bytes).toString("base64")}` : null;
  return {
    width,
    height,
    html: `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080808;color:#f5f1e8;font-family:Arial,Helvetica,sans-serif}
      main{position:relative;width:${width}px;height:${height}px;padding:${Math.round(width * 0.06)}px;display:grid;grid-template-rows:auto 1fr auto;background:#080808}
      .top{display:flex;align-items:center;justify-content:space-between;border-top:3px solid ${accent};padding-top:24px;font-size:${Math.max(18, Math.round(width * 0.013))}px;font-weight:800}.top span:first-child{color:${accent};letter-spacing:.12em;text-transform:uppercase}
      .body{align-self:center;display:grid;grid-template-columns:1.45fr .55fr;gap:${Math.round(width * 0.05)}px;align-items:end}
      h1{font-size:${Math.round(width * 0.072)}px;line-height:1.1;letter-spacing:-.065em;margin:0;max-width:10ch;overflow-wrap:anywhere;word-break:break-word}.message{font-size:${Math.max(28, Math.round(width * 0.023))}px;line-height:1.2;color:#b7b2a8;margin:36px 0 0;max-width:31ch}
      aside{border:1px solid #393631;min-height:260px;padding:34px;display:flex;flex-direction:column;justify-content:space-between;gap:20px;background:#111;overflow:hidden}aside img{display:block;width:100%;height:${Math.round(height * 0.2)}px;object-fit:cover;border:1px solid #2d2a25}aside small{color:#99958d;font-size:${Math.max(16, Math.round(width * 0.011))}px}aside b{font-size:${Math.max(32, Math.round(width * 0.027))}px;line-height:1.05}
      footer{display:flex;justify-content:space-between;color:#8d8982;font-size:${Math.max(16, Math.round(width * 0.011))}px}
      ${input.aspectRatio === "1:1" ? `.body{grid-template-columns:1fr;gap:54px}h1{font-size:92px}.message{font-size:30px}aside{min-height:190px}` : ""}
    </style></head><body><main data-export-root>
      <header class="top"><span>Information made visual</span><span>NexMarkets</span></header>
      <section class="body"><div><h1>${escapeHtml(input.title)}</h1><p class="message">${escapeHtml(input.message)}</p></div><aside>${image ? `<img src="${image}" alt="Approved source asset">` : ""}<small>Approved outcome</small><b>${escapeHtml(input.callToAction)}</b></aside></section>
      <footer><span>Source-disciplined · deterministic HTML/CSS export</span><span>${width} × ${height}</span></footer>
    </main></body></html>`
  };
}

function defaultChromiumPath() {
  if (process.platform === "win32") {
    return "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  }
  return "/usr/bin/chromium";
}

export async function renderStill(input: StillInput) {
  const composition = buildStillHtml(input);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || defaultChromiumPath(),
    headless: true
  });
  try {
    const page = await browser.newPage({
      viewport: { width: composition.width, height: composition.height },
      deviceScaleFactor: 1
    });
    await page.setContent(composition.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("[data-export-root] *")].filter(
        (element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
      ).map((element) => ({
        element: element.tagName.toLowerCase(),
        client: `${element.clientWidth}x${element.clientHeight}`,
        scroll: `${element.scrollWidth}x${element.scrollHeight}`
      }))
    );
    if (overflow.length) throw new Error(`Still layout overflow: ${JSON.stringify(overflow)}`);
    const png = await page.screenshot({ type: "png", fullPage: false });
    return {
      ...composition,
      png,
      sha256: createHash("sha256").update(png).digest("hex")
    };
  } finally {
    await browser.close();
  }
}
