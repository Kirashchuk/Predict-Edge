# Документація Predict-Edge

Ця папка описує поточну реалізацію Predict-Edge: prediction market на Arc Testnet, який торгує
USDC через constant-product AMM, має escrowed on-chain CLOB limit orders і резолюцію через UMA
Optimistic Oracle V2.

Проєкт походить від `circlefin/arc-prediction-markets`, але зараз реплатформований у локальний
Templars-style monoreпо:

- `app/` - Vite 5 + React 18 + Tailwind/shadcn + PWA.
- `server/` - Bun + Hono API з OpenAPI/Scalar.
- `contracts/` і `scripts/` - Hardhat, Solidity 0.8.17, UMA artifacts, AMM, CLOB, deploy tooling.
- `data/` - локальні JSON-сховища для user-created market metadata і legacy order API.

## Зміст

| Документ | Що всередині |
|---|---|
| [ADR-001-architecture.md](ADR-001-architecture.md) | Архітектурні рішення поточної системи, trade-offs і production-gaps |
| [ADR-002-templars-stack.md](ADR-002-templars-stack.md) | Рішення про перехід із Next.js sample на Vite + Bun/Hono |
| [tech-stack.md](tech-stack.md) | Актуальна карта стеку, структура монорепо, env і команди |
| [architecture-diagram.md](architecture-diagram.md) | C4/sequence діаграми для app, API, контрактів, торгівлі, resolution і limit orders |
| [smart-contract-map.md](smart-contract-map.md) | Контракти, UMA bootstrap, функції, події, trust boundaries |
| [deployment-plan.md](deployment-plan.md) | Відтворюваний деплой в Arc Testnet з нуля |
| [deployed-addresses.md](deployed-addresses.md) | Поточні адреси Arc Testnet і перевірений стан |
| [risks-and-security.md](risks-and-security.md) | Ризики тестнету, серверного ключа, Mock DVM, AMM і order storage |
| [ROADMAP.md](ROADMAP.md) | Фазовий roadmap від локального запуску до pre-prod hardening |

## Поточний стан

| Шар | Статус |
|---|---|
| Контракти | `EventBasedPredictionMarket.sol`, `PredictionMarketAMM.sol`, `OnChainLimitOrderBook.sol`, Solidity 0.8.17, Hardhat |
| Колатераль | Arc Testnet USDC ERC-20 `0x3600000000000000000000000000000000000000`, 6 decimals |
| AMM | `x*y=k`, fee `200 bps`, seed liquidity `5 USDC` у базовому deploy |
| CLOB | On-chain escrowed limit order book per market; buy orders escrow USDC, sell orders escrow PLT/PST |
| Oracle | UMA Optimistic Oracle V2, bootstrap локальним `scripts/deploy.ts`, DVM у тестнеті замінений на `MockOracleAncillary` |
| Frontend | Vite SPA на `http://localhost:5173`, маршрути `/`, `/market/:address`, `/portfolio` |
| Backend | Hono API на `http://localhost:8787`, routes `/v1/markets`, legacy `/v1/orders`, `/docs`, `/openapi.json` |
| Wallets | MetaMask/injected через wagmi + Circle Passkey smart account через Circle Modular Wallets, якщо налаштовано `VITE_CIRCLE_*` |
| Дані | `data/markets.json` для створених ринків; `data/orders.json` лишився для legacy off-chain order API |

## Базові команди

```bash
# root: contracts/deploy tooling
npm install
npm run compile
npm run deploy
npm run verify-deploy
npm run sync-env

# backend
cd server
bun install
bun run dev

# frontend
cd app
bun install
bun run dev
```

Після `npm run deploy` адреси пишуться в root `.env.local` як `NEXT_PUBLIC_*`. Команда
`npm run sync-env` переносить їх у `app/.env.local` як `VITE_*`, бо frontend працює на Vite.

## Ключові факти

- USDC є і газовим активом Arc, і торговим колатералем через ERC-20 system contract з 6 decimals.
- Mintable ARCT більше не є колатералем актуального deploy; старі згадки про ARCT у попередніх docs були історичними.
- Limit orders у поточному UI йдуть через `OnChainLimitOrderBook`, а не через `/v1/orders`.
- `POST /v1/markets` створює новий market + AMM + CLOB серверним deployer key. Це тестнетний UX-компроміс і ключова trust boundary.
- Задокументовані base-market адреси можуть бути старим deploy без `CLOB_ADDRESS`; для CLOB на base market потрібно redeploy + `npm run sync-env`.
- Resolution values: `1e18` = YES, `0` = NO, `5e17` = Undetermined.
