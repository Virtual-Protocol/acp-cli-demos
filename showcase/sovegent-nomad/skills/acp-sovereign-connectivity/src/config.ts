import { robinhoodTestnet } from "@virtuals-protocol/acp-node-v2";

/** Everything settles on Robinhood Chain testnet (46630); $NMD is the payment token. */
export const CHAIN = robinhoodTestnet; // chainId 46630

export const NMD = {
  address: process.env.NMD_TOKEN_ADDRESS ?? "0xcB12b7a2E4af30D93a6600FAdaBe27dE143e0A04",
  symbol: "NMD",
  decimals: 18,
  /** reference USD price used when constructing the AssetToken */
  priceUsd: Number(process.env.NMD_PRICE_USD ?? "0.01"),
};

/** Per-passage fee, in whole $NMD. */
export const PASSAGE_PRICE_NMD = Number(process.env.PASSAGE_PRICE_NMD ?? "1");

/**
 * Human labels for the regions we can offer. Offering a NEW region is exactly this:
 * add a row here, add it to MANAGED_REGIONS (env), and drop a ~$2 WireGuard box in that city —
 * hosted with ANY provider (a low-cost US VPS for US, a Swiss host for CH, a SG host for Singapore…).
 * No other code changes. The broker is provider-agnostic on purpose.
 */
export const REGION_LABELS: Record<string, string> = {
  "us-ca": "California, US",
  "us-ny": "New York, US",
  "ch": "Switzerland",
  "sg": "Singapore",
  "de": "Germany",
};

export type Region = string; // e.g. "us-ca" | "us-ny" | "ch" | "sg" | "de"

export interface ExitConfig {
  region: Region;
  label: string;
  kind: "managed" | "byo";
  /** env var holding this managed exit's WireGuard endpoint — never hardcoded or committed */
  endpointEnv?: string;
}

/** Which managed regions this provider currently offers (default: Germany). */
export const MANAGED_REGIONS: Region[] = (process.env.MANAGED_REGIONS ?? "de")
  .split(",").map((s) => s.trim()).filter(Boolean);

export const MANAGED_EXITS: ExitConfig[] = MANAGED_REGIONS.map((region) => ({
  region,
  label: REGION_LABELS[region] ?? region,
  kind: "managed",
  endpointEnv: `WG_EXIT_${region.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`, // e.g. WG_EXIT_US_CA
}));

export function offeredRegions(): { region: string; label: string }[] {
  return MANAGED_EXITS.map((e) => ({ region: e.region, label: e.label }));
}
