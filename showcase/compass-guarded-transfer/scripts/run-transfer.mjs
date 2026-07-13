import fs from "node:fs/promises";
import process from "node:process";

const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_LAMPORTS = 1_000_000;
const PREFLIGHT_TIMEOUT_MS = 10_000;
const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

export async function runTransfer({ input, fetch = globalThis.fetch, client, writeProof } = {}) {
  let normalized;
  let verdict;
  try {
    normalized = normalizeInput(input);
    const adapter = client ?? await createWeb3Client(normalized.rpcUrl, normalized.keypairPath);
    if (await adapter.getGenesisHash() !== DEVNET_GENESIS) stop("RPC endpoint is not Solana devnet genesis");
    verdict = await verify(normalized, fetch);
    const transaction = await adapter.buildTransfer({
      recipient: normalized.recipient,
      lamports: normalized.lamports,
      feePayer: normalized.feePayer,
      cluster: normalized.cluster,
    });
    const simulation = await adapter.simulate(transaction);
    if (simulation?.value?.err) stop("simulation failed");

    const signer = await adapter.createSigner();
    if (signer.publicKey !== normalized.feePayer) stop("fee payer changed after preflight");
    const signed = await adapter.sign(transaction, signer);
    const signature = await adapter.send(signed);
    const evidence = makeEvidence(normalized, verdict, "passed", signature);
    try {
      await writeProof?.(evidence);
      return { signature, evidence };
    } catch {
      return { signature, evidence, proofWriteError: "Transaction broadcast; evidence was not saved. Do not retry blindly." };
    }
  } catch (error) {
    if (error?.evidence) {
      try { await writeProof?.(error.evidence); } catch { /* stopping remains safer than retrying */ }
    } else if (normalized && verdict) {
      const evidence = makeEvidence(normalized, verdict, undefined, undefined, "pre-sign-rpc");
      try { await writeProof?.(evidence); } catch { /* stopping remains safer than retrying */ }
    }
    if (String(error?.message).startsWith("Transfer stopped:")) throw error;
    stop(error?.name === "AbortError" ? "preflight timed out" : "preflight or RPC failed");
  }
}

export function normalizeInput(input) {
  if (!input || input.confirmed !== "yes") stop("confirmed inputs are required");
  if (input.cluster !== "devnet") stop("devnet is required");
  if (typeof input.amountUsdPolicyInput !== "string" || !input.amountUsdPolicyInput.trim()) stop("amountUsd policy input must be a finite non-negative number");
  const amountUsd = Number(input.amountUsdPolicyInput);
  if (!Number.isFinite(amountUsd) || amountUsd < 0) stop("amountUsd policy input must be a finite non-negative number");
  if (!isPublicKey(input.recipient) || !isPublicKey(input.feePayer) || !isPublicKey(input.signerPublicKey)) stop("invalid public key");
  if (!String(input.recipientAllowlist ?? "").split(",").map((entry) => entry.trim()).includes(input.recipient)) stop("recipient is not in the demo allowlist");
  if (input.feePayer !== input.signerPublicKey) stop("fee payer mismatch");

  const lamports = solToLamports(input.amountSol);
  if (lamports <= 0 || lamports > MAX_LAMPORTS) stop("amount must be greater than 0 and at most 0.001 SOL");
  if (typeof input.compassUrl !== "string" || !input.compassUrl.startsWith("https://")) stop("Compass HTTPS URL is required");

  return {
    recipient: input.recipient,
    lamports,
    amountSol: String(input.amountSol),
    amountUsdPolicyInput: input.amountUsdPolicyInput.trim(),
    amountUsd,
    feePayer: input.feePayer,
    cluster: "devnet",
    compassUrl: input.compassUrl.replace(/\/$/, ""),
    apiKey: input.apiKey,
    rpcUrl: input.rpcUrl,
    keypairPath: input.keypairPath,
  };
}

export function makeEvidence(input, verdict, simulation, signature, stoppedStage) {
  return {
    endpointOrigin: new URL(input.compassUrl).origin,
    transfer: { recipient: input.recipient, amountSol: input.amountSol, feePayer: input.feePayer, cluster: "devnet" },
    decision: verdict.decision,
    correlationId: verdict.correlationId,
    reasons: verdict.reasons,
    ...(simulation ? { simulation } : {}),
    ...(signature ? { signature } : { stoppedStage: stoppedStage ?? "before-signing" }),
  };
}

async function verify(input, fetch) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  try {
    response = await fetch(`${input.compassUrl}/v1/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {}) },
      signal: controller.signal,
      body: JSON.stringify({
        toolName: "transfer_sol",
        intent: { kind: "transfer" },
        arguments: {
          recipient: input.recipient,
          recipientKnown: true,
          amountUsd: input.amountUsd,
          amountSol: input.amountSol,
          lamports: input.lamports,
          feePayer: input.feePayer,
          cluster: "devnet",
        },
      }),
    });
  } catch (error) {
    stop(error?.name === "AbortError" ? "preflight timed out" : "preflight network failure");
  } finally {
    clearTimeout(timeout);
  }
  if (!response?.ok) stop(`preflight HTTP ${response?.status ?? "failure"}`);

  let body;
  try { body = await response.json(); } catch { stop("preflight returned invalid JSON"); }
  if (!body || typeof body.correlationId !== "string" || !Array.isArray(body.reasons) || !body.reasons.every((reason) => typeof reason === "string")) stop("preflight returned invalid schema");
  if (body.decision !== "allow") {
    const evidence = makeEvidence(input, body, undefined, undefined, "compass-decision");
    const error = new Error(`Transfer stopped: Compass decision ${String(body.decision)} requires no signing; review or correct inputs`);
    error.evidence = evidence;
    throw error;
  }
  return body;
}

function solToLamports(amount) {
  if (typeof amount !== "string" || !/^\d+(?:\.\d{1,9})?$/.test(amount)) stop("invalid SOL amount");
  const [whole, fractional = ""] = amount.split(".");
  return Number(whole) * LAMPORTS_PER_SOL + Number((fractional + "000000000").slice(0, 9));
}

function isPublicKey(value) {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function stop(message) {
  throw new Error(`Transfer stopped: ${message}`);
}

async function createWeb3Client(rpcUrl, keypairPath) {
  if (!rpcUrl || !keypairPath) stop("RPC URL and keypair path are required for live execution");
  let web3;
  try { web3 = await import("@solana/web3.js"); } catch { stop("install the showcase dependencies before live execution"); }
  const connection = new web3.Connection(rpcUrl, "confirmed");
  let signer;
  return {
    async getGenesisHash() { return connection.getGenesisHash(); },
    async createSigner() {
      if (!signer) signer = web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await fs.readFile(keypairPath, "utf8"))));
      return { publicKey: signer.publicKey.toBase58() };
    },
    async buildTransfer({ recipient, lamports, feePayer }) {
      const { blockhash } = await connection.getLatestBlockhash();
      const message = new web3.TransactionMessage({
        payerKey: new web3.PublicKey(feePayer),
        recentBlockhash: blockhash,
        instructions: [web3.SystemProgram.transfer({ fromPubkey: new web3.PublicKey(feePayer), toPubkey: new web3.PublicKey(recipient), lamports })],
      }).compileToV0Message();
      return new web3.VersionedTransaction(message);
    },
    async simulate(transaction) { return connection.simulateTransaction(transaction, { sigVerify: false }); },
    async sign(transaction) { transaction.sign([signer]); return transaction; },
    async send(transaction) { return connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false }); },
  };
}

export function inputFromEnv(env) {
  return {
    confirmed: env.CONFIRMED_TRANSFER,
    recipient: env.TRANSFER_RECIPIENT,
    amountSol: env.TRANSFER_AMOUNT_SOL,
    amountUsdPolicyInput: env.AMOUNT_USD_POLICY_INPUT,
    recipientAllowlist: env.DEMO_RECIPIENT_ALLOWLIST,
    feePayer: env.FEE_PAYER,
    signerPublicKey: env.DEMO_SIGNER_PUBLIC_KEY,
    cluster: env.SOLANA_CLUSTER,
    compassUrl: env.COMPASS_API_URL,
    apiKey: env.COMPASS_API_KEY,
    rpcUrl: env.SOLANA_RPC_URL,
    keypairPath: env.DEMO_KEYPAIR_PATH,
  };
}

if (import.meta.main) {
  const input = inputFromEnv(process.env);
  runTransfer({ input, writeProof: async (proof) => process.stdout.write(`${JSON.stringify(proof)}\n`) }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
