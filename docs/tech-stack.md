# Технічний стек Predict-Edge (копія Templars Trade)

Стек приведено у відповідність до основного продукту **Templars Trade** (nado-mvp). Деталі рішення —
в [ADR-002](ADR-002-templars-stack.md).

## Огляд (монорепо)

```
predict-edge/
├── app/         # Frontend — Vite + React 18 + shadcn + Tailwind (Bun)   ← як nado-mvp/app
├── server/      # Backend  — Hono на Bun (ethers v6)                       ← як nado-mvp/api
├── contracts/   # Solidity (Hardhat) — без змін
├── scripts/     # Деплой/утиліти (deploy, verify, generate-wallet, sync-env)
└── docs/
```

## Frontend — `app/` (= nado-mvp/app)

| Категорія | Технологія |
|---|---|
| Build/runtime | **Vite 5** + **Bun**, `@vitejs/plugin-react-swc`, **vite-plugin-pwa** |
| UI | **React 18**, **Tailwind 3**, **shadcn/ui** (Radix, slate, CSS-vars), framer-motion, lucide |
| Архітектура | **feature-sliced**: `src/app` · `src/features/{markets,trading,wallet}` · `src/shared/{ui,lib}` · `src/styles` |
| Web3 | **wagmi 3** + **viem 2** (injected/MetaMask) |
| Дані/стан | @tanstack/react-query, zustand, react-hook-form + zod |
| Маршрути | react-router-dom 6 (route-table в `app/App.tsx`) |
| Шрифти | Space Grotesk + JetBrains Mono (@fontsource) |
| Тулінг | ESLint 9 flat (+`no-restricted-imports` guard), Prettier, `tsc -b` |
| Deploy | Dockerfile (Bun build → nginx) |

## Backend — `server/` (= nado-mvp/api)

| Категорія | Технологія |
|---|---|
| Runtime | **Bun** (`Bun.serve`) |
| Framework | **Hono** (`OpenAPIHono`) — порт `/v1/markets` GET+POST |
| Web3 | **ethers v6** (деплой market+AMM, seed) |
| Валідація/помилки | **zod**, **neverthrow** (Result) |
| Логування | **pino** (+ pino-pretty) |
| API docs | `@hono/zod-openapi` + **Scalar** (`/docs`, `/openapi.json`) |
| Структура | `src/{index.ts, app.ts, core/, modules/markets/}` |
| Deploy | Dockerfile (oven/bun) |

> Розширення «як у nado» (далі за потреби): Drizzle ORM + Postgres, awilix DI, ioredis,
> OpenTelemetry/HyperDX, bun workspaces з `packages/shared`.

## Contracts — `contracts/` (без змін)

Solidity 0.8.17 + Hardhat + OpenZeppelin 4.9 + UMA OO V2. Деталі — [ADR-001](ADR-001-architecture.md),
[smart-contract-map.md](smart-contract-map.md).

## Карта міграції Next.js → Templars

| Було (Next.js) | Стало (Templars) |
|---|---|
| Next.js App Router | Vite SPA + react-router |
| Next API routes (`app/api/*`) | Hono на Bun (`server/`) |
| viem-деплой у route | ethers v6 у `server` |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` (+ `sync-env.ts`) |
| `components/`, `hooks/`, `lib/` | `src/features/<x>/`, `src/shared/` |
| Circle Passkey + injected | injected/MetaMask (wagmi) |
| npm | **Bun** |

## Команди

```bash
# Frontend
cd app && bun install && bun run dev        # http://localhost:5173
cd app && bun run build                     # production build

# Backend
cd server && bun install && bun run dev     # http://localhost:8787  (/docs, /v1/markets)

# Contracts (корінь)
npm run compile && npm run deploy           # Hardhat → Arc Testnet
npm run sync-env                            # адреси → app/.env.local (VITE_)
```
</content>
