import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createAcpProcess, decodeBase58, runTransfer } from "./run-transfer.mjs";

const recipient = "11111111111111111111111111111111";
const feePayer = recipient;
const changedPayer = "SysvarC1ock11111111111111111111111111111111";
const signature = "1".repeat(64);

function inputs(overrides = {}) {
  return { confirmed: "yes", recipient, recipientAllowlist: recipient, amountSol: "0.0005", amountUsdPolicyInput: "0.10", cluster: "devnet", compassUrl: "https://compass.example", ...overrides };
}

function acp(results) {
  const calls = [];
  return { calls, async run(request) { calls.push(request); return results.shift(); } };
}

function result(body) { return { code: 0, stdout: JSON.stringify(body), stderr: "" }; }
function walletFixtures() { return [result({ address: feePayer }), result({ address: feePayer })]; }
function allowResponse() { return { ok: true, async json() { return { correlationId: "allow-1", decision: "allow", reasons: ["within demo policy"] }; } }; }
async function expectStop(options, message) { await assert.rejects(() => runTransfer(options), new RegExp(message)); }

test("rechecks the cluster-independent ACP wallet before transfer", async () => {
  const process = acp([result({ address: feePayer }), result({ address: feePayer }), result({ signature })]);
  await runTransfer({
    input: inputs({ acpExecutable: "untrusted" }),
    process,
    fetch: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body).arguments, {
        recipient, recipientKnown: true, amountUsd: 0.1, amountSol: "0.0005", lamports: 500000, cluster: "devnet", feePayer, agentWallet: feePayer,
      });
      return allowResponse();
    },
  });
  assert.deepEqual(process.calls, [
    { command: "acp", args: ["wallet", "sol", "address", "--json"], shell: false, timeoutMs: 30_000 },
    { command: "acp", args: ["wallet", "sol", "address", "--json"], shell: false, timeoutMs: 30_000 },
    { command: "acp", args: ["wallet", "sol", "transfer", "--to", recipient, "--amount", "0.0005", "--cluster", "devnet", "--json"], shell: false, timeoutMs: 30_000 },
  ]);
});

test("stops before Compass when ACP address is unavailable or malformed", async () => {
  for (const addressResult of [{ code: 127, stdout: "", stderr: "not found" }, result({ address: "bad" })]) {
    let fetchCalls = 0;
    const process = acp([addressResult]);
    await expectStop({ input: inputs(), process, fetch: async () => { fetchCalls += 1; return allowResponse(); } }, "ACP address lookup");
    assert.equal(fetchCalls, 0);
    assert.equal(process.calls.length, 1);
  }
});

test("does not invoke ACP transfer before exact Compass allow", async () => {
  for (const decision of ["review", "deny", "ALLOW"]) {
    const process = acp(walletFixtures());
    const evidence = [];
    await expectStop({ input: inputs(), process, fetch: async () => ({ ok: true, async json() { return { correlationId: decision, decision, reasons: [] }; } }), writeProof: async (proof) => evidence.push(proof) }, "Compass decision");
    assert.equal(process.calls.some((call) => call.args.includes("transfer")), false);
    assert.equal(evidence[0].stoppedStage, "compass-decision");
  }
});

test("rejects a malformed Compass schema after read-only ACP address lookup", async () => {
  const process = acp([result({ address: feePayer })]);
  await expectStop({
    input: inputs(),
    process,
    fetch: async () => ({ ok: true, async json() { return { decision: "allow", reasons: "wrong" }; } }),
  }, "invalid schema");
  assert.equal(process.calls.length, 1);
});

test("requires a valid ACP signature and writes fee-payer evidence", async () => {
  const process = acp([result({ address: feePayer }), result({ address: feePayer }), result({ signature })]);
  const output = await runTransfer({ input: inputs(), process, fetch: async () => allowResponse() });
  assert.equal(output.signature, signature);
  assert.equal(output.evidence.transfer.feePayer, feePayer);
});

test("treats ACP timeout, nonzero, malformed JSON, and missing signatures as uncertain", async () => {
  for (const transferResult of [{ timedOut: true, reaped: true, code: null, stdout: "", stderr: "" }, { code: 1, stdout: "", stderr: "error" }, { code: 0, stdout: "no", stderr: "" }, result({})]) {
    const evidence = [];
    await expectStop({ input: inputs(), process: acp([result({ address: feePayer }), result({ address: feePayer }), transferResult]), fetch: async () => allowResponse(), writeProof: async (proof) => evidence.push(proof) }, "check wallet history before retry");
    assert.equal(evidence[0].transfer.feePayer, feePayer);
    assert.equal(evidence[0].stoppedStage, "acp-execution-uncertain");
  }
});

test("stops before transfer when the ACP wallet changes after Compass allow", async () => {
  const process = acp([result({ address: feePayer }), result({ address: changedPayer })]);
  await expectStop({ input: inputs(), process, fetch: async () => allowResponse() }, "wallet changed");
  assert.equal(process.calls.length, 2);
});

test("accepts only exact Base58 decoded address and signature lengths", () => {
  assert.equal(decodeBase58("1".repeat(32)).length, 32);
  assert.equal(decodeBase58("1".repeat(64)).length, 64);
  assert.equal(decodeBase58("0"), null);
  assert.equal(decodeBase58("1".repeat(31)).length, 31);
  assert.equal(decodeBase58("1".repeat(65)).length, 65);
});

test("reaps a timed-out ACP process with TERM then KILL before returning", async () => {
  const signals = [];
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = (signal) => {
    signals.push(signal);
    if (signal === "SIGKILL") setTimeout(() => child.emit("close", null), 0);
  };
  const process = createAcpProcess(() => child, { killGraceMs: 1, reapGraceMs: 10 });
  const outcome = await process.run({ command: "acp", args: ["wallet"], shell: false, timeoutMs: 1 });
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(outcome.timedOut, true);
  assert.equal(outcome.reaped, true);
});

test("direct Node invocation runs main and fails closed before network or ACP", () => {
  const script = fileURLToPath(new URL("./run-transfer.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { env: { ...process.env, CONFIRMED_TRANSFER: "no" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /confirmed inputs are required/);
});

test("fresh input gate matrix stops before ACP address or transfer", async () => {
  for (const override of [
    { recipient: undefined }, { recipient: "bad" }, { amountSol: "0" }, { amountSol: "0.0011" },
    { recipientAllowlist: "bad" }, { confirmed: "no" }, { cluster: "testnet" },
    { amountUsdPolicyInput: "NaN" }, { amountUsdPolicyInput: "" },
  ]) {
    const process = acp([]);
    let fetchCalls = 0;
    await expectStop({ input: inputs(override), process, fetch: async () => { fetchCalls += 1; return allowResponse(); } }, "stopped");
    assert.equal(fetchCalls, 0);
    assert.equal(process.calls.length, 0);
  }
});

test("fresh Compass failure matrix never invokes ACP transfer", async () => {
  const responses = [
    { ok: false, status: 401, async json() { return {}; } },
    { ok: false, status: 500, async json() { return {}; } },
    { ok: true, async json() { return { correlationId: "bad", decision: "allow", reasons: "wrong" }; } },
    { ok: true, async json() { throw new Error("bad json"); } },
    { ok: true, async json() { return { correlationId: "review", decision: "review", reasons: ["manual"] }; } },
    { ok: true, async json() { return { correlationId: "deny", decision: "deny", reasons: ["blocked"] }; } },
  ];
  for (const response of responses) {
    const process = acp(walletFixtures());
    await expectStop({ input: inputs(), process, fetch: async () => response }, "stopped");
    assert.equal(process.calls.some((call) => call.args.includes("transfer")), false);
  }
  for (const [failure, reason] of [
    [new Error("offline"), "Compass preflight network failure"],
    [new DOMException("aborted", "AbortError"), "Compass preflight timed out"],
  ]) {
    const process = acp(walletFixtures());
    await expectStop({ input: inputs(), process, fetch: async () => { throw failure; } }, reason);
    assert.equal(process.calls.some((call) => call.args.includes("transfer")), false);
  }
});
