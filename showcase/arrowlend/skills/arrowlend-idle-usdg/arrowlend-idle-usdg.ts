/**
 * ArrowLend Idle USDG — reusable agent treasury loop.
 *
 * Watches an agent's USDG balance on Robinhood Chain, supplies the excess above
 * a reserve into the ArrowLend pool to earn borrow-sourced yield (aUSDG), and
 * withdraws automatically when the agent needs liquidity for payments.
 *
 * Supply/earn is the side that is live today. No private keys are hardcoded —
 * pass a viem WalletClient created from the Agent Wallet signer.
 */

import {
  createPublicClient,
  http,
  getContract,
  type Address,
  type WalletClient,
  type PublicClient,
} from "viem";

// --- Robinhood Chain mainnet ---
export const ROBINHOOD_CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
} as const;

export const POOL: Address = "0x562ac0d6d140b6e285ACbe2ad642C8c32E1D7dA6";
export const USDG: Address = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const POOL_ABI = [
  { type: "function", name: "supply", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "shares", type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "shares", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalDebt", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

export interface IdleUsdgConfig {
  /** Supply once wallet USDG rises above this (6 decimals). */
  depositThreshold: bigint;
  /** Always keep at least this much USDG liquid in the wallet (6 decimals). */
  reserveMinimum: bigint;
  /** Withdraw once wallet USDG falls below this (6 decimals). */
  withdrawTrigger: bigint;
}

export interface IdleUsdgResult {
  action: "supplied" | "withdrew" | "hold";
  txHash?: `0x${string}`;
  position: { shares: bigint; value: bigint; walletUsdg: bigint };
}

function publicClient(): PublicClient {
  return createPublicClient({ chain: ROBINHOOD_CHAIN as any, transport: http() });
}

/** Read the agent's wallet USDG and pool position. */
export async function readPosition(agent: Address) {
  const pc = publicClient();
  const usdg = getContract({ address: USDG, abi: ERC20_ABI, client: pc });
  const pool = getContract({ address: POOL, abi: POOL_ABI, client: pc });

  const [walletUsdg, shares] = await Promise.all([
    usdg.read.balanceOf([agent]),
    pool.read.balanceOf([agent]),
  ]);
  const value = shares > 0n ? await pool.read.convertToAssets([shares]) : 0n;
  return { shares, value, walletUsdg };
}

/**
 * Run one tick of the idle-USDG loop. Caller supplies a viem WalletClient whose
 * account is the Agent Wallet. Returns the action taken plus the fresh position.
 */
export async function runOnce(
  wallet: WalletClient,
  cfg: IdleUsdgConfig,
): Promise<IdleUsdgResult> {
  const agent = wallet.account?.address as Address;
  if (!agent) throw new Error("wallet.account is required");

  const pc = publicClient();
  const pool = getContract({ address: POOL, abi: POOL_ABI, client: pc });

  if (await pool.read.paused()) {
    return { action: "hold", position: await readPosition(agent) };
  }

  const pos = await readPosition(agent);

  // Supply excess above the reserve.
  if (pos.walletUsdg > cfg.depositThreshold) {
    const amount = pos.walletUsdg - cfg.reserveMinimum;
    if (amount > 0n) {
      const allowance = (await pc.readContract({
        address: USDG, abi: ERC20_ABI, functionName: "allowance", args: [agent, POOL],
      })) as bigint;
      if (allowance < amount) {
        const approveHash = await wallet.writeContract({
          address: USDG, abi: ERC20_ABI, functionName: "approve", args: [POOL, amount],
          account: wallet.account!, chain: ROBINHOOD_CHAIN as any,
        });
        await pc.waitForTransactionReceipt({ hash: approveHash });
      }
      const txHash = await wallet.writeContract({
        address: POOL, abi: POOL_ABI, functionName: "supply", args: [amount, agent],
        account: wallet.account!, chain: ROBINHOOD_CHAIN as any,
      });
      await pc.waitForTransactionReceipt({ hash: txHash });
      return { action: "supplied", txHash, position: await readPosition(agent) };
    }
  }

  // Withdraw to refill the wallet when it runs low.
  if (pos.walletUsdg < cfg.withdrawTrigger && pos.shares > 0n) {
    const need = cfg.withdrawTrigger - pos.walletUsdg;
    const [totalAssets, totalDebt] = await Promise.all([
      pool.read.totalAssets(),
      pool.read.totalDebt(),
    ]);
    const available = totalAssets - totalDebt;
    const amount = need < pos.value ? need : pos.value;
    if (amount > available) {
      // Not enough liquidity right now; hold and retry next tick.
      return { action: "hold", position: pos };
    }
    const txHash = await wallet.writeContract({
      address: POOL, abi: POOL_ABI, functionName: "withdraw", args: [amount, agent],
      account: wallet.account!, chain: ROBINHOOD_CHAIN as any,
    });
    await pc.waitForTransactionReceipt({ hash: txHash });
    return { action: "withdrew", txHash, position: await readPosition(agent) };
  }

  return { action: "hold", position: pos };
}
