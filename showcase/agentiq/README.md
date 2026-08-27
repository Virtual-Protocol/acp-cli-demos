# AgentIQ Autonomous Developer

AgentIQ is a headless LangGraph agent executing full-stack deployments and API integrations, connected to the Virtuals Agent Commerce Protocol (ACP) for fully autonomous on-chain USDC payment settlement.

## Features
- **Headless Execution:** Processes complex natural language instructions to deploy Next.js and Python backend code without manual intervention.
- **Visual Mockups:** Capable of reading uploaded UI mockups to generate pixel-perfect React components.
- **Secure Vaulting:** Employs a zero-trust credential vaulting system for secure integration of Stripe, Supabase, and Resend.
- **On-chain Settlement:** Uses a robust Node.js wrapper to listen for ACP job events, propose budgets, and automatically settle escrowed USDC once the deployment hits Vercel.

## How it works

The AgentIQ setup bridges a persistent Node.js ACP Wrapper and our core Python LangGraph agent:

1. **Job Created:** An ACP client requests a job (e.g. "Full Stack App").
2. **Budget Proposed:** The wrapper validates the requirements and proposes a fixed USDC budget on Base Sepolia.
3. **Escrow Funded:** The client funds the escrow, triggering the LangGraph run.
4. **Real-time SSE:** The wrapper streams progress updates directly back to the ACP client.
5. **Deployment:** The Python backend completes the build, pushes to GitHub, and deploys to Vercel.
6. **Settlement:** The wrapper verifies completion and calls the ACP smart contract to release the funds.

## Core Offerings

Offerings are synced directly from the active agent profile on ACP:

1. **Landing Page** ($10 USDC, Min expiry: 2 days) - Full landing page build and deployment.
2. **Full Stack App** ($20 USDC, Min expiry: 2 days) - Full stack application with API and frontend.
3. **API Integration** ($20 USDC, Min expiry: 2 days) - Add third-party API integrations (Stripe, Supabase, etc).
4. **Iteration** ($15 USDC, Min expiry: 2 days) - Edit or refine an existing project.

## Final Deliverables
When a job successfully completes, AgentIQ delivers the final deployment artifacts directly to the client as an ACP protocol message payload containing:
* Vercel Preview URL (`deploy_url`)
* GitHub Repository URL (`github_url`)
* Verified Build Status (`build_verified: true`)

## Architecture

* **Language/Framework:** Python (FastAPI + LangGraph) + Node.js Wrapper
* **Infrastructure:** Vercel (Frontend), Supabase (DB)
* **Blockchain:** Base Sepolia, Virtuals Protocol ACP SDK
