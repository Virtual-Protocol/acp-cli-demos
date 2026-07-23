import { MANAGED_EXITS } from "./config.js";
import { ConnectivityAdapter, WireGuardExit, Passage } from "./adapters.js";

/** Resolve a passage request to a real exit adapter — managed (ours) or BYO (the buyer's). */
export function resolveExit(region: string, byoEndpoint?: string): ConnectivityAdapter {
  if (byoEndpoint) return WireGuardExit.byo(region, byoEndpoint); // bring-your-own VPN
  const cfg = MANAGED_EXITS.find((e) => e.region === region);
  if (!cfg) {
    const offered = MANAGED_EXITS.map((e) => e.region).join(", ") || "(none configured)";
    throw new Error(`no managed exit for region '${region}'. Offered: ${offered}`);
  }
  return WireGuardExit.managed(cfg);
}

/** The one thing the provider asks the broker for: a scoped passage to a region. */
export async function provisionPassage(
  region: string,
  ttlSeconds: number,
  byoEndpoint?: string,
): Promise<Passage> {
  return resolveExit(region, byoEndpoint).open(ttlSeconds);
}
