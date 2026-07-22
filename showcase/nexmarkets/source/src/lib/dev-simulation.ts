export const DEV_SIMULATION_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as const;

export function isDevSimulationEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NEXMARKETS_DEV_SIMULATION === "false") return false;
  return process.env.NODE_ENV === "development" || process.env.NEXMARKETS_DEV_SIMULATION === "true";
}

export function devSimulatedReceipt() {
  return {
    blockNumber: 100n,
    blockHash: "0x0000000000000000000000000000000000000000000000000000000000000064" as `0x${string}`
  };
}
