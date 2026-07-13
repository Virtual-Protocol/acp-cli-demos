import assert from "node:assert/strict";
import test from "node:test";

import { inputFromEnv, runTransfer } from "./run-transfer.mjs";

const recipient = "11111111111111111111111111111111";
const feePayer = "22222222222222222222222222222222";

function inputs(overrides = {}) {
  return {
    confirmed: "yes",
    recipient,
    recipientAllowlist: recipient,
    amountSol: "0.0005",
    amountUsdPolicyInput: "0.10",
    feePayer,
    signerPublicKey: feePayer,
    cluster: "devnet",
    compassUrl: "https://compass.example",
    ...overrides,
  };
}

function client({ simulationError } = {}) {
  const calls = [];
  return {
    calls,
    parsePublicKey(value) {
      if (value === "bad") throw new Error("invalid public key");
      return value;
    },
    async getGenesisHash() {
      return DEVNET_GENESIS;
    },
    async createSigner() {
      calls.push("signer");
      return { publicKey: feePayer };
    },
    async buildTransfer(request) {
      calls.push(["build", request]);
      return { request };
    },
    async simulate() {
      calls.push("simulate");
      return { value: { err: simulationError ?? null } };
    },
    async sign(transaction) {
      calls.push("sign");
      return transaction;
    },
    async send() {
      calls.push("send");
      return "devnet-signature";
    },
  };
}

async function expectStop(options, message) {
  await assert.rejects(() => runTransfer(options), new RegExp(message));
}

test("stops invalid confirmed inputs before preflight or signer construction", async () => {
  for (const override of [
    { confirmed: "no" },
    { amountUsdPolicyInput: "" },
    { recipient: "bad" },
    { cluster: "mainnet-beta" },
    { amountSol: "0" },
    { amountSol: "0.0011" },
  ]) {
    const guardedClient = client();
    let fetchCalls = 0;
    await expectStop(
      {
        input: inputs(override),
        fetch: async () => {
          fetchCalls += 1;
        },
        client: guardedClient,
      },
      "stopped",
    );
    assert.equal(fetchCalls, 0);
    assert.deepEqual(guardedClient.calls, []);
  }
});

test("stops a fee-payer mismatch before preflight, construction, signing, or send", async () => {
  const guardedClient = client();
  await expectStop(
    {
      input: inputs({ signerPublicKey: "33333333333333333333333333333333" }),
      fetch: async () => allowResponse(),
      client: guardedClient,
    },
    "fee payer",
  );
  assert.deepEqual(guardedClient.calls, []);
});

test("stops an unrecognized recipient before preflight or signer construction", async () => {
  const guardedClient = client();
  await expectStop(
    { input: inputs({ recipientAllowlist: "33333333333333333333333333333333" }), fetch: async () => allowResponse(), client: guardedClient },
    "recipient is not in the demo allowlist",
  );
  assert.deepEqual(guardedClient.calls, []);
});

test("stops every non-exact or malformed Compass response before signer construction", async () => {
  for (const response of [
    jsonResponse({ correlationId: "c1", decision: "review", reasons: ["manual review"] }),
    jsonResponse({ correlationId: "c2", decision: "deny", reasons: ["blocked"] }),
    jsonResponse({ correlationId: "c3", decision: "ALLOW", reasons: [] }),
    jsonResponse({ decision: "allow", reasons: [] }),
    jsonResponse({ correlationId: "c4", decision: "allow", reasons: "wrong" }),
    { ok: false, status: 401, async json() { return {}; } },
  ]) {
    const guardedClient = client();
    await expectStop(
      { input: inputs(), fetch: async () => response, client: guardedClient },
      "stopped",
    );
    assert.deepEqual(guardedClient.calls, []);
  }
});

test("stops timeout, network, and simulation failures before signing or send", async () => {
  for (const options of [
    { fetch: async () => { throw new Error("network unavailable"); } },
    { fetch: async () => { throw new DOMException("timed out", "AbortError"); } },
    { fetch: async () => allowResponse(), client: client({ simulationError: "simulation failed" }) },
  ]) {
    const guardedClient = options.client ?? client();
    await expectStop(
      { input: inputs(), fetch: options.fetch, client: guardedClient },
      "stopped",
    );
    assert.equal(guardedClient.calls.includes("sign"), false);
    assert.equal(guardedClient.calls.includes("send"), false);
  }
});

test("passes an abort signal to the Compass preflight request", async () => {
  let signal;
  await runTransfer({
    input: inputs(),
    fetch: async (_url, options) => {
      signal = options.signal;
      return allowResponse();
    },
    client: client(),
  });
  assert.equal(signal instanceof AbortSignal, true);
});

test("rejects an RPC endpoint whose genesis is not Solana devnet before Compass or transaction work", async () => {
  const guardedClient = client();
  guardedClient.getGenesisHash = async () => "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
  let fetchCalls = 0;
  await expectStop({
    input: inputs(),
    fetch: async () => { fetchCalls += 1; return allowResponse(); },
    client: guardedClient,
  }, "devnet genesis");
  assert.equal(fetchCalls, 0);
  assert.deepEqual(guardedClient.calls, []);
});

test("sends finite numeric USD and exact normalized transfer facts to Compass", async () => {
  const guardedClient = client();
  guardedClient.getGenesisHash = async () => DEVNET_GENESIS;
  await runTransfer({
    input: inputs({ amountUsdPolicyInput: "0.10" }),
    fetch: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.deepEqual(request.arguments, {
        recipient,
        recipientKnown: true,
        amountUsd: 0.1,
        amountSol: "0.0005",
        lamports: 500000,
        feePayer,
        cluster: "devnet",
      });
      return allowResponse();
    },
    client: guardedClient,
  });
  assert.deepEqual(guardedClient.calls[0], ["build", { recipient, lamports: 500000, feePayer, cluster: "devnet" }]);
});

test("stops non-finite USD input before Compass", async () => {
  for (const amountUsdPolicyInput of ["", "fixed policy", "Infinity", "NaN"]) {
    let fetchCalls = 0;
    await expectStop({
      input: inputs({ amountUsdPolicyInput }),
      fetch: async () => { fetchCalls += 1; return allowResponse(); },
      client: client(),
    }, "amountUsd");
    assert.equal(fetchCalls, 0);
  }
});

test("writes redacted stopped evidence for review and deny before exiting", async () => {
  for (const decision of ["review", "deny"]) {
    const evidence = [];
    const guardedClient = client();
    guardedClient.getGenesisHash = async () => DEVNET_GENESIS;
    await expectStop({
      input: inputs({ amountUsdPolicyInput: "0.10" }),
      fetch: async () => jsonResponse({ correlationId: `${decision}-1`, decision, reasons: ["policy"] }),
      client: guardedClient,
      writeProof: async (proof) => evidence.push(proof),
    }, decision);
    assert.deepEqual(evidence, [{
      endpointOrigin: "https://compass.example",
      transfer: { recipient, amountSol: "0.0005", feePayer, cluster: "devnet" },
      decision,
      correlationId: `${decision}-1`,
      reasons: ["policy"],
      stoppedStage: "compass-decision",
    }]);
    assert.deepEqual(guardedClient.calls, []);
  }
});

test("preserves a broadcast signature when writing evidence fails", async () => {
  const guardedClient = client();
  guardedClient.getGenesisHash = async () => DEVNET_GENESIS;
  const result = await runTransfer({
    input: inputs({ amountUsdPolicyInput: "0.10" }),
    fetch: async () => allowResponse(),
    client: guardedClient,
    writeProof: async () => { throw new Error("disk unavailable"); },
  });
  assert.equal(result.signature, "devnet-signature");
  assert.match(result.proofWriteError, /evidence was not saved/);
  assert.deepEqual(guardedClient.calls.slice(-2), ["sign", "send"]);
});

test("writes stopped evidence when pre-sign build RPC work fails", async () => {
  const guardedClient = client();
  guardedClient.buildTransfer = async () => { throw new Error("blockhash RPC unavailable"); };
  const evidence = [];
  await expectStop({
    input: inputs(),
    fetch: async () => allowResponse(),
    client: guardedClient,
    writeProof: async (proof) => evidence.push(proof),
  }, "preflight or RPC failed");
  assert.deepEqual(evidence, [{
    endpointOrigin: "https://compass.example",
    transfer: { recipient, amountSol: "0.0005", feePayer, cluster: "devnet" },
    decision: "allow",
    correlationId: "correlation-1",
    reasons: ["within demo policy"],
    stoppedStage: "pre-sign-rpc",
  }]);
  assert.equal(guardedClient.calls.includes("sign"), false);
  assert.equal(guardedClient.calls.includes("send"), false);
});

test("maps the documented environment names to runner input", () => {
  assert.deepEqual(inputFromEnv({
    CONFIRMED_TRANSFER: "yes",
    TRANSFER_RECIPIENT: recipient,
    DEMO_RECIPIENT_ALLOWLIST: recipient,
    TRANSFER_AMOUNT_SOL: "0.0005",
    AMOUNT_USD_POLICY_INPUT: "0.10",
    FEE_PAYER: feePayer,
    DEMO_SIGNER_PUBLIC_KEY: feePayer,
    SOLANA_CLUSTER: "devnet",
    COMPASS_API_URL: "https://compass.example",
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
    DEMO_KEYPAIR_PATH: "/private/key.json",
  }), inputs({ amountUsdPolicyInput: "0.10", apiKey: undefined, rpcUrl: "https://api.devnet.solana.com", keypairPath: "/private/key.json" }));
});

test("uses one normalized exact-allow record through build, simulation, signing, and send", async () => {
  const guardedClient = client();
  const evidence = [];
  const result = await runTransfer({
    input: inputs(),
    fetch: async (url, options) => {
      assert.equal(url, "https://compass.example/v1/verify");
      assert.deepEqual(JSON.parse(options.body), {
        toolName: "transfer_sol",
        intent: { kind: "transfer" },
        arguments: {
          recipient,
          recipientKnown: true,
          amountUsd: 0.1,
          amountSol: "0.0005",
          lamports: 500000,
          feePayer,
          cluster: "devnet",
        },
      });
      return allowResponse();
    },
    client: guardedClient,
    writeProof: async (proof) => evidence.push(proof),
  });

  assert.equal(result.signature, "devnet-signature");
  assert.deepEqual(guardedClient.calls, [
    ["build", { recipient, lamports: 500000, feePayer, cluster: "devnet" }],
    "simulate",
    "signer",
    "sign",
    "send",
  ]);
  assert.deepEqual(evidence[0], {
    endpointOrigin: "https://compass.example",
    transfer: { recipient, amountSol: "0.0005", feePayer, cluster: "devnet" },
    decision: "allow",
    correlationId: "correlation-1",
    reasons: ["within demo policy"],
    simulation: "passed",
    signature: "devnet-signature",
  });
});

test("proof allowlists public fields and excludes secrets, paths, headers, accounts, and prompts", async () => {
  const proof = await runTransfer({
    input: inputs({ apiKey: "secret", keypairPath: "/private/key.json", prompt: "private prompt" }),
    fetch: async () => allowResponse(),
    client: client(),
  });
  const serialized = JSON.stringify(proof.evidence);
  for (const secret of ["secret", "/private/key.json", "private prompt", "authorization", "accountData"]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(proof.evidence.signature, "devnet-signature");
});

function jsonResponse(body) {
  return { ok: true, status: 200, async json() { return body; } };
}

function allowResponse() {
  return jsonResponse({
    correlationId: "correlation-1",
    decision: "allow",
    reasons: ["within demo policy"],
  });
}

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
