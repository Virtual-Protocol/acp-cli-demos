#!/usr/bin/env node
/**
 * Offline self-check — no network, no credentials.
 * Proves the migration helpers behave as documented.
 */
import assert from "node:assert/strict";
import {
  PHASE_TO_EVENT,
  ACTION_TABLE,
  INIT_TABLE,
  lookupPhase,
} from "../examples/phase-event-map.mjs";
import {
  mapEntryToAction,
  budgetPlan,
  buildProviderHandler,
} from "../examples/v3-provider.mjs";
import {
  assertExactFundAmount,
  buildClientHandler,
  clientMigration,
} from "../examples/v3-client.mjs";
import { legacyProviderShape } from "../examples/v2-provider.legacy.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check("phase map covers REQUEST→job.created", () => {
  const row = lookupPhase("REQUEST");
  assert.equal(row.v3Event, "job.created");
  assert.equal(row.nextActor, "Provider");
});

check("phase map covers EVALUATION→job.submitted", () => {
  assert.equal(lookupPhase("EVALUATION").v3Event, "job.submitted");
});

check("all six lifecycle rows present", () => {
  assert.equal(PHASE_TO_EVENT.length, 6);
  assert.equal(ACTION_TABLE.length, 5);
  assert.ok(INIT_TABLE.length >= 4);
});

check("mapEntryToAction routes job.funded to provider submit path", () => {
  const r = mapEntryToAction({ kind: "system", event: { type: "job.funded" } });
  assert.match(r.detail, /submit/i);
});

check("mapEntryToAction ignores non-system entries", () => {
  const r = mapEntryToAction({ kind: "message", event: { type: "job.created" } });
  assert.equal(r.action, "ignore");
});

check("budgetPlan validates inputs", () => {
  const plan = budgetPlan(5, 8453);
  assert.equal(plan.chainId, 8453);
  assert.match(plan.example, /AssetToken\.usdc\(5, 8453\)/);
  assert.throws(() => budgetPlan(0, 8453));
});

check("provider handler setBudget then submit", async () => {
  const calls = [];
  const session = {
    async setBudget(v) {
      calls.push(["setBudget", v]);
    },
    async submit(v) {
      calls.push(["submit", v]);
    },
  };
  // Avoid live AssetToken import by not attaching real setBudget path with module —
  // handler imports AssetToken only if session.setBudget exists. Stub keeps shape.
  // We intercept by deleting setBudget for created, testing map only... better:
  const handler = buildProviderHandler({
    offeringPriceUsdc: 5,
    chainId: 8453,
    deliver: "demo-deliverable",
  });
  // For job.created the handler tries dynamic import of SDK if setBudget exists.
  // Use a session without setBudget to stay offline, assert plan shape via map.
  const created = await handler({}, { kind: "system", event: { type: "job.created" } });
  assert.equal(created.step, "setBudget");
  assert.equal(created.plan.amountUsdc, 5);

  const funded = await handler(session, { kind: "system", event: { type: "job.funded" } });
  assert.equal(funded.step, "submit");
  assert.equal(funded.deliverable, "demo-deliverable");
  assert.deepEqual(calls[0], ["submit", "demo-deliverable"]);
});

check("client exact fund amount guard", () => {
  assert.equal(assertExactFundAmount(0.11, 0.11), true);
  assert.throws(() => assertExactFundAmount(0.11, 0.12));
});

check("client handler returns fund instruction on budget.set", async () => {
  const handler = buildClientHandler();
  const r = await handler(
    { chainId: 8453 },
    { kind: "system", event: { type: "budget.set", amount: 0.11 } },
  );
  assert.equal(r.action, "fund");
  assert.equal(r.amount, 0.11);
});

check("legacy shape documents retired callbacks", () => {
  assert.ok(legacyProviderShape.callbacks.onNewTask.length >= 2);
  assert.ok(legacyProviderShape.callbacks.onEvaluate.length >= 1);
  assert.match(clientMigration.createJob.v3, /createJobFromOffering/);
});

console.log(`\n${passed} checks passed`);
