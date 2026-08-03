import { ExitConfig } from "./config.js";

/** A live, scoped passage handed to the buyer. Short-lived and region-bound. */
export interface Passage {
  region: string;
  label: string;
  /** what the agent points its HTTP client / runtime at (proxy URL or WG config reference) */
  endpoint: string;
  expiresAt: number; // unix seconds
}

/**
 * Turns "I want a passage to region X" into a real WireGuard exit. Managed exits (ours) and
 * BYO exits (the buyer's own Mullvad / Proton / self-hosted node) both implement this — Nomad
 * orchestrates and attests; it does NOT own the pipes.
 */
export interface ConnectivityAdapter {
  region: string;
  /** provision a scoped, TTL'd passage through this exit */
  open(ttlSeconds: number): Promise<Passage>;
}

/**
 * WireGuard adapter — works for ANY WG endpoint (our managed box, Mullvad, Proton, self-hosted).
 * Endpoints/keys come from env (managed) or the buyer's own config (BYO) and are NEVER committed.
 */
export class WireGuardExit implements ConnectivityAdapter {
  constructor(
    public region: string,
    private label: string,
    private endpoint: string,
  ) {}

  static managed(cfg: ExitConfig): WireGuardExit {
    const endpoint = cfg.endpointEnv ? process.env[cfg.endpointEnv] : undefined;
    if (!endpoint) {
      throw new Error(`no endpoint for managed exit '${cfg.region}' — set ${cfg.endpointEnv} in your .env`);
    }
    return new WireGuardExit(cfg.region, cfg.label, endpoint);
  }

  static byo(region: string, endpoint: string): WireGuardExit {
    return new WireGuardExit(region, `${region} (BYO)`, endpoint);
  }

  async open(ttlSeconds: number): Promise<Passage> {
    // Real impl: register a scoped, expiring peer on the exit (or mint short-lived proxy creds).
    // Kept thin here so this repo stays infra-free — the exit box itself does the WireGuard work.
    return {
      region: this.region,
      label: this.label,
      endpoint: this.endpoint,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
  }
}
