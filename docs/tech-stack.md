# Технічний стек Predict-Edge

Документ фіксує стек, який реально є в репозиторії зараз. Root package не запускає Next.js:
він відповідає за Hardhat/deploy tooling, а application runtime винесений у `app/` і `server/`.

## Структура монорепо

```text
predict-edge/
├── app/            # Vite + React frontend, Bun, PWA
├── server/         # Hono API на Bun
├── contracts/      # Solidity contracts: market, AMM, CLOB
├── scripts/        # deploy, verify, env sync, wallet/reset utilities
├── data/           # markets.json plus legacy orders.json
├── docs/           # архітектурна документація
├── artifacts/      # Hardhat output, gitignored
├── cache/          # Hardhat cache, gitignored
└── typechain-types/# TypeChain output, gitignored
```

## Frontend: `app/`

| Категорія | Реалізація |
|---|---|
| Runtime/build | Bun, Vite 5, `@vitejs/plugin-react-swc` |
| UI | React 18, Tailwind 3, shadcn-style primitives на Radix, lucide-react, framer-motion |
| App shell | `react-router-dom` маршрути `/`, `/market/:address`, `/portfolio` |
| Data fetching | `@tanstack/react-query` |
| Web3 reads/writes | wagmi 3, viem 2, injected connector, explicit Arc Testnet chain guard |
| Circle wallet | `@circle-fin/modular-wallets-core`, passkey/WebAuthn, smart account, bundler client, paymaster |
| Charts | `lightweight-charts`, generated sparklines |
| PWA | `vite-plugin-pwa`, manifest/icons, `/v1/*` network-only caching rule |
| Архітектура | feature-sliced: `src/app`, `src/features/{markets,trading,wallet,portfolio}`, `src/shared/{ui,lib}`, `src/styles` |
| API access | Vite dev proxy `/v1` -> `http://localhost:8787` |
| Docker | Bun build -> nginx (`app/Dockerfile`, `app/nginx.conf`) |

Основні frontend-команди:

```bash
cd app
bun install
bun run dev        # http://localhost:5173
bun run build
bun run typecheck
bun run lint
```

## Backend: `server/`

| Категорія | Реалізація |
|---|---|
| Runtime | Bun, `Bun.serve` |
| Framework | Hono, `OpenAPIHono` |
| API docs | `/openapi.json`, `/docs` через Scalar |
| Routes | `/health`, `/v1/markets`, legacy `/v1/orders` |
| Web3 | ethers v6 для server-side deploy market + AMM + CLOB |
| Валідація | zod schemas у Hono routes |
| Error model | `neverthrow` у create-market service |
| Logging | pino |
| Persistence | JSON files: `data/markets.json`; `data/orders.json` remains for legacy order routes |
| Config | root `.env.local` + server `.env`, `API_PORT`, `CORS_ORIGINS`, `ARC_RPC_URL`, `PRIVATE_KEY` |
| Docker | `server/Dockerfile` на `oven/bun` |

Основні backend-команди:

```bash
cd server
bun install
bun run dev        # http://localhost:8787
bun run typecheck
bun run lint
bun test
```

## Contracts/deploy: root

| Категорія | Реалізація |
|---|---|
| Framework | Hardhat 2 + `@nomicfoundation/hardhat-toolbox` |
| Solidity | 0.8.17, optimizer enabled, `runs=1000000` |
| Contracts | `EventBasedPredictionMarket.sol`, `PredictionMarketAMM.sol`, `OnChainLimitOrderBook.sol` |
| Dependencies | OpenZeppelin 4.9, UMA `@uma/core` artifacts |
| Network | `arcTestnet`, chainId `5042002`, RPC default `https://rpc.testnet.arc.network` |
| Explorer config | Arcscan custom chain in `hardhat.config.ts` |
| Collateral | Arc Testnet USDC ERC-20 system address `0x3600000000000000000000000000000000000000`, 6 decimals |
| Gas | Native Arc USDC, 18 decimals at wallet balance level |

Root commands:

```bash
bun install
bun run compile
bun run deploy
bun run verify-deploy
bun run sync-env
bun run generate-wallet
bun run reset
bun run test:contracts
bun run keeper
bun run dev:api
bun run dev:app
bun run build:app
```

## Environment model

| File | Призначення |
|---|---|
| root `.env.local` | `PRIVATE_KEY`, `NEXT_PUBLIC_ALCHEMY_RPC_URL`, deployed `NEXT_PUBLIC_*` addresses |
| `app/.env.local` | `VITE_*` addresses and optional Circle credentials |
| server `.env` | optional backend overrides such as `API_PORT`, `CORS_ORIGINS`, `ARC_RPC_URL` |

Deploy writes root `.env.local`. `scripts/sync-env.ts` maps root variables into Vite variables:

| Root | Frontend |
|---|---|
| `NEXT_PUBLIC_ALCHEMY_RPC_URL` | `VITE_ARC_RPC_URL` |
| `NEXT_PUBLIC_MARKET_ADDRESS` | `VITE_MARKET_ADDRESS` |
| `NEXT_PUBLIC_AMM_ADDRESS` | `VITE_AMM_ADDRESS` |
| `NEXT_PUBLIC_CLOB_ADDRESS` | `VITE_CLOB_ADDRESS` |
| `NEXT_PUBLIC_USDC_ADDRESS` | `VITE_USDC_ADDRESS` |
| `NEXT_PUBLIC_OO_V2_ADDRESS` | `VITE_OO_V2_ADDRESS` |
| `NEXT_PUBLIC_FINDER_ADDRESS` | `VITE_FINDER_ADDRESS` |
| `NEXT_PUBLIC_TIMER_ADDRESS` | `VITE_TIMER_ADDRESS` |

## Реалізовані product features

- Market grid із категоріями, одним базовим live market із env addresses і user-created markets із API.
- Market detail із live AMM prices/reserves, portfolio balances, TradingPanel, OrderBook і UMA resolution controls.
- Buy/sell YES/NO через AMM із preview-функціями `calcBuy*`/`calcSell*`.
- Escrowed on-chain limit orders через `OnChainLimitOrderBook`: `placeLimitOrder`, `cancelOrder`, `fillOrder`, `matchOrders`.
- `TradeHistory` читає AMM і CLOB logs з Arc.
- Portfolio page, що агрегує positions по live markets.
- Create Market dialog, який викликає `POST /v1/markets` і деплоїть market + AMM + CLOB серверним key.
- Dual-wallet UX: MetaMask/injected або Circle Passkey, якщо Circle credentials задані.

## Що не реалізовано

- Немає Next.js runtime, Next API routes або `localhost:3000`.
- Testnet keeper script exists as `bun run keeper`; production still needs monitoring and failure policy.
- Немає Postgres/Drizzle/Redis/worker scheduler. Збереження зараз файлове.
- Немає production auth/rate-limit для `POST /v1/markets`.
- Немає real UMA DVM на Arc у цьому testnet bootstrap; використовується `MockOracleAncillary`.
