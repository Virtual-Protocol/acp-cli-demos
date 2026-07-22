import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keccak256, toBytes } from "viem";
import { network } from "hardhat";

describe("NexMarkets economic contracts", async function () {
  const { viem } = await network.create();

  async function deployFixture() {
    const [admin, payer, treasury, worker, resolver] = await viem.getWalletClients();
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const nex = await viem.deployContract("MockERC20", ["NEX", "NEX", 18]);
    const registry = await viem.deployContract("NexPricingRegistry", [
      admin.account.address,
      admin.account.address
    ]);
    await registry.write.configure([
      usdc.address,
      nex.address,
      treasury.account.address,
      5_000_000n,
      4_000_000n,
      100_000n,
      50_000n * 10n ** 18n
    ]);
    const payments = await viem.deployContract("NexProductionPayments", [
      admin.account.address,
      admin.account.address,
      registry.address
    ]);
    const workEscrow = await viem.deployContract("NexWorkEscrow", [
      admin.account.address,
      admin.account.address,
      resolver.account.address,
      usdc.address,
      treasury.account.address,
      250
    ]);
    return { admin, payer, treasury, worker, resolver, usdc, nex, registry, payments, workEscrow };
  }

  it("enforces the exact NEX discount boundary and one payment per opaque id", async function () {
    const { payer, usdc, nex, registry, payments } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, {
      client: { wallet: payer }
    });
    const paymentsAsPayer = await viem.getContractAt("NexProductionPayments", payments.address, {
      client: { wallet: payer }
    });

    await usdc.write.mint([payer.account.address, 20_000_000n]);
    let quote = await registry.read.quoteVideo([payer.account.address]);
    assert.equal(quote[0], 5_000_000n);
    assert.equal(quote[1], false);

    await nex.write.mint([payer.account.address, 50_000n * 10n ** 18n]);
    quote = await registry.read.quoteVideo([payer.account.address]);
    assert.equal(quote[0], 4_000_000n);
    assert.equal(quote[1], true);

    await usdcAsPayer.write.approve([payments.address, quote[0]]);
    const productionId = keccak256(toBytes("NEX:PRODUCTION:fixture-1"));
    await paymentsAsPayer.write.pay([productionId, 0, quote[0], quote[2]]);
    const payment = await payments.read.payments([productionId]);
    assert.equal(payment[0].toLowerCase(), payer.account.address.toLowerCase());
    assert.equal(payment[1], 4_000_000n);
    assert.equal(payment[5], 1);

    await assert.rejects(
      paymentsAsPayer.write.pay([productionId, 0, quote[0], quote[2]])
    );
  });

  it("quotes an infographic at exactly 0.10 USDC regardless of NEX", async function () {
    const { registry } = await deployFixture();
    const quote = await registry.read.quoteInfographic();
    assert.equal(quote[0], 100_000n);
    assert.equal(quote[1], 1n);
  });

  it("caps the platform fee at ten percent", async function () {
    const { admin, resolver, treasury, usdc, worker } = await deployFixture();
    await assert.rejects(
      viem.deployContract("NexWorkEscrow", [
        admin.account.address,
        admin.account.address,
        resolver.account.address,
        usdc.address,
        treasury.account.address,
        1001
      ], { client: { wallet: worker } })
    );
  });

  it("funds a Listing reserve and moves one place into an active Workroom", async function () {
    const { payer, worker, usdc, workEscrow } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, { client: { wallet: payer } });
    const escrowAsPayer = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: payer } });
    const listingId = keccak256(toBytes("NEX:LISTING:fixture-listing"));
    const workroomId = keccak256(toBytes("NEX:WORKROOM:fixture-room"));
    await usdc.write.mint([payer.account.address, 4_000_000n]);
    await usdcAsPayer.write.approve([workEscrow.address, 4_000_000n]);
    await escrowAsPayer.write.fundListing([listingId, 2_000_000n, 2]);
    const reserve = await workEscrow.read.listingReserves([listingId]);
    assert.equal(reserve[2], 4_000_000n);
    assert.equal(reserve[3], 2);
    await escrowAsPayer.write.assignFromListing([listingId, workroomId, worker.account.address, false]);
    const assigned = await workEscrow.read.escrows([workroomId]);
    assert.equal(assigned[0].toLowerCase(), payer.account.address.toLowerCase());
    assert.equal(assigned[1].toLowerCase(), worker.account.address.toLowerCase());
    assert.equal(assigned[2], 2_000_000n);
    assert.equal(assigned[8], 2);
    const after = await workEscrow.read.listingReserves([listingId]);
    assert.equal(after[2], 2_000_000n);
    assert.equal(after[4], 1);
  });

  it("settles an approved production payment to treasury exactly once", async function () {
    const { admin, payer, treasury, usdc, registry, payments } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, { client: { wallet: payer } });
    const paymentsAsPayer = await viem.getContractAt("NexProductionPayments", payments.address, { client: { wallet: payer } });
    const paymentsAsOperator = await viem.getContractAt("NexProductionPayments", payments.address, { client: { wallet: admin } });
    const productionId = keccak256(toBytes("NEX:PRODUCTION:settlement"));
    const quote = await registry.read.quoteInfographic();
    await usdc.write.mint([payer.account.address, quote[0]]);
    await usdcAsPayer.write.approve([payments.address, quote[0]]);
    await paymentsAsPayer.write.pay([productionId, 1, quote[0], quote[1]]);
    await paymentsAsOperator.write.settle([productionId]);
    assert.equal(await usdc.read.balanceOf([treasury.account.address]), quote[0]);
    assert.equal((await payments.read.payments([productionId]))[5], 2);
    await assert.rejects(paymentsAsOperator.write.settle([productionId]));
    await assert.rejects(paymentsAsOperator.write.refund([productionId, keccak256(toBytes("late"))]));
  });

  it("refunds an unsettled production payment to its original payer", async function () {
    const { admin, payer, usdc, registry, payments } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, { client: { wallet: payer } });
    const paymentsAsPayer = await viem.getContractAt("NexProductionPayments", payments.address, { client: { wallet: payer } });
    const paymentsAsOperator = await viem.getContractAt("NexProductionPayments", payments.address, { client: { wallet: admin } });
    const productionId = keccak256(toBytes("NEX:PRODUCTION:refund"));
    const quote = await registry.read.quoteVideo([payer.account.address]);
    await usdc.write.mint([payer.account.address, quote[0]]);
    await usdcAsPayer.write.approve([payments.address, quote[0]]);
    await paymentsAsPayer.write.pay([productionId, 0, quote[0], quote[2]]);
    await paymentsAsOperator.write.refund([productionId, keccak256(toBytes("accepted cancellation"))]);
    assert.equal(await usdc.read.balanceOf([payer.account.address]), quote[0]);
    assert.equal((await payments.read.payments([productionId]))[5], 3);
  });

  it("persists revision, approval and fee-split release through the full Workroom lifecycle", async function () {
    const { payer, worker, treasury, usdc, workEscrow } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, { client: { wallet: payer } });
    const escrowAsPayer = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: payer } });
    const escrowAsWorker = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: worker } });
    const listingId = keccak256(toBytes("NEX:LISTING:lifecycle"));
    const workroomId = keccak256(toBytes("NEX:WORKROOM:lifecycle"));
    await usdc.write.mint([payer.account.address, 2_000_000n]);
    await usdcAsPayer.write.approve([workEscrow.address, 2_000_000n]);
    await escrowAsPayer.write.fundListing([listingId, 2_000_000n, 1]);
    await escrowAsPayer.write.assignFromListing([listingId, workroomId, worker.account.address, false]);
    await escrowAsWorker.write.submitDelivery([workroomId, keccak256(toBytes("version-1")), 86_400n]);
    await escrowAsPayer.write.requestRevision([workroomId, keccak256(toBytes("tighten the opening"))]);
    assert.equal((await workEscrow.read.escrows([workroomId]))[6], 1);
    await escrowAsWorker.write.submitDelivery([workroomId, keccak256(toBytes("version-2")), 86_400n]);
    await escrowAsPayer.write.approve([workroomId]);
    await escrowAsPayer.write.release([workroomId]);
    assert.equal((await workEscrow.read.escrows([workroomId]))[8], 6);
    assert.equal(await usdc.read.balanceOf([worker.account.address]), 1_950_000n);
    assert.equal(await usdc.read.balanceOf([treasury.account.address]), 50_000n);
    await assert.rejects(escrowAsPayer.write.release([workroomId]));
  });

  it("resolves a dispute across founder, worker and fee treasury without leaving escrow", async function () {
    const { payer, worker, resolver, treasury, usdc, workEscrow } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, { client: { wallet: payer } });
    const escrowAsPayer = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: payer } });
    const escrowAsWorker = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: worker } });
    const escrowAsResolver = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: resolver } });
    const listingId = keccak256(toBytes("NEX:LISTING:dispute"));
    const workroomId = keccak256(toBytes("NEX:WORKROOM:dispute"));
    await usdc.write.mint([payer.account.address, 2_000_000n]);
    await usdcAsPayer.write.approve([workEscrow.address, 2_000_000n]);
    await escrowAsPayer.write.fundListing([listingId, 2_000_000n, 1]);
    await escrowAsPayer.write.assignFromListing([listingId, workroomId, worker.account.address, false]);
    await escrowAsWorker.write.openDispute([workroomId, keccak256(toBytes("scope conflict"))]);
    await assert.rejects(escrowAsResolver.write.resolveDispute([workroomId, 500_000n, 1_400_000n]));
    await escrowAsResolver.write.resolveDispute([workroomId, 500_000n, 1_500_000n]);
    assert.equal((await workEscrow.read.escrows([workroomId]))[8], 6);
    assert.equal(await usdc.read.balanceOf([payer.account.address]), 500_000n);
    assert.equal(await usdc.read.balanceOf([worker.account.address]), 1_462_500n);
    assert.equal(await usdc.read.balanceOf([treasury.account.address]), 37_500n);
    assert.equal(await usdc.read.balanceOf([workEscrow.address]), 0n);
  });

  it("returns an unallocated Listing reserve and permanently closes it", async function () {
    const { payer, worker, usdc, workEscrow } = await deployFixture();
    const usdcAsPayer = await viem.getContractAt("MockERC20", usdc.address, { client: { wallet: payer } });
    const escrowAsPayer = await viem.getContractAt("NexWorkEscrow", workEscrow.address, { client: { wallet: payer } });
    const listingId = keccak256(toBytes("NEX:LISTING:partial-refund"));
    await usdc.write.mint([payer.account.address, 4_000_000n]);
    await usdcAsPayer.write.approve([workEscrow.address, 4_000_000n]);
    await escrowAsPayer.write.fundListing([listingId, 2_000_000n, 2]);
    await escrowAsPayer.write.assignFromListing([listingId, keccak256(toBytes("NEX:WORKROOM:one")), worker.account.address, false]);
    await escrowAsPayer.write.refundListing([listingId]);
    const reserve = await workEscrow.read.listingReserves([listingId]);
    assert.equal(reserve[2], 0n);
    assert.equal(reserve[5], true);
    assert.equal(await usdc.read.balanceOf([payer.account.address]), 2_000_000n);
    await assert.rejects(escrowAsPayer.write.assignFromListing([listingId, keccak256(toBytes("NEX:WORKROOM:two")), worker.account.address, false]));
  });
});
