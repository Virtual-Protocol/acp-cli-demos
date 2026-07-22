import { createPublicClient, defineChain, encodeFunctionData, http, keccak256, parseAbi, parseEventLogs, toBytes } from "viem";
import { devSimulatedReceipt, isDevSimulationEnabled } from "./dev-simulation";
import { env } from "./env";

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
]);
const registryAbi = parseAbi([
  "function quoteVideo(address account) view returns (uint256 amount, bool eligible, uint64 version)",
  "function quoteInfographic() view returns (uint256 amount, uint64 version)",
  "function nexThreshold() view returns (uint256)",
  "function videoPrice() view returns (uint256)",
  "function discountedVideoPrice() view returns (uint256)",
  "function infographicPrice() view returns (uint256)"
]);
export const paymentsAbi = parseAbi([
  "function pay(bytes32 productionId, uint8 kind, uint256 expectedAmount, uint64 expectedConfigVersion)",
  "function settle(bytes32 productionId)",
  "function refund(bytes32 productionId, bytes32 reasonHash)",
  "event ProductionPaid(bytes32 indexed productionId, address indexed payer, uint8 kind, uint256 amount, bool nexEligible, uint64 configVersion)",
  "event ProductionSettled(bytes32 indexed productionId, uint256 amount, address indexed treasury)",
  "event ProductionRefunded(bytes32 indexed productionId, uint256 amount, address indexed payer, bytes32 reasonHash)"
]);
export const workEscrowAbi = parseAbi([
  "function fundListing(bytes32 listingId, uint256 amountPerPlace, uint32 places)",
  "function assignFromListing(bytes32 listingId, bytes32 workroomId, address worker, bool autoRelease)",
  "function refundListing(bytes32 listingId)",
  "function submitDelivery(bytes32 workroomId, bytes32 deliveryHash, uint64 reviewSeconds)",
  "function requestRevision(bytes32 workroomId, bytes32 requestHash)",
  "function approve(bytes32 workroomId)",
  "function release(bytes32 workroomId)",
  "function openDispute(bytes32 workroomId, bytes32 reasonHash)",
  "function resolveDispute(bytes32 workroomId, uint256 founderAmount, uint256 workerGrossAmount)",
  "event DeliverySubmitted(bytes32 indexed workroomId, bytes32 indexed deliveryHash, uint64 reviewDeadline)",
  "event RevisionRequested(bytes32 indexed workroomId, bytes32 indexed requestHash, uint32 revisionCount)",
  "event DeliveryApproved(bytes32 indexed workroomId)",
  "event PaymentReleased(bytes32 indexed workroomId, uint256 workerAmount, uint256 feeAmount)",
  "event DisputeOpened(bytes32 indexed workroomId, bytes32 indexed reasonHash)"
  ,"event DisputeResolved(bytes32 indexed workroomId, uint256 founderAmount, uint256 workerAmount, uint256 feeAmount)"
  ,"event ListingFunded(bytes32 indexed listingId, address indexed founder, uint256 amountPerPlace, uint32 places, uint256 totalAmount)"
  ,"event ListingAllocated(bytes32 indexed listingId, bytes32 indexed workroomId, address indexed worker, uint256 amount, uint256 remaining)"
  ,"event ListingRefunded(bytes32 indexed listingId, address indexed founder, uint256 amount)"
]);

export function chainReady() {
  return Boolean(env.robinhoodRpcUrl && env.usdcAddress && env.nexTokenAddress && env.pricingRegistryAddress && env.productionPaymentsAddress);
}

export function publicClient() {
  if (!env.robinhoodRpcUrl) throw new Error("Robinhood Chain RPC is not configured.");
  const chain = defineChain({
    id: env.robinhoodChainId,
    name: env.robinhoodNetwork === "mainnet" ? "Robinhood Chain" : "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env.robinhoodRpcUrl] } }
  });
  return createPublicClient({ chain, transport: http(env.robinhoodRpcUrl) });
}

export async function walletSnapshot(address: `0x${string}`) {
  if (isDevSimulationEnabled()) {
    return {
      configured: true,
      chainId: env.robinhoodChainId || 46630,
      address,
      usdcAtomic: 1_000_000n * 10n ** 6n,
      nexAtomic: 1_000_000_000n,
      nativeAtomic: 1_000_000_000n
    };
  }
  if (!chainReady()) return { configured: false, chainId: env.robinhoodChainId, address, usdcAtomic: null, nexAtomic: null, nativeAtomic: null };
  const client = publicClient();
  const [usdcAtomic, nexAtomic, nativeAtomic] = await Promise.all([
    client.readContract({ address: env.usdcAddress!, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: env.nexTokenAddress!, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.getBalance({ address })
  ]);
  return { configured: true, chainId: env.robinhoodChainId, address, usdcAtomic, nexAtomic, nativeAtomic };
}

export async function productionChainQuote(address: `0x${string}`, kind: "VIDEO" | "INFOGRAPHIC") {
  if (isDevSimulationEnabled()) {
    const threshold = 500_000_000n;
    const standard = kind === "VIDEO" ? 5n * 10n ** 6n : 100_000n;
    const amount = kind === "VIDEO" ? 4n * 10n ** 6n : standard;
    return {
      configured: true,
      chainId: env.robinhoodChainId || 46630,
      address,
      usdcAtomic: 1_000_000n * 10n ** 6n,
      nexAtomic: 1_000_000_000n,
      nativeAtomic: 1_000_000_000n,
      amount,
      standard,
      eligible: kind === "VIDEO",
      version: 1n,
      threshold
    };
  }
  if (!chainReady()) throw new Error("Robinhood Chain pricing contracts are not configured.");
  const client = publicClient();
  const snapshot = await walletSnapshot(address);
  if (kind === "VIDEO") {
    const [amount, eligible, version] = await client.readContract({
      address: env.pricingRegistryAddress!, abi: registryAbi, functionName: "quoteVideo", args: [address]
    });
    const [threshold, standard] = await Promise.all([
      client.readContract({ address: env.pricingRegistryAddress!, abi: registryAbi, functionName: "nexThreshold" }),
      client.readContract({ address: env.pricingRegistryAddress!, abi: registryAbi, functionName: "videoPrice" })
    ]);
    return { ...snapshot, amount, standard, eligible, version, threshold };
  }
  const [amount, version] = await client.readContract({
    address: env.pricingRegistryAddress!, abi: registryAbi, functionName: "quoteInfographic"
  });
  const threshold = await client.readContract({ address: env.pricingRegistryAddress!, abi: registryAbi, functionName: "nexThreshold" });
  return { ...snapshot, amount, standard: amount, eligible: false, version, threshold };
}

export async function verifiedProductionPayment(txHash: `0x${string}`, productionId: string, payer: `0x${string}`, amount: bigint) {
  if (isDevSimulationEnabled()) {
    return {
      receipt: devSimulatedReceipt(),
      event: { logIndex: 0, args: { productionId: opaqueProductionId(productionId), amount, payer } }
    };
  }
  if (!env.productionPaymentsAddress) throw new Error("Production payment contract is not configured.");
  const client = publicClient();
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.productionPaymentsAddress.toLowerCase()) {
    throw new Error("The transaction did not succeed at the configured production payment contract.");
  }
  const logs = parseEventLogs({ abi: paymentsAbi, eventName: "ProductionPaid", logs: receipt.logs });
  const event = logs.find((log) =>
    log.args.productionId === opaqueProductionId(productionId) &&
    log.args.payer?.toLowerCase() === payer.toLowerCase() &&
    log.args.amount === amount
  );
  if (!event) throw new Error("The confirmed transaction does not contain the expected ProductionPaid event.");
  return { receipt, event };
}

export function productionOperatorCall(productionId: string, action: "settle" | "refund", reasonHash?: `0x${string}`) {
  if (!env.productionPaymentsAddress) throw new Error("NEX_PRODUCTION_PAYMENTS_ADDRESS is not configured.");
  const data = action === "settle"
    ? encodeFunctionData({ abi: paymentsAbi, functionName: "settle", args: [opaqueProductionId(productionId)] })
    : encodeFunctionData({ abi: paymentsAbi, functionName: "refund", args: [opaqueProductionId(productionId), reasonHash!] });
  return { to: env.productionPaymentsAddress, data, value: "0x0" };
}

export async function verifiedProductionOperatorEvent(input: { txHash: `0x${string}`; productionId: string; action: "settle" | "refund"; amount: bigint; payer?: `0x${string}`; reasonHash?: `0x${string}`; operator: `0x${string}` }) {
  if (!env.productionPaymentsAddress) throw new Error("NEX_PRODUCTION_PAYMENTS_ADDRESS is not configured.");
  const receipt = await publicClient().waitForTransactionReceipt({ hash: input.txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.productionPaymentsAddress.toLowerCase()) throw new Error("The transaction did not succeed at the configured production payment contract.");
  if (receipt.from.toLowerCase() !== input.operator.toLowerCase()) throw new Error("The production payment action was submitted by a different wallet than the configured operator.");
  if (input.action === "settle") {
    const event = parseEventLogs({ abi: paymentsAbi, eventName: "ProductionSettled", logs: receipt.logs }).find((log) => log.args.productionId === opaqueProductionId(input.productionId) && log.args.amount === input.amount);
    if (!event) throw new Error("The confirmed transaction does not contain the expected ProductionSettled event.");
    return { receipt, event };
  }
  const event = parseEventLogs({ abi: paymentsAbi, eventName: "ProductionRefunded", logs: receipt.logs }).find((log) => log.args.productionId === opaqueProductionId(input.productionId) && log.args.amount === input.amount && log.args.payer?.toLowerCase() === input.payer?.toLowerCase() && log.args.reasonHash === input.reasonHash);
  if (!event) throw new Error("The confirmed transaction does not contain the expected ProductionRefunded event.");
  return { receipt, event };
}

export function opaqueProductionId(id: string) {
  return keccak256(toBytes(`NEX:PRODUCTION:${id}`));
}

export function opaqueWorkroomId(id: string) {
  return keccak256(toBytes(`NEX:WORKROOM:${id}`));
}

export function opaqueListingId(id: string) {
  return keccak256(toBytes(`NEX:LISTING:${id}`));
}

export function listingFundingCalls(id: string, amountPerPlace: bigint, places: number) {
  if (!env.usdcAddress || !env.workEscrowAddress) throw new Error("USDC and the Work escrow contract must be configured.");
  const total = amountPerPlace * BigInt(places);
  return {
    approval: { to: env.usdcAddress, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [env.workEscrowAddress, total] }), value: "0x0" },
    funding: { to: env.workEscrowAddress, data: encodeFunctionData({ abi: workEscrowAbi, functionName: "fundListing", args: [opaqueListingId(id), amountPerPlace, places] }), value: "0x0" }
  };
}

export async function verifiedListingFunding(txHash: `0x${string}`, id: string, founder: `0x${string}`, amountPerPlace: bigint, places: number) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.workEscrowAddress.toLowerCase()) throw new Error("The transaction did not succeed at the configured Work escrow contract.");
  const logs = parseEventLogs({ abi: workEscrowAbi, eventName: "ListingFunded", logs: receipt.logs });
  const event = logs.find((log) => log.args.listingId === opaqueListingId(id)
    && log.args.founder?.toLowerCase() === founder.toLowerCase()
    && log.args.amountPerPlace === amountPerPlace
    && Number(log.args.places) === places
    && log.args.totalAmount === amountPerPlace * BigInt(places));
  if (!event) throw new Error("The confirmed transaction does not contain the expected ListingFunded event.");
  return { receipt, event };
}

export function listingAssignmentCall(listingId: string, workroomId: string, worker: `0x${string}`, autoRelease = false) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  return { to: env.workEscrowAddress, data: encodeFunctionData({ abi: workEscrowAbi, functionName: "assignFromListing", args: [opaqueListingId(listingId), opaqueWorkroomId(workroomId), worker, autoRelease] }), value: "0x0" };
}

export function listingRefundCall(listingId: string) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  return { to: env.workEscrowAddress, data: encodeFunctionData({ abi: workEscrowAbi, functionName: "refundListing", args: [opaqueListingId(listingId)] }), value: "0x0" };
}

export async function verifiedListingRefund(txHash: `0x${string}`, listingId: string, founder: `0x${string}`, expectedAmount: bigint) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.workEscrowAddress.toLowerCase()) throw new Error("The transaction did not succeed at the configured Work escrow contract.");
  if (receipt.from.toLowerCase() !== founder.toLowerCase()) throw new Error("The Listing refund was submitted by a different wallet than its verified founder wallet.");
  const logs = parseEventLogs({ abi: workEscrowAbi, eventName: "ListingRefunded", logs: receipt.logs });
  const event = logs.find((log) => log.args.listingId === opaqueListingId(listingId)
    && log.args.founder?.toLowerCase() === founder.toLowerCase()
    && log.args.amount === expectedAmount);
  if (!event) throw new Error("The confirmed transaction does not contain the expected ListingRefunded event.");
  return { receipt, event };
}

export async function verifiedListingAssignment(txHash: `0x${string}`, listingId: string, workroomId: string, founder: `0x${string}`, worker: `0x${string}`, amount: bigint) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.workEscrowAddress.toLowerCase()) throw new Error("The transaction did not succeed at the configured Work escrow contract.");
  if (receipt.from.toLowerCase() !== founder.toLowerCase()) throw new Error("The Listing was assigned by a different wallet than its verified founder wallet.");
  const logs = parseEventLogs({ abi: workEscrowAbi, eventName: "ListingAllocated", logs: receipt.logs });
  const event = logs.find((log) => log.args.listingId === opaqueListingId(listingId)
    && log.args.workroomId === opaqueWorkroomId(workroomId)
    && log.args.worker?.toLowerCase() === worker.toLowerCase()
    && log.args.amount === amount);
  if (!event) throw new Error("The confirmed transaction does not contain the expected ListingAllocated event.");
  return { receipt, event };
}

export function workroomActionCall(id: string, action: "delivery" | "revision" | "approve" | "release" | "dispute", hash?: `0x${string}`) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  const workroomId = opaqueWorkroomId(id);
  const data = action === "delivery"
    ? encodeFunctionData({ abi: workEscrowAbi, functionName: "submitDelivery", args: [workroomId, hash!, 48n * 60n * 60n] })
    : action === "revision"
      ? encodeFunctionData({ abi: workEscrowAbi, functionName: "requestRevision", args: [workroomId, hash!] })
      : action === "approve"
        ? encodeFunctionData({ abi: workEscrowAbi, functionName: "approve", args: [workroomId] })
        : action === "release"
          ? encodeFunctionData({ abi: workEscrowAbi, functionName: "release", args: [workroomId] })
          : encodeFunctionData({ abi: workEscrowAbi, functionName: "openDispute", args: [workroomId, hash!] });
  return { to: env.workEscrowAddress, data, value: "0x0" };
}

export async function verifiedWorkroomEvent(txHash: `0x${string}`, id: string, eventName: "DeliverySubmitted" | "RevisionRequested" | "DeliveryApproved" | "PaymentReleased" | "DisputeOpened", expectedHash?: `0x${string}`) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  const client = publicClient();
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.workEscrowAddress.toLowerCase()) throw new Error("The transaction did not succeed at the configured Workroom escrow contract.");
  const logs = parseEventLogs({ abi: workEscrowAbi, eventName, logs: receipt.logs });
  const workroomId = opaqueWorkroomId(id);
  const event = logs.find((log) => {
    if (log.args.workroomId !== workroomId) return false;
    if (!expectedHash) return true;
    return ("deliveryHash" in log.args && log.args.deliveryHash === expectedHash) || ("requestHash" in log.args && log.args.requestHash === expectedHash) || ("reasonHash" in log.args && log.args.reasonHash === expectedHash);
  });
  if (!event) throw new Error(`The confirmed transaction does not contain the expected ${eventName} event.`);
  return { receipt, event };
}

export function disputeResolutionCall(id: string, founderAmount: bigint, workerGrossAmount: bigint) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  return { to: env.workEscrowAddress, data: encodeFunctionData({ abi: workEscrowAbi, functionName: "resolveDispute", args: [opaqueWorkroomId(id), founderAmount, workerGrossAmount] }), value: "0x0" };
}

export async function verifiedDisputeResolution(txHash: `0x${string}`, id: string, founderAmount: bigint, workerGrossAmount: bigint, resolver: `0x${string}`) {
  if (!env.workEscrowAddress) throw new Error("NEX_WORK_ESCROW_ADDRESS is not configured.");
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, confirmations: env.robinhoodConfirmations, timeout: 90_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== env.workEscrowAddress.toLowerCase()) throw new Error("The transaction did not succeed at the configured Workroom escrow contract.");
  if (receipt.from.toLowerCase() !== resolver.toLowerCase()) throw new Error("The dispute resolution was submitted by a different wallet than the configured resolver.");
  const logs = parseEventLogs({ abi: workEscrowAbi, eventName: "DisputeResolved", logs: receipt.logs });
  const event = logs.find((log) => log.args.workroomId === opaqueWorkroomId(id)
    && log.args.founderAmount === founderAmount
    && (log.args.workerAmount ?? 0n) + (log.args.feeAmount ?? 0n) === workerGrossAmount);
  if (!event) throw new Error("The confirmed transaction does not contain the expected DisputeResolved split.");
  return { receipt, event };
}

export function productionPaymentCalls(productionId: string, kind: "VIDEO" | "INFOGRAPHIC", amount: bigint, version: bigint) {
  if (isDevSimulationEnabled()) {
    return {
      approval: { to: "0x0000000000000000000000000000000000000001" as `0x${string}`, data: "0x" as `0x${string}`, value: "0x0" },
      payment: { to: "0x0000000000000000000000000000000000000002" as `0x${string}`, data: "0x" as `0x${string}`, value: "0x0" }
    };
  }
  if (!env.usdcAddress || !env.productionPaymentsAddress) throw new Error("Production payment contracts are not configured.");
  return {
    approval: {
      to: env.usdcAddress,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [env.productionPaymentsAddress, amount] }),
      value: "0x0"
    },
    payment: {
      to: env.productionPaymentsAddress,
      data: encodeFunctionData({
        abi: paymentsAbi,
        functionName: "pay",
        args: [opaqueProductionId(productionId), kind === "VIDEO" ? 0 : 1, amount, version]
      }),
      value: "0x0"
    }
  };
}
