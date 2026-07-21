/**
 * ThoughtProof Sentinel — Trading Demo Buyer (Virtuals ACP)
 *
 * Route-2 showcase demo: sends THREE agent_output_verification jobs to the
 * graduated Sentinel seller and writes a redacted proof artifact under proof/.
 *
 * Cases (preflighted against sentinel.thoughtproof.ai on 2026-07-21):
 *   1. clean BTC setup        -> trade_execution/checkpoint -> ALLOW
 *   2. threshold+direction bad -> trade_execution/checkpoint -> BLOCK
 *   3. mixed volatile signals  -> trade_execution/standard  -> UNCERTAIN
 *
 * Prereqs: seller.ts running in another terminal (npm run seller), .env with
 * BUYER_* + SELLER_* creds, and a little USDC on the buyer wallet (Base).
 *
 * Usage: npm run demo:trading
 */
import {
  AcpAgent,
  PrivyAlchemyEvmProviderAdapter,
  AssetToken,
  AgentSort,
} from "@virtuals-protocol/acp-node-v2";
import type { JobSession, JobRoomEntry } from "@virtuals-protocol/acp-node-v2";
import { base } from "viem/chains";
import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: __dirname + "/.env" });

const BUYER_WALLET_ADDRESS = process.env.BUYER_WALLET_ADDRESS!;
const BUYER_WALLET_ID = process.env.BUYER_WALLET_ID!;
const BUYER_SIGNER_KEY = process.env.BUYER_SIGNER_PRIVATE_KEY!;
const SELLER_WALLET_ADDRESS = process.env.SELLER_WALLET_ADDRESS!;
const OFFERING = "agent_output_verification";
const WAIT_SEC = parseInt(process.env.WAIT_SEC || "12", 10);

type DemoCase = {
  label: string;
  expected: "ALLOW" | "BLOCK" | "UNCERTAIN";
  payload: { claim: string; evidence: string; mode: string; tier: string };
};

const CASES: DemoCase[] = [
  {
    label: "ALLOW — clean BTC setup",
    expected: "ALLOW",
    payload: {
      claim:
        "Execute BTC long. Setup: Allora confidence 0.72 vs entry threshold 0.70; BTC price 67,250 above 20d MA 66,100; 24h +2.1%, 1h +0.4%, 7d +5.8%; momentum positive; no conflicting indicators.",
      evidence:
        "Allora BTC confidence=0.72. Entry threshold=0.70. Binance BTCUSDT last=67,250, 20d MA=66,100, 24h change=+2.1%, 1h change=+0.4%, 7d change=+5.8%, momentum=positive. No other indicators.",
      mode: "trade_execution",
      tier: "checkpoint",
    },
  },
  {
    label: "BLOCK — threshold + direction violation",
    expected: "BLOCK",
    payload: {
      claim:
        "Execute BTC long: Allora confidence 62% (below 70% threshold), Binance trend up.",
      evidence:
        "Allora BTC confidence 0.62. Entry threshold 0.70. Binance BTCUSDT 24h change -0.08%, 1h change -0.02%, last price 67100. No other indicators.",
      mode: "trade_execution",
      tier: "checkpoint",
    },
  },
  {
    label: "UNCERTAIN — mixed volatile signals",
    expected: "UNCERTAIN",
    payload: {
      claim:
        "Execute SOL long: threshold met, but trend is mixed and volatile; proceed cautiously.",
      evidence:
        "Allora SOL confidence=0.71. Entry threshold=0.70. SOL last=145.2, 20d MA=144.8, 24h=+0.6%, 1h=-0.4%, 7d=+1.1%, volatility=high, momentum=mixed. No volume confirmation.",
      mode: "trade_execution",
      tier: "standard",
    },
  },
];

function ts() { return new Date().toISOString(); }
function shortTs() { return new Date().toISOString().substring(11, 19); }
function sleep(sec: number) { return new Promise(r => setTimeout(r, sec * 1000)); }
function isTransientVirtualsError(msg: string): boolean {
  return /502|Bad Gateway|not valid JSON|<!DOCTYPE|503|504|timeout|ECONNRESET|fetch failed/i.test(msg);
}

function findDeliverable(session: JobSession): string | null {
  for (const e of session.entries as any[]) {
    if (e.kind === "message" && e.contentType === "deliverable") return e.content;
  }
  // Fallback: last non-requirement message not sent by the buyer role.
  const messages = (session.entries as any[]).filter((e) => e.kind === "message");
  const last = messages[messages.length - 1];
  return last?.content ?? null;
}

function parseDeliverable(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return { raw }; }
}

async function main() {
  console.log("🛡️  Sentinel ACP — Trading Demo (3 jobs)");
  console.log(`   Buyer:  ${BUYER_WALLET_ADDRESS}`);
  console.log(`   Seller: ${SELLER_WALLET_ADDRESS}`);
  console.log(`   Offering: ${OFFERING}\n`);

  for (const [k, v] of Object.entries({ BUYER_WALLET_ADDRESS, BUYER_WALLET_ID, BUYER_SIGNER_KEY, SELLER_WALLET_ADDRESS })) {
    if (!v) { console.error(`💥 Missing env ${k}`); process.exit(1); }
  }

  const buyer = await AcpAgent.create({
    provider: await PrivyAlchemyEvmProviderAdapter.create({
      walletAddress: BUYER_WALLET_ADDRESS as `0x${string}`,
      walletId: BUYER_WALLET_ID,
      signerPrivateKey: BUYER_SIGNER_KEY,
      chains: [base],
    }),
  });
  const buyerAddress = await buyer.getAddress();
  console.log(`✅ Buyer connected: ${buyerAddress}\n`);

  const pending = new Map<string, { c: DemoCase; t0: number; timings: Record<string, number>; deliverableRaw?: string | null; resolve: (a: any) => void }>();
  const artifacts: any[] = [];

  const mark = (p: { t0: number; timings: Record<string, number> }, stage: string) => {
    p.timings[stage] = Math.round(((Date.now() - p.t0) / 1000) * 10) / 10;
    console.log(`   ⏱️  ${stage}: +${p.timings[stage].toFixed(1)}s`);
  };

  buyer.on("entry", async (session: JobSession, entry: JobRoomEntry) => {
    if (entry.kind !== "system") return;
    const key = String(session.jobId);
    const p = pending.get(key);
    if (!p) return;

    switch (entry.event.type) {
      case "budget.set":
        console.log(`[${shortTs()}] 💰 Job ${key}: funding...`);
        mark(p, "budget_set");
        {
          let funded = false;
          let lastErr = "";
          for (let attempt = 1; attempt <= 3 && !funded; attempt++) {
            try {
              await session.fund(AssetToken.usdc(0.01, session.chainId));
              funded = true;
            } catch (e: any) {
              lastErr = e.message;
              if (attempt < 3 && isTransientVirtualsError(lastErr)) {
                console.log(`   ⚠️ fund attempt ${attempt} hit transient Virtuals error — retrying in 10s (${String(lastErr).substring(0, 80)})`);
                await sleep(10);
              }
            }
          }
          if (!funded) p.resolve({ outcome: "fund_failed", error: lastErr });
        }
        break;
      case "job.funded":
        mark(p, "funded");
        break;
      case "job.submitted": {
        mark(p, "submitted");
        // ACP v2 puts the deliverable directly on the job.submitted system event.
        // Keep a session-history scan as fallback for older transports.
        const raw = (entry.event as any).deliverable ?? findDeliverable(session);
        p.deliverableRaw = raw;
        const parsed = parseDeliverable(raw);
        console.log(`[${shortTs()}] 📦 Job ${key}: deliverable verdict=${parsed?.verdict ?? "?"} conf=${parsed?.confidence ?? "?"} → completing`);
        try { await session.complete("Sentinel trading demo verdict accepted"); }
        catch (e: any) { p.resolve({ outcome: "complete_failed", error: e.message, deliverableRaw: raw, parsed }); }
        break;
      }
      case "job.completed": {
        mark(p, "completed");
        const raw = p.deliverableRaw ?? findDeliverable(session);
        const parsed = parseDeliverable(raw);
        console.log(`\n[${shortTs()}] 🎉 Job ${key} COMPLETED — ${p.c.label} → ${parsed?.verdict ?? "?"} (expected ${p.c.expected})`);
        p.resolve({ outcome: "completed", deliverableRaw: raw, parsed });
        break;
      }
      case "job.rejected":
        mark(p, "rejected");
        console.log(`\n[${shortTs()}] 🚫 Job ${key} REJECTED — ${p.c.label}`);
        p.resolve({ outcome: "rejected" });
        break;
      case "job.expired":
        mark(p, "expired");
        console.log(`\n[${shortTs()}] ⏰ Job ${key} EXPIRED — ${p.c.label}`);
        p.resolve({ outcome: "expired" });
        break;
    }
  });

  await buyer.start(() => console.log("📡 Buyer listening...\n"));

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    console.log(`\n[${shortTs()}] 📤 Job ${i + 1}/3 — ${c.label}`);
    const t0 = Date.now();
    const timings: Record<string, number> = {};
    let lastJobId: string | null = null;

    const artifact = await new Promise<any>((resolve) => {
      const submit = async () => {
        let lastErr = "";
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const jobId = await buyer.createJobByOfferingName(
              base.id,
              OFFERING,
              SELLER_WALLET_ADDRESS as `0x${string}`,
              c.payload,
              { evaluatorAddress: buyerAddress as `0x${string}` },
            );
            const key = String(jobId);
            lastJobId = key;
            pending.set(key, { c, t0, timings, resolve });
            timings.job_create = Math.round(((Date.now() - t0) / 1000) * 10) / 10;
            console.log(`   ✅ Job #${key} created (+${timings.job_create.toFixed(1)}s)`);
            return;
          } catch (err: any) {
            lastErr = err.message;
            if (attempt < 3 && isTransientVirtualsError(lastErr)) {
              console.log(`   ⚠️ create attempt ${attempt} hit transient Virtuals error — retrying in 12s (${String(lastErr).substring(0, 90)})`);
              await sleep(12);
              continue;
            }
            console.error(`   ❌ createJobByOfferingName failed: ${lastErr}`);
          }
        }

        try {
          const agents = await buyer.browseAgents("ThoughtProof", { sortBy: [AgentSort.SUCCESSFUL_JOB_COUNT], topK: 10, showHidden: true });
          const ours = (agents as any[]).find(a => (a.walletAddress || "").toLowerCase() === SELLER_WALLET_ADDRESS.toLowerCase());
          if (ours?.offerings?.length) {
            const jobId = await buyer.createJobFromOffering(base.id, ours.offerings[0], SELLER_WALLET_ADDRESS as `0x${string}`, c.payload, { evaluatorAddress: buyerAddress as `0x${string}` });
            const key = String(jobId);
            lastJobId = key;
            pending.set(key, { c, t0, timings, resolve });
            timings.job_create = Math.round(((Date.now() - t0) / 1000) * 10) / 10;
            console.log(`   ✅ Job #${key} created via fallback (+${timings.job_create.toFixed(1)}s)`);
          } else {
            resolve({ outcome: "create_failed", error: "seller/offering not found in registry" });
          }
        } catch (e2: any) {
          resolve({ outcome: "create_failed", error: e2.message });
        }
      };
      void submit();
      setTimeout(() => resolve({ outcome: "timeout" }), 12 * 60 * 1000);
    });

    pending.clear();
    const parsed = artifact.parsed ?? null;
    artifacts.push({
      label: c.label,
      expected: c.expected,
      jobId: artifact.jobId ?? lastJobId,
      request: c.payload,
      outcome: artifact.outcome,
      error: artifact.error ?? null,
      timingsSec: timings,
      verdict: parsed?.verdict ?? null,
      confidence: parsed?.confidence ?? null,
      mode: parsed?.mode ?? c.payload.mode,
      tier: parsed?.tier ?? c.payload.tier,
      models_used: parsed?.models_used ?? [],
      objections: parsed?.objections ?? [],
      verificationId: parsed?.verificationId ?? null,
      attestation: parsed?.attestation ?? null,
      deliverableRaw: artifact.deliverableRaw ?? null,
      recordedAt: ts(),
    });

    const ok = artifact.outcome === "completed" && parsed?.verdict === c.expected;
    if (!ok) {
      console.log(`\n⚠️ Case mismatch/failure: expected ${c.expected}, got outcome=${artifact.outcome} verdict=${parsed?.verdict ?? "?"}`);
      // Continue to capture all three, then exit non-zero at the end.
    }

    if (i < CASES.length - 1) {
      console.log(`   ⏳ waiting ${WAIT_SEC}s before next job...`);
      await new Promise(r => setTimeout(r, WAIT_SEC * 1000));
    }
  }

  const summary = {
    generatedAt: ts(),
    offering: OFFERING,
    chain: "base",
    chainId: base.id,
    buyer: buyerAddress,
    seller: SELLER_WALLET_ADDRESS,
    cases: artifacts.length,
    completed: artifacts.filter(a => a.outcome === "completed").length,
    matchedExpectation: artifacts.filter(a => a.outcome === "completed" && a.verdict === a.expected).length,
    verdicts: artifacts.map(a => ({ label: a.label, expected: a.expected, actual: a.verdict, outcome: a.outcome, confidence: a.confidence, jobId: a.jobId ?? null })),
    note: "Redacted demo artifact. No private keys, no .env values. Public wallet addresses only.",
  };

  mkdirSync(join(__dirname, "proof"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(__dirname, "proof", `sentinel-trading-acp-demo-${stamp}.json`);
  const mdPath = join(__dirname, "proof", `sentinel-trading-acp-demo-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify({ summary, artifacts }, null, 2));

  const md = [
    "# Sentinel ACP trading demo — proof artifact",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Offering: \`${OFFERING}\` on Base (${base.id})`,
    `- Seller: \`${SELLER_WALLET_ADDRESS}\``,
    `- Buyer: \`${buyerAddress}\``,
    `- Completed: ${summary.completed}/${summary.cases}; matched expectation: ${summary.matchedExpectation}/${summary.cases}`,
    "",
    "| Case | Job | Expected | Actual | Confidence | Outcome |",
    "|---|---:|---|---:|---:|---|",
    ...summary.verdicts.map(v => `| ${v.label} | ${v.jobId ?? "—"} | ${v.expected} | ${v.actual ?? "—"} | ${v.confidence ?? "—"} | ${v.outcome} |`),
    "",
    "Raw JSON: same basename `.json`. No secrets; public wallet addresses only.",
  ].join("\n");
  writeFileSync(mdPath, md + "\n");

  console.log(`\n🧾 Proof artifact written:\n   ${jsonPath}\n   ${mdPath}`);
  console.log("\nSummary:", JSON.stringify(summary.verdicts, null, 2));

  await buyer.stop();
  const allOk = summary.completed === summary.cases && summary.matchedExpectation === summary.cases;
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => { console.error("💥 Fatal:", e); process.exit(1); });
