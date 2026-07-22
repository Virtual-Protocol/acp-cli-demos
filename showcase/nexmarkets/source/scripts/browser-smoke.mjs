import process from "node:process";
import { chromium } from "playwright-core";
import { apiRequest, createWalletSession, startIsolatedServer, stopIsolatedServer } from "./smoke-helpers.mjs";

const instance = await startIsolatedServer(Number(process.env.BROWSER_SMOKE_PORT || 3103));
let browser;
try {
  const session = await createWalletSession(instance.baseUrl);
  const created = await apiRequest(instance.baseUrl, "/api/v1/productions", { method: "POST", cookie: session.cookie, key: `browser-production-${Date.now()}`, body: { kind: "INFOGRAPHIC", title: "Browser-backed creation", source: "Persisted browser smoke source." } });
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "/usr/bin/chromium");
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const [name, value] = session.cookie.split("=");
  await context.addCookies([{ name, value, url: instance.baseUrl, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  const checks = [
    ["/dashboard", "Dashboard", ".account-dashboard"],
    ["/studio", "Create a video or make information visual.", ".studio-source-card"],
    [`/studio/${created.data.id}`, "Browser-backed creation", ".creation-detail"],
    ["/marketplace", "Find the right work.", ".market-primary"],
    ["/marketplace?tab=my-work", "My work", ".work-status-tabs"],
    ["/nexmind", "Bring the unfinished thought.", ".mind-home"],
    ["/reputation", "Let your public work speak", ".signal-entry"],
    ["/resources", "Your resources", ".market-empty, .vault-browser"],
    ["/wallet", "Money follows confirmed transactions.", ".wallet-summary"],
    ["/nex", "Utility token", ".nex-token-page"],
    ["/buy-nex", "PROFILE ENHANCEMENT", ".nex-buy-page"],
    ["/settings", "Settings", ".utility-grid"],
    ["/settings?tab=connections", "Connections", ".settings-section"],
    ["/docs", "Find the answer before you create, pay or publish.", ".docs-home"],
  ];
  const rendered = [];
  for (const [route, text, selector] of checks) {
    await page.goto(`${instance.baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
    await page.locator(selector).first().waitFor({ state: "visible" });
    await page.locator(".app-shell").first().waitFor({ state: "visible" });
    await page.locator(".topbar").first().waitFor({ state: "visible" });
    await page.locator(".mobile-bottom-nav").first().waitFor({ state: "attached" });
    const embedded = await page.locator("iframe, object, embed").count();
    const exportReference = await page.locator("body").evaluate((body) => /NexMarkets_NexCard_Exact_Export\.html/i.test(body.innerHTML));
    if (embedded || exportReference) throw new Error(`${route} rendered an embedded/export HTML dependency.`);
    rendered.push({ route, title: await page.title() });
  }
  await page.goto(`${instance.baseUrl}/profile/does-not-exist`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  process.stdout.write(`${JSON.stringify({ componentRoutes: rendered, persistedCreationVisible: true, exportHtmlEmbedded: false }, null, 2)}\n`);
} finally {
  if (browser) await browser.close();
  await stopIsolatedServer(instance);
}
