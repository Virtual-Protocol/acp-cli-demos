import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_LAMPORTS = 1_000_000;
const TIMEOUT_MS = 30_000;

export async function runTransfer({ input, fetch = globalThis.fetch, process: acp = createAcpProcess(), writeProof } = {}) {
  let normalized;
  let verdict;
  try {
    normalized = normalizeInput(input);
    normalized.feePayer = await resolveAcpAddress(acp);
    verdict = await verify(normalized, fetch);
    if (await resolveAcpAddress(acp) !== normalized.feePayer) stop("ACP wallet changed after Compass allow; check wallet history before retry");
    const result = await acp.run({ command: "acp", args: ["wallet", "sol", "transfer", "--to", normalized.recipient, "--amount", normalized.amountSol, "--cluster", "devnet", "--json"], shell: false, timeoutMs: TIMEOUT_MS });
    const signature = extractSignature(result);
    const evidence = makeEvidence(normalized, verdict, { signature });
    try { await writeProof?.(evidence); return { signature, evidence }; }
    catch { return { signature, evidence, proofWriteError: "ACP reported a signature; evidence was not saved. Check wallet history before retry." }; }
  } catch (error) {
    if (error?.evidence) {
      try { await writeProof?.(error.evidence); } catch { /* preserve original failure */ }
    } else if (normalized && verdict) {
      const evidence = makeEvidence(normalized, verdict, { stoppedStage: "acp-execution-uncertain" });
      try { await writeProof?.(evidence); } catch { /* preserve original failure */ }
    }
    if (String(error?.message).startsWith("Transfer stopped:")) throw error;
    stop("unexpected preflight failure");
  }
}

export function normalizeInput(input) {
  if (!input || input.confirmed !== "yes") stop("confirmed inputs are required");
  if (input.cluster !== "devnet") stop("devnet is required");
  if (!isPublicKey(input.recipient)) stop("invalid recipient public key");
  if (!String(input.recipientAllowlist ?? "").split(",").map((entry) => entry.trim()).includes(input.recipient)) stop("recipient is not in the demo allowlist");
  if (typeof input.amountUsdPolicyInput !== "string" || !input.amountUsdPolicyInput.trim()) stop("amountUsd policy input must be finite");
  const amountUsd = Number(input.amountUsdPolicyInput);
  if (!Number.isFinite(amountUsd) || amountUsd < 0) stop("amountUsd policy input must be finite");
  const lamports = solToLamports(input.amountSol);
  if (lamports <= 0 || lamports > MAX_LAMPORTS) stop("amount must be greater than 0 and at most 0.001 SOL");
  if (typeof input.compassUrl !== "string" || !input.compassUrl.startsWith("https://")) stop("Compass HTTPS URL is required");
  return { recipient: input.recipient, amountSol: String(input.amountSol), lamports, amountUsd, cluster: "devnet", compassUrl: input.compassUrl.replace(/\/$/, ""), apiKey: input.apiKey };
}

async function resolveAcpAddress(acp) {
  const result = await acp.run({ command: "acp", args: ["wallet", "sol", "address", "--json"], shell: false, timeoutMs: TIMEOUT_MS });
  if (result?.timedOut) stop("ACP address lookup timed out");
  if (!result || result.code !== 0) stop("ACP address lookup failed");
  let body;
  try { body = JSON.parse(result.stdout); } catch { stop("ACP address lookup returned malformed JSON"); }
  if (!isPublicKey(body?.address)) stop("ACP address lookup returned invalid address");
  return body.address;
}

async function verify(input, fetch) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    response = await fetch(`${input.compassUrl}/v1/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {}) },
      signal: controller.signal,
      body: JSON.stringify({ toolName: "transfer_sol", intent: { kind: "transfer" }, arguments: { recipient: input.recipient, recipientKnown: true, amountUsd: input.amountUsd, amountSol: input.amountSol, lamports: input.lamports, cluster: "devnet", feePayer: input.feePayer, agentWallet: input.feePayer } }),
    });
  } catch (error) {
    stop(error?.name === "AbortError" ? "Compass preflight timed out" : "Compass preflight network failure");
  } finally { clearTimeout(timeout); }
  if (!response?.ok) stop(`Compass preflight HTTP ${response?.status ?? "failure"}`);
  let body;
  try { body = await response.json(); } catch { stop("Compass preflight returned invalid JSON"); }
  if (!body || typeof body.correlationId !== "string" || !Array.isArray(body.reasons) || !body.reasons.every((reason) => typeof reason === "string")) stop("Compass preflight returned invalid schema");
  if (body.decision !== "allow") fail(`Compass decision ${String(body.decision)} requires no ACP transfer`, makeEvidence(input, body, { stoppedStage: "compass-decision" }));
  return body;
}

function extractSignature(result) {
  if (result?.timedOut || result?.uncertainProcessState) stop("ACP timeout/process state is uncertain; check wallet history before retry");
  if (!result || result.code !== 0) stop("ACP failed; check wallet history before retry");
  let body;
  try { body = JSON.parse(result.stdout); } catch { stop("ACP returned malformed JSON; check wallet history before retry"); }
  if (!isSignature(body?.signature)) stop("ACP returned no valid signature; check wallet history before retry");
  return body.signature;
}

export function createAcpProcess(spawnProcess = spawn, { killGraceMs = 500, reapGraceMs = 500 } = {}) {
  return { run({ command, args, timeoutMs }) {
    return new Promise((resolve) => {
      const child = spawnProcess(command, args, { shell: false });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      let timeout;
      let killTimer;
      let reapTimer;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout); clearTimeout(killTimer); clearTimeout(reapTimer);
        resolve(result);
      };
      child.stdout?.on("data", (chunk) => { stdout += chunk; });
      child.stderr?.on("data", (chunk) => { stderr += chunk; });
      child.on("error", () => finish({ code: null, stdout, stderr }));
      child.on("close", (code) => finish({ code, stdout, stderr, ...(timedOut ? { timedOut: true, reaped: true } : {}) }));
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        killTimer = setTimeout(() => {
          child.kill("SIGKILL");
          reapTimer = setTimeout(() => finish({ timedOut: true, uncertainProcessState: true, reaped: false, code: null, stdout, stderr }), reapGraceMs);
        }, killGraceMs);
      }, timeoutMs);
    });
  } };
}

function makeEvidence(input, verdict, outcome) {
  return { endpointOrigin: new URL(input.compassUrl).origin, transfer: { recipient: input.recipient, amountSol: input.amountSol, lamports: input.lamports, feePayer: input.feePayer, cluster: "devnet" }, decision: verdict.decision, correlationId: verdict.correlationId, reasons: verdict.reasons, ...outcome };
}

function solToLamports(amount) { if (typeof amount !== "string" || !/^\d+(?:\.\d{1,9})?$/.test(amount)) stop("invalid SOL amount"); const [whole, fraction = ""] = amount.split("."); return Number(whole) * LAMPORTS_PER_SOL + Number((fraction + "000000000").slice(0, 9)); }
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function decodeBase58(value) {
  if (typeof value !== "string" || !value) return null;
  const bytes = [];
  for (const character of value) {
    let carry = BASE58.indexOf(character);
    if (carry < 0) return null;
    for (let index = bytes.length - 1; index >= 0; index -= 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.unshift(carry & 0xff); carry >>= 8; }
  }
  let zeroes = 0;
  while (value[zeroes] === "1") zeroes += 1;
  return Uint8Array.from([...Array(zeroes).fill(0), ...bytes]);
}
function isPublicKey(value) { return decodeBase58(value)?.length === 32; }
function isSignature(value) { return decodeBase58(value)?.length === 64; }
function stop(message) { throw new Error(`Transfer stopped: ${message}`); }
function fail(message, evidence) { const error = new Error(`Transfer stopped: ${message}`); error.evidence = evidence; throw error; }

export function inputFromEnv(env) { return { confirmed: env.CONFIRMED_TRANSFER, recipient: env.TRANSFER_RECIPIENT, recipientAllowlist: env.DEMO_RECIPIENT_ALLOWLIST, amountSol: env.TRANSFER_AMOUNT_SOL, amountUsdPolicyInput: env.AMOUNT_USD_POLICY_INPUT, cluster: env.SOLANA_CLUSTER, compassUrl: env.COMPASS_API_URL, apiKey: env.COMPASS_API_KEY }; }

const isDirectInvocation = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectInvocation) runTransfer({ input: inputFromEnv(process.env), writeProof: async (proof) => process.stdout.write(`${JSON.stringify(proof)}\n`) }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
