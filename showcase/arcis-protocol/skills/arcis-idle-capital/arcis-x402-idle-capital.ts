/**
 * Arcis Protocol — x402-Aware Idle Capital Manager
 * 
 * Universal module for any AI agent framework.
 * Monitors USDC balance → auto-deposits idle capital into Arcis vault → 
 * auto-withdraws when the agent needs funds for payments.
 * 
 * Works with: ElizaOS, LangChain, CrewAI, OpenClaw, Hermes, Bankr,
 * Virtuals, AutoGPT, Claude Agent SDK, OpenAI Agents, or any custom agent.
 * 
 * Install: npm install viem
 * Usage:  import { createIdleCapitalManager } from "./arcis-x402-idle-capital"
 * 
 * @license MIT
 * @see https://arcis.money
 * @see https://github.com/Arcis-Protocol
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — Base Mainnet
// ═══════════════════════════════════════════════════════════════

export const ARCIS_CONTRACTS = {
  vault: "0x00325d9da832b38179ed2f0dabd4062d93e325a7" as Address,
  credit: "0xdf31800e620f728297340d66acf5a306f07ce7a1" as Address,
  bonds: "0xeb65d8bb08e0ea4a6bb9162d53d1b444f99681ba" as Address,
  identity: "0xaa4da295dd368c0f10128654af76e3f002e20e71" as Address,
  router: "0xd0c64f997ca9aa427f8834578bd7f0313f868e83" as Address,
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
};

// ═══════════════════════════════════════════════════════════════
// ABIs — Minimal required functions
// ═══════════════════════════════════════════════════════════════

const VAULT_ABI = parseAbi([
  "function deposit(uint256 amount) external returns (uint256 shares)",
  "function withdraw(uint256 shares) external returns (uint256 amount)",
  "function balance(address agent) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function exchangeRate() external view returns (uint256)",
  "function previewDeposit(uint256 assets) external view returns (uint256)",
  "function previewRedeem(uint256 shares) external view returns (uint256)",
  "function maxDeposit(address) external view returns (uint256)",
  "function paused() external view returns (bool)",
]);

const USDC_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface IdleCapitalConfig {
  /** Agent's private key (0x...) — OR pass a pre-built Account */
  privateKey?: `0x${string}`;

  /** Pre-built viem Account (alternative to privateKey) */
  account?: Account;

  /** RPC URL — defaults to public Base RPC, use Alchemy/QuickNode for production */
  rpcUrl?: string;

  /** USDC threshold to trigger deposit (in human units, e.g. 100 = $100) */
  depositThreshold?: number;

  /** Minimum USDC to keep in wallet for payments (in human units) */
  reserveMinimum?: number;

  /** How much to deposit when threshold is hit (in human units). 
   *  Defaults to: walletBalance - reserveMinimum */
  depositAmount?: number;

  /** Auto-withdraw when wallet drops below this (in human units) */
  withdrawTrigger?: number;

  /** How much to withdraw when triggered (in human units) */
  withdrawAmount?: number;

  /** Check interval in milliseconds (default: 60000 = 1 minute) */
  intervalMs?: number;

  /** Enable automatic mode (default: true). If false, only manual calls work */
  autoMode?: boolean;

  /** Event callbacks */
  onDeposit?: (amount: bigint, shares: bigint, txHash: string) => void;
  onWithdraw?: (shares: bigint, amount: bigint, txHash: string) => void;
  onError?: (error: Error, action: string) => void;
  onCheck?: (status: BalanceStatus) => void;

  /** Custom chain (default: Base mainnet) */
  chain?: Chain;

  /** Custom vault address (default: Arcis mainnet vault) */
  vaultAddress?: Address;

  /** Custom USDC address (default: Base USDC) */
  usdcAddress?: Address;
}

export interface BalanceStatus {
  walletUsdc: bigint;
  vaultPosition: bigint;
  vaultShares: bigint;
  totalCapital: bigint;
  exchangeRate: bigint;
  vaultPaused: boolean;
  action: "deposit" | "withdraw" | "hold" | "paused";
  timestamp: number;
}

export interface IdleCapitalManager {
  /** Start automatic monitoring */
  start: () => void;

  /** Stop automatic monitoring */
  stop: () => void;

  /** Check balances and return status (no action taken) */
  check: () => Promise<BalanceStatus>;

  /** Manually deposit USDC into vault */
  deposit: (amount: bigint) => Promise<string>;

  /** Manually withdraw shares from vault */
  withdraw: (shares: bigint) => Promise<string>;

  /** Manually withdraw by USDC value */
  withdrawUsdc: (usdcAmount: bigint) => Promise<string>;

  /** Get current position */
  position: () => Promise<{ shares: bigint; value: bigint; walletUsdc: bigint }>;

  /** Whether the manager is actively monitoring */
  isRunning: boolean;

  /** Agent address */
  address: Address;
}

// ═══════════════════════════════════════════════════════════════
// FACTORY — Create an Idle Capital Manager
// ═══════════════════════════════════════════════════════════════

export function createIdleCapitalManager(
  config: IdleCapitalConfig
): IdleCapitalManager {
  // ── Config defaults ──
  const chain = config.chain ?? base;
  const vaultAddr = config.vaultAddress ?? ARCIS_CONTRACTS.vault;
  const usdcAddr = config.usdcAddress ?? ARCIS_CONTRACTS.usdc;
  const rpcUrl = config.rpcUrl ?? "https://mainnet.base.org";
  const intervalMs = config.intervalMs ?? 60_000;
  const autoMode = config.autoMode ?? true;

  // Thresholds in raw USDC units (6 decimals)
  const DECIMALS = 6;
  const toRaw = (n: number) => BigInt(Math.floor(n * 10 ** DECIMALS));

  const depositThreshold = toRaw(config.depositThreshold ?? 100);
  const reserveMinimum = toRaw(config.reserveMinimum ?? 20);
  const withdrawTrigger = toRaw(config.withdrawTrigger ?? 5);
  const withdrawAmount = config.withdrawAmount
    ? toRaw(config.withdrawAmount)
    : toRaw(50);

  // ── Clients ──
  const account =
    config.account ?? privateKeyToAccount(config.privateKey!);

  const publicClient: PublicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient: WalletClient = createWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  });

  const agentAddress = account.address;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  // ── Helpers ──
  const fmt = (raw: bigint) => formatUnits(raw, DECIMALS);

  const log = (msg: string) =>
    console.log(`[ARCIS:IdleCapital] ${msg}`);

  // ── Core: Check balances ──
  async function check(): Promise<BalanceStatus> {
    const [walletUsdc, vaultPosition, vaultShares, exchangeRate, paused] =
      await Promise.all([
        publicClient.readContract({
          address: usdcAddr,
          abi: USDC_ABI,
          functionName: "balanceOf",
          args: [agentAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: "balance",
          args: [agentAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: "balanceOf",
          args: [agentAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: "exchangeRate",
        }) as Promise<bigint>,
        publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: "paused",
        }) as Promise<boolean>,
      ]);

    let action: BalanceStatus["action"] = "hold";

    if (paused) {
      action = "paused";
    } else if (walletUsdc > depositThreshold) {
      action = "deposit";
    } else if (walletUsdc < withdrawTrigger && vaultShares > 0n) {
      action = "withdraw";
    }

    const status: BalanceStatus = {
      walletUsdc,
      vaultPosition,
      vaultShares,
      totalCapital: walletUsdc + vaultPosition,
      exchangeRate,
      vaultPaused: paused,
      action,
      timestamp: Date.now(),
    };

    config.onCheck?.(status);
    return status;
  }

  // ── Core: Deposit ──
  async function deposit(amount: bigint): Promise<string> {
    log(`Depositing $${fmt(amount)} USDC...`);

    // Check allowance
    const allowance = (await publicClient.readContract({
      address: usdcAddr,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [agentAddress, vaultAddr],
    })) as bigint;

    // Approve if needed
    if (allowance < amount) {
      log("Approving USDC...");
      const approveTx = await walletClient.writeContract({
        address: usdcAddr,
        abi: USDC_ABI,
        functionName: "approve",
        args: [vaultAddr, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      log(`Approved: ${approveTx}`);
    }

    // Deposit
    const depositTx = await walletClient.writeContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amount],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: depositTx,
    });

    // Read new share balance to calculate shares received
    const newShares = (await publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [agentAddress],
    })) as bigint;

    log(`Deposited $${fmt(amount)} → ${newShares} shares | tx: ${depositTx}`);
    config.onDeposit?.(amount, newShares, depositTx);

    return depositTx;
  }

  // ── Core: Withdraw by shares ──
  async function withdraw(shares: bigint): Promise<string> {
    log(`Withdrawing ${shares} shares...`);

    const withdrawTx = await walletClient.writeContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [shares],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: withdrawTx,
    });

    const usdcReceived = (await publicClient.readContract({
      address: usdcAddr,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [agentAddress],
    })) as bigint;

    log(`Withdrew ${shares} shares → tx: ${withdrawTx}`);
    config.onWithdraw?.(shares, usdcReceived, withdrawTx);

    return withdrawTx;
  }

  // ── Core: Withdraw by USDC value ──
  async function withdrawUsdc(usdcAmount: bigint): Promise<string> {
    const shares = (await publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "previewDeposit",
      args: [usdcAmount],
    })) as bigint;

    return withdraw(shares > 0n ? shares : 1n);
  }

  // ── Core: Get position ──
  async function position() {
    const [shares, value, walletUsdc] = await Promise.all([
      publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: "balanceOf",
        args: [agentAddress],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: "balance",
        args: [agentAddress],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: usdcAddr,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [agentAddress],
      }) as Promise<bigint>,
    ]);
    return { shares, value, walletUsdc };
  }

  // ── Auto-loop ──
  async function tick() {
    try {
      const status = await check();

      if (status.action === "deposit") {
        const excess = status.walletUsdc - reserveMinimum;
        if (excess > 0n) {
          const depositAmt = config.depositAmount
            ? toRaw(config.depositAmount)
            : excess;
          const actual = depositAmt < excess ? depositAmt : excess;
          await deposit(actual);
        }
      } else if (status.action === "withdraw") {
        const sharesToWithdraw =
          status.vaultShares < withdrawAmount
            ? status.vaultShares
            : withdrawAmount > 0n
            ? (() => {
                // Calculate shares needed for withdrawAmount USDC
                // Simple approximation: shares ≈ withdrawAmount (1:1 with offset)
                return status.vaultShares;
              })()
            : status.vaultShares;
        if (sharesToWithdraw > 0n) {
          await withdraw(sharesToWithdraw);
        }
      } else if (status.action === "paused") {
        log("Vault paused — skipping cycle");
      } else {
        log(
          `Hold — wallet: $${fmt(status.walletUsdc)} | vault: $${fmt(
            status.vaultPosition
          )} | total: $${fmt(status.totalCapital)}`
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log(`Error: ${error.message}`);
      config.onError?.(error, "tick");
    }
  }

  // ── Start/Stop ──
  function start() {
    if (running) return;
    running = true;
    log(
      `Started — agent: ${agentAddress} | deposit above: $${fmt(
        depositThreshold
      )} | reserve: $${fmt(reserveMinimum)} | withdraw below: $${fmt(
        withdrawTrigger
      )} | interval: ${intervalMs / 1000}s`
    );
    tick(); // Run immediately
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
    log("Stopped");
  }

  // Auto-start if configured
  if (autoMode) {
    start();
  }

  return {
    start,
    stop,
    check,
    deposit,
    withdraw,
    withdrawUsdc,
    position,
    get isRunning() {
      return running;
    },
    address: agentAddress,
  };
}

// ═══════════════════════════════════════════════════════════════
// FRAMEWORK EXAMPLES
// ═══════════════════════════════════════════════════════════════

/**
 * ── Example 1: Standalone Agent (any framework) ──
 * 
 * The simplest integration. Your agent earns USDC from x402 payments,
 * and idle capital above $100 auto-deposits into Arcis.
 * 
 * ```ts
 * import { createIdleCapitalManager } from "./arcis-x402-idle-capital";
 * 
 * const manager = createIdleCapitalManager({
 *   privateKey: process.env.AGENT_KEY as `0x${string}`,
 *   rpcUrl: process.env.BASE_RPC_URL,
 *   depositThreshold: 100,   // Deposit when wallet has >$100
 *   reserveMinimum: 20,      // Always keep $20 for gas + payments
 *   withdrawTrigger: 5,      // Withdraw when wallet drops below $5
 *   intervalMs: 60_000,      // Check every minute
 *   onDeposit: (amt, shares, tx) => console.log(`Deposited! tx: ${tx}`),
 *   onWithdraw: (shares, amt, tx) => console.log(`Withdrew! tx: ${tx}`),
 * });
 * 
 * // Later: check position
 * const pos = await manager.position();
 * console.log(`Vault: $${pos.value / 1_000_000n} | Wallet: $${pos.walletUsdc / 1_000_000n}`);
 * 
 * // Manual deposit/withdraw
 * await manager.deposit(50_000_000n);  // $50
 * await manager.withdraw(50n);          // 50 shares
 * 
 * // Shutdown
 * manager.stop();
 * ```
 */

/**
 * ── Example 2: ElizaOS Agent ──
 * 
 * ```ts
 * // In your ElizaOS agent's plugin:
 * import { createIdleCapitalManager } from "./arcis-x402-idle-capital";
 * 
 * export const arcisPlugin = {
 *   name: "arcis-idle-capital",
 *   init: async (agent) => {
 *     const manager = createIdleCapitalManager({
 *       privateKey: agent.config.AGENT_KEY,
 *       rpcUrl: agent.config.BASE_RPC_URL,
 *       depositThreshold: 100,
 *       reserveMinimum: 20,
 *       onDeposit: (amt, shares, tx) => {
 *         agent.log(`Deposited $${Number(amt) / 1e6} into Arcis vault`);
 *       },
 *     });
 *     agent.registerAction("check-vault", () => manager.check());
 *     agent.registerAction("vault-position", () => manager.position());
 *   },
 * };
 * ```
 */

/**
 * ── Example 3: LangChain / LangGraph Agent ──
 * 
 * ```python
 * # Python agents can call the manager via subprocess or HTTP
 * # Option A: Use the Arcis MCP server
 * # Option B: Direct contract calls with web3.py
 * 
 * from web3 import Web3
 * 
 * w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
 * 
 * VAULT = "0x00325d9da832b38179ed2f0dabd4062d93e325a7"
 * USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 * 
 * # Check balance
 * balance = w3.eth.call({"to": VAULT, "data": "0xe3d670d7" + agent_addr[2:].zfill(64)})
 * position_usdc = int(balance.hex(), 16) / 1e6
 * 
 * # Deposit: approve + deposit
 * # approve(vault, amount)
 * # deposit(amount)
 * ```
 */

/**
 * ── Example 4: Virtuals Protocol Agent ──
 * 
 * ```ts
 * // Virtuals agents have their own wallet. Add idle capital management:
 * import { createIdleCapitalManager } from "./arcis-x402-idle-capital";
 * 
 * const manager = createIdleCapitalManager({
 *   privateKey: VIRTUALS_AGENT_KEY,
 *   depositThreshold: 500,    // Higher threshold for revenue-generating agents
 *   reserveMinimum: 100,      // Keep more in reserve for operations
 *   intervalMs: 300_000,      // Check every 5 minutes
 * });
 * ```
 */

/**
 * ── Example 5: OpenAI Agents / Claude Agent SDK ──
 * 
 * ```ts
 * // These frameworks use tool/function calling.
 * // Register Arcis as a tool:
 * 
 * const arcisTools = [
 *   {
 *     name: "arcis_deposit",
 *     description: "Deposit idle USDC into Arcis yield vault (~3.2% APY)",
 *     parameters: { amount: { type: "number", description: "USDC amount" } },
 *     execute: async ({ amount }) => {
 *       const manager = createIdleCapitalManager({
 *         privateKey: process.env.AGENT_KEY as `0x${string}`,
 *         autoMode: false, // Manual only
 *       });
 *       const tx = await manager.deposit(BigInt(amount * 1e6));
 *       return { success: true, tx };
 *     },
 *   },
 *   {
 *     name: "arcis_balance",
 *     description: "Check vault position and wallet balance",
 *     parameters: {},
 *     execute: async () => {
 *       const manager = createIdleCapitalManager({
 *         privateKey: process.env.AGENT_KEY as `0x${string}`,
 *         autoMode: false,
 *       });
 *       const pos = await manager.position();
 *       return {
 *         vault_value: `$${Number(pos.value) / 1e6}`,
 *         wallet_usdc: `$${Number(pos.walletUsdc) / 1e6}`,
 *         shares: Number(pos.shares),
 *       };
 *     },
 *   },
 * ];
 * ```
 */

/**
 * ── Example 6: x402 Payment Flow ──
 * 
 * ```ts
 * // Agent receives x402 micropayments for services.
 * // Idle capital auto-deposits into Arcis between payments.
 * 
 * import { createIdleCapitalManager } from "./arcis-x402-idle-capital";
 * 
 * // Start the idle capital manager
 * const manager = createIdleCapitalManager({
 *   privateKey: process.env.AGENT_KEY as `0x${string}`,
 *   rpcUrl: process.env.BASE_RPC_URL,
 *   depositThreshold: 50,    // Deposit when earnings exceed $50
 *   reserveMinimum: 10,      // Keep $10 for gas
 *   withdrawTrigger: 2,      // Withdraw when gas gets low
 *   withdrawAmount: 20,      // Withdraw $20 at a time
 *   intervalMs: 120_000,     // Check every 2 minutes
 * });
 * 
 * // Your x402 payment handler
 * async function handlePayment(payment: { amount: bigint; from: string }) {
 *   console.log(`Received ${payment.amount} USDC from ${payment.from}`);
 *   // Manager auto-detects the new balance on next tick
 *   // and deposits excess into vault
 * }
 * 
 * // When agent needs to make a payment
 * async function makePayment(to: string, amount: bigint) {
 *   const pos = await manager.position();
 *   if (pos.walletUsdc < amount) {
 *     // Not enough in wallet — withdraw from vault
 *     const needed = amount - pos.walletUsdc + 2_000_000n; // +$2 buffer
 *     await manager.withdrawUsdc(needed);
 *   }
 *   // Now send the payment via x402
 *   // ... your x402 payment logic here
 * }
 * ```
 */

/**
 * ── Example 7: MCP Integration (Claude, ChatGPT, Cursor) ──
 * 
 * For MCP-native agents, connect directly to the Arcis MCP server:
 * 
 * ```json
 * {
 *   "mcpServers": {
 *     "arcis": {
 *       "command": "npx",
 *       "args": ["@arcisprotocol/mcp"]
 *     }
 *   }
 * }
 * ```
 * 
 * Or connect to the remote server:
 * URL: https://mcp.arcis.money/mcp
 * 
 * Available tools:
 * - arcis_vault_status: TVL, rate, capacity
 * - arcis_vault_balance: agent position
 * - arcis_credit_status: lending pool
 * - arcis_credit_tiers: ERC-8004 reputation tiers
 * - arcis_credit_health: loan health check
 * - arcis_contracts: all 7 contract addresses
 */

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export { VAULT_ABI, USDC_ABI, base };
export default createIdleCapitalManager;
