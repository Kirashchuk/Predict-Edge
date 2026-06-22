# ADR-002: Bun/Vite Runtime Stack

- **Status:** Accepted
- **Date:** 2026-06-22
- **Decision:** Predict-Edge uses a split Bun-first runtime: Vite SPA frontend, Bun/Hono API, and Hardhat contract tooling.

## Context

Predict-Edge is an Arc Testnet prediction-market app with USDC collateral, UMA Optimistic Oracle V2, a constant-product AMM, and an on-chain CLOB.

The runtime is intentionally split by responsibility:

- `app/` - Vite 5 + React 18 SPA, PWA, wallet UX, market/trading/portfolio features.
- `server/` - Bun + Hono API for market metadata and server-side market deployment.
- root - Hardhat contracts, deploy scripts, keeper, env synchronization, and test tooling.

## Decision

The project standardizes on Bun for package/runtime commands:

- Root scripts are invoked with `bun run`.
- App scripts are invoked with `cd app && bun run ...`.
- Server scripts are invoked with `cd server && bun run ...`.
- Root deploy env uses `DEPLOY_*` keys, then `bun run sync-env` writes the `VITE_*` keys expected by the frontend.

The backend exposes:

- `GET /health`
- `GET /docs`
- `GET /openapi.json`
- `GET /v1/markets`
- `POST /v1/markets`

Limit orders are on-chain only through `OnChainLimitOrderBook`.

## Consequences

Positive:

- Bun is the single command runner across root, frontend, and backend.
- Vite keeps the trading UI as a fast SPA.
- Hono keeps API and OpenAPI ownership in `server/`.
- Hardhat remains scoped to Solidity compilation, tests, and Arc Testnet deployment.
- CLOB order state is escrowed on-chain instead of stored in JSON.

Trade-offs:

- Full local UX uses two dev processes: `bun run dev:api` and `bun run dev:app`.
- Contract addresses must be synchronized after deployment with `bun run sync-env`.
- `data/markets.json` is still a local metadata store and must be replaced before public production.

## Verification

Current smoke checks:

```bash
bun run compile
bun run verify-deploy
bun run sync-env
bun run test:contracts
bun run dev:api
bun run dev:app

cd server && bun run typecheck
cd app && bun run typecheck
cd app && bun run build
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8787/health`
- API docs: `http://localhost:8787/docs`
- OpenAPI JSON: `http://localhost:8787/openapi.json`
