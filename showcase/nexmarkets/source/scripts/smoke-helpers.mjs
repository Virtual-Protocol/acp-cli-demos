import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export async function startIsolatedServer(port, options = {}) {
  const databasePath = path.resolve(process.cwd(), "prisma", `.smoke-${process.pid}-${port}.db`);
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const scanner = createServer((request, response) => {
    request.resume();
    if (request.method !== "POST") { response.writeHead(405).end(); return; }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ clean: true }));
  });
  await new Promise((resolve, reject) => {
    scanner.once("error", reject);
    scanner.listen(0, "127.0.0.1", resolve);
  });
  const scannerAddress = scanner.address();
  if (!scannerAddress || typeof scannerAddress === "string") throw new Error("The isolated malware scanner did not receive a TCP port.");
  const env = { ...process.env, DATABASE_PROVIDER: "sqlite", DATABASE_URL: "", DEV_DATABASE_URL: databaseUrl, APP_ORIGIN: `http://127.0.0.1:${port}`, NEX_ENCRYPTION_KEY: `isolated-smoke-${process.pid}-${port}`, MALWARE_SCAN_URL: `http://127.0.0.1:${scannerAddress.port}/scan`, NEXMARKETS_ISOLATED_TEST: "1", ...(options.env || {}) };
  const prismaCli = path.resolve(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const pushed = spawnSync(process.execPath, [prismaCli, "db", "push", "--config", "prisma.dev.config.ts"], { cwd: process.cwd(), env, encoding: "utf8", windowsHide: true });
  if (pushed.status !== 0) {
    await new Promise((resolve) => scanner.close(resolve));
    throw new Error(`Could not initialise isolated smoke database.\n${pushed.stdout}\n${pushed.stderr}`);
  }
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", options.dev ? "dev" : "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk.toString(); });
  server.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;
  const readyPath = options.readyPath || "/api/v1/health";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited early.\n${output}`);
    try { const response = await fetch(`${baseUrl}${readyPath}`); if (response.ok) return { server, scanner, baseUrl, databasePath, output: () => output }; }
    catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  server.kill();
  await new Promise((resolve) => scanner.close(resolve));
  throw new Error(`Next.js did not become ready.\n${output}`);
}

export async function stopIsolatedServer(instance) {
  if (instance?.server?.exitCode === null) instance.server.kill();
  if (instance?.scanner?.listening) await new Promise((resolve) => instance.scanner.close(resolve));
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const target = `${instance.databasePath}${suffix}`;
    if (existsSync(target)) await rm(target, { force: true });
  }
}

export async function apiRequest(baseUrl, route, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? { origin: baseUrl } : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? { "idempotency-key": options.key || crypto.randomUUID() } : {}),
      ...(options.body ? { "content-type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${route} failed (${response.status}): ${JSON.stringify(payload)}`);
  return { data: payload?.data, status: response.status, response };
}

export async function createWalletSession(baseUrl) {
  const account = privateKeyToAccount(generatePrivateKey());
  const challenge = await apiRequest(baseUrl, "/api/v1/auth/wallet/challenge", { method: "POST", body: { address: account.address, chainId: 46630 } });
  const signature = await account.signMessage({ message: challenge.data.message });
  const verified = await apiRequest(baseUrl, "/api/v1/auth/wallet/verify", { method: "POST", body: { challengeId: challenge.data.challengeId, address: account.address, signature } });
  const setCookie = verified.response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Wallet verification did not return a session cookie.");
  return { account, cookie: setCookie.split(";")[0] };
}
