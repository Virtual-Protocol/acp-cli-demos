import { Passage } from "./adapters.js";

/**
 * Signed attestation that an agent egressed from the passage's region. THIS is the product:
 * verifiable proof the agent actually reached the region the job required — sellable even when
 * the buyer brought their own VPN. In production the attestation service reads the exit's
 * OBSERVED public IP + geolocation from inside the exit's own namespace (not client-spoofable)
 * and signs {region, ip, geo, ts} with the Nomad attestation key (public key published separately).
 * Stubbed here so this repo stays infra- and key-free.
 */
export interface EgressProof {
  region: string;
  seenAs: { ip: string; city: string; country: string };
  issuedAt: number; // unix seconds
  /** signature over the payload by the Nomad attestation key; verifiable by buyer/evaluator */
  signature: string;
}

export async function attestEgress(passage: Passage): Promise<EgressProof> {
  // Real impl: call the exit's observe endpoint for the destination-visible IP/geo, then sign.
  // This reference implementation returns a stub payload; the hosted Nomad provider signs
  // real attestations — see the live demo.
  return {
    region: passage.region,
    seenAs: { ip: "resolved-at-runtime", city: passage.label, country: passage.region },
    issuedAt: Math.floor(Date.now() / 1000),
    signature: "attestation-signed-at-runtime",
  };
}
