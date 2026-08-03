/**
 * Tasmil's self-computed Aave "risk brain" — reads health factor + position DIRECTLY from Aave v3
 * on Base via RPC. Free, deterministic, no third-party ACP agent. This is what the design doc §11
 * recommends instead of the (broken/unresponsive) hf_check agents.
 *
 * Usage: node aave-hf.mjs <wallet> [<wallet> ...]
 */
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"; // Aave v3 Base Pool

const abi = [{
  type: "function", name: "getUserAccountData", stateMutability: "view",
  inputs: [{ name: "user", type: "address" }],
  outputs: [
    { name: "totalCollateralBase", type: "uint256" },
    { name: "totalDebtBase", type: "uint256" },
    { name: "availableBorrowsBase", type: "uint256" },
    { name: "currentLiquidationThreshold", type: "uint256" },
    { name: "ltv", type: "uint256" },
    { name: "healthFactor", type: "uint256" },
  ],
}];

const MAX = 2n ** 256n - 1n;
const wallets = process.argv.slice(2);
if (!wallets.length) { console.error("pass one or more wallet addresses"); process.exit(1); }

function verdict(hf) {
  if (hf === Infinity) return "no debt";
  if (hf < 1.05) return "🔴 LIQUIDATION IMMINENT";
  if (hf < 1.2) return "🟠 AT RISK";
  if (hf < 1.5) return "🟡 watch";
  return "🟢 safe";
}

for (const user of wallets) {
  try {
    const d = await client.readContract({ address: POOL, abi, functionName: "getUserAccountData", args: [user] });
    const coll = Number(formatUnits(d[0], 8));
    const debt = Number(formatUnits(d[1], 8));
    const avail = Number(formatUnits(d[2], 8));
    const liqThr = Number(d[3]) / 100;   // bps -> %
    const ltv = Number(d[4]) / 100;      // bps -> %
    const hf = d[5] === MAX ? Infinity : Number(formatUnits(d[5], 18));
    // price drop until liquidation:  drop% = 1 - (debt / (coll * liqThr))
    const dropPct = debt > 0 ? Math.max(0, (1 - debt / (coll * liqThr / 100)) * 100) : 100;
    console.log(`\n${user}`);
    console.log(`  Health factor : ${hf === Infinity ? "∞" : hf.toFixed(3)}   ${verdict(hf)}`);
    console.log(`  Collateral    : $${coll.toFixed(2)}`);
    console.log(`  Debt          : $${debt.toFixed(2)}`);
    console.log(`  Available borrow: $${avail.toFixed(2)}`);
    console.log(`  LTV / LiqThr  : ${ltv.toFixed(1)}% / ${liqThr.toFixed(1)}%`);
    console.log(`  Price drop to liquidation: ${dropPct.toFixed(1)}%`);
  } catch (e) {
    console.log(`\n${user}\n  error: ${e.shortMessage || e.message}`);
  }
}
