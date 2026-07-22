import process from "node:process";
import { apiRequest, startIsolatedServer, stopIsolatedServer } from "./smoke-helpers.mjs";

const instance = await startIsolatedServer(Number(process.env.SMOKE_VIDEO_PORT || 3103), { dev: true, readyPath: "/", env: { NEXMARKETS_DEV_SIMULATION: "true" } });
try {
  const session = {
    cookie: "nex_session=nex-dev-bypass-token",
    account: { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" }
  };
  const suffix = `${Date.now()}-${process.pid}`;
  const created = await apiRequest(instance.baseUrl, "/api/v1/productions", {
    method: "POST",
    cookie: session.cookie,
    key: `video-production-${suffix}`,
    body: { kind: "VIDEO", title: "Dev simulated launch video", source: "A persisted local video simulation test." }
  });
  const productionId = created.data.id;
  await apiRequest(instance.baseUrl, `/api/v1/productions/${productionId}`, {
    method: "PATCH",
    cookie: session.cookie,
    key: `video-direction-${suffix}`,
    body: {
      direction: { duration: "30 seconds", durationSeconds: 30, aspectRatio: "16:9", primaryColour: "#ffb000" },
      brief: { message: "Show the product route clearly before the promise." }
    }
  });
  const quote = await apiRequest(instance.baseUrl, `/api/v1/productions/${productionId}/quote`, {
    method: "POST",
    cookie: session.cookie,
    key: `video-quote-${suffix}`,
    body: { payer: session.account.address }
  });
  const txHash = `0x${"1".repeat(64)}`;
  const payment = await apiRequest(instance.baseUrl, `/api/v1/productions/${productionId}/payment-intents`, {
    method: "POST",
    cookie: session.cookie,
    key: `video-payment-${suffix}`,
    body: { quoteId: quote.data.id, txHash }
  });
  if (payment.data.status !== "CONFIRMED") throw new Error(`Dev simulated payment was not confirmed: ${JSON.stringify(payment.data)}`);
  const render = await apiRequest(instance.baseUrl, `/api/v1/productions/${productionId}/render`, {
    method: "POST",
    cookie: session.cookie,
    key: `video-render-${suffix}`,
    body: { message: "Show the product route clearly before the promise.", callToAction: "Open NexMarkets", accent: "#ffb000", aspectRatio: "16:9" }
  });
  if (render.data.renderJob.status !== "COMPLETED" || !render.data.version.outputObjectKey) throw new Error(`Dev simulated render did not persist output: ${JSON.stringify(render.data)}`);
  const output = await fetch(`${instance.baseUrl}/api/v1/productions/${productionId}/output?disposition=inline`, { headers: { cookie: session.cookie } });
  if (!output.ok || !output.headers.get("content-type")?.startsWith("video/")) throw new Error(`Video output was not retrievable: ${output.status}`);
  process.stdout.write(`${JSON.stringify({ productionId, payment: payment.data.status, renderJob: render.data.renderJob.status, outputType: output.headers.get("content-type") }, null, 2)}\n`);
} finally {
  await stopIsolatedServer(instance);
}
