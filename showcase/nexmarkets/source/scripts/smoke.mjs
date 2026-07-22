import process from "node:process";
import { apiRequest, createWalletSession, startIsolatedServer, stopIsolatedServer } from "./smoke-helpers.mjs";

const instance = await startIsolatedServer(Number(process.env.SMOKE_PORT || 3102));
try {
  const health = await apiRequest(instance.baseUrl, "/api/v1/health");
  const guest = await apiRequest(instance.baseUrl, "/api/v1/bootstrap");
  if (guest.data.authenticated || guest.data.creations.length || guest.data.listings.length) throw new Error("A new persistent database rendered fabricated product data.");
  const session = await createWalletSession(instance.baseUrl);
  const suffix = `${Date.now()}-${process.pid}`;
  const createOptions = { method: "POST", cookie: session.cookie, key: `production-${suffix}`, body: { kind: "INFOGRAPHIC", title: "Persistent smoke production", source: "A real test record created through the authenticated API." } };
  const created = await apiRequest(instance.baseUrl, "/api/v1/productions", createOptions);
  const replayed = await apiRequest(instance.baseUrl, "/api/v1/productions", createOptions);
  const upload = new FormData();
  upload.set("file", new Blob(["Stored source content for the persisted NexMarkets smoke flow."], { type: "text/plain" }), "production-source.txt");
  upload.set("rightsAttested", "true");
  const uploadedSourceResponse = await fetch(`${instance.baseUrl}/api/v1/sources`, {
    method: "POST",
    headers: { cookie: session.cookie, origin: instance.baseUrl, "idempotency-key": `source-${suffix}` },
    body: upload
  });
  const uploadedSourcePayload = await uploadedSourceResponse.json();
  if (!uploadedSourceResponse.ok || !uploadedSourcePayload?.data?.id) throw new Error(`Source upload did not persist: ${JSON.stringify(uploadedSourcePayload)}`);
  const uploadedSource = uploadedSourcePayload.data;
  const uploadedContent = await fetch(`${instance.baseUrl}/api/v1/sources/${uploadedSource.id}/content`, { headers: { cookie: session.cookie } });
  if (!uploadedContent.ok || await uploadedContent.text() !== "Stored source content for the persisted NexMarkets smoke flow.") throw new Error("Uploaded source bytes were not retrievable through authenticated storage.");
  await apiRequest(instance.baseUrl, "/api/v1/listings", { method: "POST", cookie: session.cookie, key: `listing-${suffix}`, body: { type: "TASK", title: "Persistent smoke Listing", outcome: "Verify that a submitted Listing remains backed by Prisma storage.", deliverables: "One stored test result", skills: ["Verification"], budgetAtomic: "1000000", places: 1, visibility: "PUBLIC" } });
  const member = await apiRequest(instance.baseUrl, "/api/v1/bootstrap", { cookie: session.cookie });
  const routes = ["/dashboard", "/studio", `/studio/${created.data.id}`, "/marketplace", "/nexmind", "/reputation", "/resources", "/wallet", "/nex", "/buy-nex", "/settings", "/docs"];
  const pages = [];
  for (const route of routes) {
    const response = await fetch(`${instance.baseUrl}${route}`, { headers: { cookie: session.cookie } });
    const html = await response.text();
    if (!response.ok || /<iframe[^>]+Exact_Export|NexMarkets_NexCard_Exact_Export\.html/i.test(html)) throw new Error(`${route} is unavailable or still depends on the export HTML.`);
    pages.push({ route, status: response.status });
  }
  if (created.data.id !== replayed.data.id) throw new Error("Production idempotency replay created a second record.");
  if (!member.data.creations.some((item) => item.id === created.data.id) || !member.data.ownedListings.some((item) => item.title === "Persistent smoke Listing") || !member.data.sources.some((item) => item.id === uploadedSource.id)) throw new Error("Persisted records did not return through bootstrap.");
  process.stdout.write(`${JSON.stringify({ health: health.data, guestEmpty: true, authenticated: member.data.authenticated, productionId: created.data.id, sourceId: uploadedSource.id, sourceContentPersisted: true, idempotentReplay: true, componentRoutes: pages }, null, 2)}\n`);
} finally {
  await stopIsolatedServer(instance);
}
