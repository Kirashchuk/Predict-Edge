# ADR-002: Реплатформа на Templars-style стек

- **Status:** Accepted
- **Date:** 2026-06-22
- **Decision:** Replace the original Next.js sample runtime with a split Vite frontend and Bun/Hono backend.

## Context

Початковий Circle sample був ближчий до Next.js full-stack app: UI, API routes і deploy helper logic жили в одному runtime. Поточний Predict-Edge реалізований інакше:

- `app/` - окремий Vite SPA.
- `server/` - окремий Bun/Hono API.
- root - Hardhat, contracts, deploy scripts.

Мета реплатформи - привести проєкт до стилю Templars Trade: легкий SPA, Bun backend, feature-sliced frontend, окреме API і збереження контрактного шару без зайвого framework coupling.

## Decision

Прийнято таку структуру:

| Було | Стало |
|---|---|
| Next.js App Router runtime | Vite 5 SPA + `react-router-dom` |
| Next API routes | Hono API на Bun у `server/` |
| `process.env.NEXT_PUBLIC_*` у frontend | `import.meta.env.VITE_*`, синхронізація через `npm run sync-env` |
| Один application package | root Hardhat tooling + `app` frontend + `server` backend |
| API без окремої OpenAPI поверхні | `OpenAPIHono` + Scalar `/docs` |
| Demo-only market catalog | Live base market + user-created markets from `/v1/markets` |

Contracts and deploy tooling залишились у root, бо Hardhat/npm ecosystem для Solidity тут простіший і вже працює.

## Implemented stack

Frontend `app/`:

- Bun package runtime.
- Vite 5 + React 18 + SWC.
- Tailwind 3 + shadcn/Radix primitives.
- PWA через `vite-plugin-pwa`.
- wagmi/viem for injected wallet reads/writes.
- Circle Modular Wallets for optional passkey smart account.
- TanStack Query for API/server state.
- Feature slices: `markets`, `trading`, `wallet`, `portfolio`.

Backend `server/`:

- Bun + Hono + `OpenAPIHono`.
- `ethers` v6 for market deploys.
- `zod`, `neverthrow`, `pino`.
- `/v1/markets`; legacy `/v1/orders` remains but current limit order UI uses the CLOB contract.
- JSON file storage under root `data/` for market metadata and legacy orders.
- CLOB ABI/hooks for `OnChainLimitOrderBook`.

Root:

- Hardhat compile/deploy.
- `scripts/deploy.ts` bootstraps UMA + market + AMM.
- `scripts/verify-deploy.ts` reads live on-chain state.
- `scripts/sync-env.ts` bridges root deploy env to Vite env.

## Options considered

### Option A: Full Templars-style split, chosen

Pros:

- Clear runtime ownership: frontend, backend, contracts.
- Faster frontend DX with Vite.
- Backend can expose OpenAPI docs and evolve independently.
- Better alignment with existing Templars conventions.

Cons:

- More packages to install/run.
- Env synchronization step is required.
- No SSR/RSC. This is acceptable because the app is a trading SPA.

### Option B: Keep Next.js

Pros:

- Fewer moving parts for a small sample.
- One dev server.

Cons:

- Does not match the implemented architecture.
- Keeps server actions/API routes coupled to frontend framework.
- Harder to reuse backend patterns from Templars.

Rejected.

### Option C: Hybrid Next frontend + Bun API

Pros:

- Could migrate backend first.

Cons:

- Two frontend conventions across related projects.
- Keeps old routing/build assumptions in docs and scripts.

Rejected.

## Consequences

Positive:

- `npm run dev:app` and `npm run dev:api` express the real split.
- Frontend dev server proxies `/v1` to Hono.
- API docs live at `http://localhost:8787/docs`.
- Frontend bundle is PWA-ready and not tied to Node server rendering.

Costs:

- Developers must run app and API separately for full local UX.
- `npm run sync-env` must run after deploy before frontend has current contract addresses.
- JSON persistence is simple but not production-grade.

## Verification targets

Use these as current smoke checks:

```bash
npm run compile
npm run verify-deploy
npm run sync-env
npm run dev:api
npm run dev:app

cd server && bun run typecheck
cd app && bun run typecheck
cd app && bun run build
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8787/health`
- API docs: `http://localhost:8787/docs`
- OpenAPI JSON: `http://localhost:8787/openapi.json`

## Follow-up work

- Add a real database if market metadata or legacy order routes need durability.
- Add auth/rate-limit around market creation.
- Add CI for root contracts, app, and server checks.
- Add production monitoring and failure policy around the testnet `npm run keeper` matcher.
