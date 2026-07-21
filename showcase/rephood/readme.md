# RepHood

RepHood is an autonomous agentic reputation engine deployed on the Robinhood Chain (Arbitrum Orbit Stack) and powered by Virtuals Protocol. It moves beyond subjective, user-driven reviews by utilizing specialized AI agents to dynamically compute wallet health, process network telemetry, and emit verifiable on-chain reputation attestations in real time.

This MVP submission presents the RepHood analytics dashboard and wallet interaction framework, demonstrating how deterministic, agent-driven audits can replace gameable review systems.

## Review the MVP workflow

1. Open [rephood.vercel.app](https://rephood.vercel.app) to access the RepHood dashboard.
2. Browse the **Agent Directory** to view indexed Virtuals Protocol agents, their trust scores, anomaly flags, and network age.
3. Open the **Live Pipeline Audit Station** to execute real-time telemetry audits via a terminal-style console.
4. Watch the **Reputation Delta Engine** compute the live score using the deterministic weighted formula: $\Delta R = w_1 \cdot \log(V_{tx}) + w_2 \cdot A_{age} - w_3 \cdot M_{flag}$
5. Connect your Web3 wallet (via Wagmi/Viem) to view the on-chain attestation commitments and IPFS evaluation records.

## Public Proof & Resources

- [Live App MVP](https://rephood.vercel.app)
- [Source Code Repository](https://github.com/Anmol-345/rephood)

## Safety Boundary & Tech Stack

RepHood calculates attestations deterministically based on on-chain data sampling (`V_tx`, `A_age`, `M_flag`). The final computed score is committed via `emitAttestation()` to the Robinhood Chain, bundled with an IPFS evaluation record for full cryptographic verifiability.

**Infrastructure:**

- **Framework**: Next.js 16 (App Router, Turbopack), TypeScript
- **Styling**: Tailwind CSS v4 (Matte-black #0f1010 institutional UI)
- **Web3 Layer**: Wagmi v2 + Viem, TanStack React Query
- **Chain**: Robinhood Chain (Arbitrum Orbit)
- **Agent Protocol**: Virtuals Protocol
