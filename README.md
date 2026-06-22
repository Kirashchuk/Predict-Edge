# Predict-Edge — On-chain Prediction Markets on Arc

> Forged in the markets. A decentralized YES/NO prediction-market platform on
> [Arc Testnet](https://arc.network/), trading **USDC** through a constant-product AMM
> with an **AMM** + **on-chain CLOB limit orders**, resolved trustlessly by
> [UMA's Optimistic Oracle V2](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work).

Built as a Bun-first monorepo: Vite + React frontend, Bun/Hono backend, Hardhat
contracts, USDC collateral, an AMM, an on-chain CLOB, a portfolio page,
dual-wallet support, and a mobile PWA.

---

## Highlights

- **USDC collateral** — trades settle in Arc Testnet's native **USDC ERC-20** (system address
  `0x3600000000000000000000000000000000000000`, **6 decimals**), not a mintable test token.
- **AMM + CLOB limit orders** — continuous trading via a constant-product AMM (2% fee), an
  **AMM depth ladder derived from real pool reserves**, and escrowed **on-chain CLOB** limit orders.
- **Trustless resolution** — UMA Optimistic Oracle V2 (`propose → dispute → settle`). The deploy
  script bootstraps the whole UMA stack on-chain (Finder, whitelists, Store, MockOracle, OO V2).
- **Dual wallet** — MetaMask (injected) or **Circle Passkey** (WebAuthn smart account, gasless via
  paymaster). Every transaction is **forced onto Arc Testnet** (chain `5042002`) so nothing can hit
  mainnet by accident.
- **Portfolio, charts, PWA** — `/portfolio` aggregates positions across live markets; live price
  charts (lightweight-charts) + per-card sparklines; installable mobile PWA in the brutalist Predict-Edge
  visual identity.
- **Multi-market** — a base live BTC market + user-created on-chain markets + a categorized grid of demo markets; anyone
  can **create new on-chain markets** from the UI.

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** (`app/`) | Vite 5 + React 18 (SWC) + Tailwind 3 + shadcn/ui + **PWA**; wagmi/viem, @tanstack/react-query, react-router, zustand, lightweight-charts; feature-sliced `src/{app,features,shared,styles}`; **Bun** |
| **Backend** (`server/`) | **Hono on Bun** (`Bun.serve` + `OpenAPIHono`), ethers v6, pino, zod, neverthrow, Scalar API docs |
| **Contracts** (`contracts/` + `scripts/`) | Solidity 0.8.17 + Hardhat + OpenZeppelin 4.9 + UMA `@uma/core`; market + AMM + CLOB |
| **Tooling** | Bun, ESLint 9 flat + Prettier, Docker + nginx |

Architecture decisions are documented in [`docs/`](docs/) — see
[ADR-001](docs/ADR-001-architecture.md) (core architecture),
[ADR-002](docs/ADR-002-bun-vite-stack.md) (Bun/Vite runtime split), and
[tech-stack.md](docs/tech-stack.md).

## Project structure

```
predict-edge/
├── app/            # Vite + React frontend (feature-sliced, Bun, PWA)
│   └── src/
│       ├── app/                 # shell: main.tsx, App.tsx (routes), Layout, providers
│       ├── features/
│       │   ├── markets/         # market grid, detail, create, chart, sparkline, catalog
│       │   ├── trading/         # AMM trade, CLOB order book, trade history, oracle (resolve)
│       │   ├── portfolio/       # /portfolio aggregation
│       │   └── wallet/          # dual-wallet (MetaMask + Circle Passkey), chain guard
│       └── shared/{ui,lib}      # shadcn primitives + utils, contracts (abis/addresses), chain
├── server/         # Hono-on-Bun backend
│   └── src/{index.ts, app.ts, core/, modules/markets}
├── contracts/      # EventBasedPredictionMarket.sol, PredictionMarketAMM.sol, OnChainLimitOrderBook.sol
├── scripts/        # deploy.ts, verify-deploy.ts, generate-wallet.ts, sync-env.ts, reset-markets.ts
├── data/           # markets.json (user-created market metadata)
└── docs/           # ADRs, architecture diagram, contract map, deployment plan, risks, addresses
```

## Prerequisites

- **[Bun](https://bun.sh) 1.3+** — runs the frontend and backend.
- **Node.js v18+** — used by Hardhat for the contracts/deploy tooling.
- **A wallet** — MetaMask (or any injected EVM wallet) on **Arc Testnet** (chain `5042002`), or a
  **Circle Passkey** wallet (needs a [Circle developer](https://console.circle.com/) client key/URL).
- **Arc Testnet USDC** — pays for gas **and** is the trading collateral. Get it from the
  [Circle faucet](https://faucet.circle.com/). (USDC is native on Arc; the ERC-20 balance is the same
  balance as native gas.)

## Getting started

```bash
# 1. Clone
git clone https://github.com/Kirashchuk/Predict-Edge.git
cd Predict-Edge

# 2. Install
bun install                 # root — Hardhat / contracts tooling
cd app && bun install && cd ..
cd server && bun install && cd ..

# 3. Deployer wallet + env (testnet only — never a mainnet key)
bun run generate-wallet      # writes PRIVATE_KEY to .env.local
#    → fund the printed address with USDC from https://faucet.circle.com/

# 4. Compile + deploy contracts to Arc Testnet
bun run compile
bun run deploy              # bootstraps UMA + market + AMM + CLOB (USDC collateral), writes addresses
bun run sync-env            # propagates addresses to app/.env.local (VITE_*)

# 5. Run (two terminals)
cd server && bun run dev    # Hono API  → http://localhost:8787  (/docs)
cd app && bun run dev       # Vite app  → http://localhost:5173

# Optional: auto-match crossed CLOB orders
bun run keeper
```

The frontend dev server proxies `/v1/*` to the backend.

## How it works

- **Trading** — `PredictionMarketAMM` is a constant-product (`x*y=k`) pool with a 2% fee.
  `buyYes/buyNo` mint a YES+NO pair from collateral and swap the unwanted leg; `sellYes/sellNo` swap
  and redeem. YES price = `reserveNo / (reserveYes + reserveNo)` (reads as probability).
- **AMM depth** — the depth ladder is computed from the live pool reserves using the exact
  contract math, so it reflects **real on-chain liquidity** (the price you'd get at increasing size).
- **Limit orders** — placed on-chain in `OnChainLimitOrderBook`. Buy orders escrow USDC; sell orders
  escrow YES/NO tokens; orders can be cancelled, directly filled, or matched when crossed.
- **Resolution** — UMA OO V2 in event-based mode. Anyone can `proposePrice`
  (`1e18`=YES, `0`=NO, `5e17`=Undetermined) with a bond; after the liveness window anyone can
  `settle` (permissionless). On testnet a Testable `Timer` lets settle advance past liveness without
  waiting. Disputes escalate to the (mock) DVM.
- **Redeem** — after settlement, `settle(longTokens, shortTokens)` burns positions for USDC by the
  resolved outcome.

## Environment variables

Secrets live in `.env.local` (git-ignored); only `.env.example` templates are committed.

| File | Purpose |
|---|---|
| **root `.env.local`** | `PRIVATE_KEY` (deployer), `DEPLOY_RPC_URL`, and `DEPLOY_*` addresses (written by `bun run deploy`). The backend reuses this file. |
| **`app/.env.local`** | `VITE_*` addresses (written by `bun run sync-env`) + optional `VITE_CIRCLE_CLIENT_KEY/URL` for the Passkey wallet. |

Collateral is the fixed Arc USDC system address `0x3600…0000` (6 decimals) — configured by default,
no need to set it manually.

## Scripts

| Command | What it does |
|---|---|
| `bun run compile` | Compile the Solidity contracts (Hardhat) |
| `bun run deploy` | Deploy UMA stack + market + AMM + CLOB (USDC) to Arc Testnet |
| `bun run deploy:clob` | Deploy only a CLOB for the current `DEPLOY_MARKET_ADDRESS` |
| `bun run verify-deploy` | Read back on-chain state (reserves, prices, balances) |
| `bun run sync-env` | Copy deployed addresses into `app/.env.local` as `VITE_*` |
| `bun run keeper` | Scan configured CLOBs and auto-match crossed bid/ask orders |
| `bun run generate-wallet` | Generate a fresh local deployer wallet |
| `bun run reset` | Clear user-created markets from `data/markets.json` |
| `cd app && bun run dev` | Vite frontend (`:5173`) |
| `cd server && bun run dev` | Hono backend (`:8787`, Scalar docs at `/docs`) |

## API (Hono, `/v1`)

- `GET /v1/markets` · `POST /v1/markets` — list / create on-chain markets.
- `GET /health` · `GET /docs` · `GET /openapi.json`.

## Deployed contracts

Current Arc Testnet addresses (USDC collateral) are tracked in
[`docs/deployed-addresses.md`](docs/deployed-addresses.md).

## Security & usage

Testnet only — see [`docs/risks-and-security.md`](docs/risks-and-security.md). Notable testnet
trade-offs: a Mock DVM substitutes for UMA's real DVM, the create-market API signs with a server-held
deployer key, and the Testable Timer makes liveness instant. Do **not** use a mainnet key or real
funds. The prediction-market/CLOB contracts are **AGPL-3.0-only**; the rest is **Apache-2.0**.
</content>
