# План деплою в Arc Testnet

Цей документ описує відтворюваний шлях від чистого checkout до локально запущеного frontend/API з
контрактами в Arc Testnet. Це testnet-only процес: не використовуйте mainnet key або реальні кошти.

## 0. Передумови

| Вимога | Деталі |
|---|---|
| Node.js | v18+ для Hardhat |
| Bun | package manager and command runner for root, `app/`, and `server/` |
| Deployer wallet | EOA private key у root `.env.local` |
| Arc Testnet USDC | Потрібен і для gas, і для trading collateral |
| Circle credentials | Optional, лише для passkey wallet у frontend |

USDC береться з [Circle faucet](https://faucet.circle.com/) на адресу deployer або user wallet.

## 1. Clone та install

```bash
git clone https://github.com/Kirashchuk/Predict-Edge.git
cd Predict-Edge

bun install
cd app && bun install && cd ..
cd server && bun install && cd ..
```

Root `bun install` потрібен для Hardhat, OpenZeppelin, UMA artifacts і scripts. `app` та `server`
мають власні lockfiles і Bun toolchain.

## 2. Root env

Створіть root `.env.local`:

```bash
cp .env.example .env.local
```

Мінімальні значення:

```ini
PRIVATE_KEY=<64_hex_private_key_without_or_with_0x>
DEPLOY_RPC_URL=https://rpc.testnet.arc.network
```

Optional Circle values для frontend passkey:

```ini
VITE_CIRCLE_CLIENT_KEY=<circle_client_key>
VITE_CIRCLE_CLIENT_URL=<circle_client_url>
```

Deploy script допише:

```ini
DEPLOY_MARKET_ADDRESS=0x...
DEPLOY_AMM_ADDRESS=0x...
DEPLOY_CLOB_ADDRESS=0x...
DEPLOY_USDC_ADDRESS=0x3600000000000000000000000000000000000000
DEPLOY_OO_V2_ADDRESS=0x...
DEPLOY_FINDER_ADDRESS=0x...
DEPLOY_TIMER_ADDRESS=0x...
DEPLOY_MOCK_ORACLE_ADDRESS=0x...
```

Секрети залишаються тільки в `.env.local`, який git ignores.

## 3. Fund deployer

1. Візьміть адресу deployer з wallet або згенеруйте нову:

```bash
bun run generate-wallet
```

2. Поповніть адресу Arc Testnet USDC через [Circle faucet](https://faucet.circle.com/).
3. Перевірте баланс на [Arcscan](https://testnet.arcscan.app).

Deploy потребує gas і ERC-20 USDC balance. Поточний base market використовує:

- `0.1 USDC` proposer reward.
- `1 USDC` proposer bond parameter.
- `1 USDC` AMM seed liquidity.

Тримайте запас понад ці суми, бо gas теж списується з USDC balance на Arc.

## 4. Compile contracts

```bash
bun run compile
```

Очікування:

- Solidity 0.8.17.
- Hardhat artifacts у `artifacts/`.
- TypeChain output у `typechain-types/`.

## 5. Deploy UMA, market і AMM

```bash
bun run deploy
```

Скрипт `scripts/deploy.ts` виконує:

| Фаза | Дія |
|---|---|
| Pre-flight | Перевіряє deployer і чистить stuck pending nonces |
| 1 | Деплоїть Timer, Finder, IdentifierWhitelist, AddressWhitelist, Store, MockOracleAncillary, OptimisticOracleV2 |
| 2 | Реєструє UMA implementations у Finder |
| 3 | Whitelist-ить `YES_OR_NO_QUERY` |
| 4 | Whitelist-ить Arc USDC ERC-20 як collateral |
| 5 | Перевіряє deployer USDC balance |
| 6 | Деплоїть `EventBasedPredictionMarket` |
| 7 | Approve reward + `initializeMarket()` |
| 8 | Деплоїть `PredictionMarketAMM` з fee `200 bps` |
| 9 | Approve + `initialize(1 USDC)` для AMM |
| 10 | Деплоїть `OnChainLimitOrderBook` для market |
| 11 | Записує deployed addresses у root `.env.local` |

Після успіху повинна бути секція `Deployment Summary`.

## 6. Sync env для Vite frontend

```bash
bun run sync-env
```

Це створює або оновлює `app/.env.local`:

```ini
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_API_URL=http://localhost:8787
VITE_MARKET_ADDRESS=0x...
VITE_AMM_ADDRESS=0x...
VITE_CLOB_ADDRESS=0x...
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_OO_V2_ADDRESS=0x...
VITE_FINDER_ADDRESS=0x...
VITE_TIMER_ADDRESS=0x...
```

Якщо потрібен Circle Passkey, додайте в `app/.env.local`:

```ini
VITE_CIRCLE_CLIENT_KEY=<circle_client_key>
VITE_CIRCLE_CLIENT_URL=<circle_client_url>
```

Без цих значень Circle wallet UI буде config-gated, але MetaMask path працюватиме.

## 7. Verify deploy

```bash
bun run verify-deploy
```

Перевіряється:

- `priceRequested = true`.
- AMM `initialized = true`.
- Reserves around `YES=1 / NO=1 USDC`.
- Prices around `0.5 / 0.5`.
- Fee `200`.
- Deployer/AMM USDC balances.

Current base deploy must include `DEPLOY_CLOB_ADDRESS`. If `VITE_CLOB_ADDRESS` is empty, rerun
`bun run deploy` and `bun run sync-env` to deploy a base market with CLOB support and sync the frontend env.

## 8. Run backend і frontend

У двох терміналах:

```bash
bun run dev:api
```

```bash
bun run dev:app
```

URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8787/health`
- API docs: `http://localhost:8787/docs`
- OpenAPI JSON: `http://localhost:8787/openapi.json`

Vite dev server proxies `/v1/*` to `http://localhost:8787`.

## 9. Browser smoke flow

1. Open `http://localhost:5173`.
2. Connect MetaMask on Arc Testnet or Circle Passkey if configured.
3. Open a live market.
4. Approve USDC if needed.
5. Buy or sell YES/NO through AMM.
6. Place an on-chain limit order; verify it appears in OrderBook.
7. Fill, cancel, or match crossed CLOB orders.
8. In Resolve tab, approve bond if needed, propose YES/NO/UNDET, settle oracle after liveness jump.
9. Redeem positions for USDC after resolution.

## 10. Create custom market

`Create Market` calls:

```http
POST /v1/markets
Content-Type: application/json

{ "title": "Will ETH trade above $10,000 this year?" }
```

Backend uses server `PRIVATE_KEY`, deploys market + AMM + CLOB, seeds `1 USDC`, and writes metadata to
`data/markets.json`.

Security note: do not expose this endpoint publicly without auth/rate-limit/quotas.

## Useful commands

| Command | Purpose |
|---|---|
| `bun run compile` | Compile Solidity |
| `bun run deploy` | Deploy UMA stack + base market + AMM |
| `bun run verify-deploy` | Read on-chain status |
| `bun run sync-env` | Copy root env addresses to Vite env |
| `bun run dev:api` | Run Hono backend |
| `bun run dev:app` | Run Vite frontend |
| `bun run build:app` | Build frontend |
| `bun run reset` | Clear `data/markets.json` |
| `bun run test:contracts` | Run Hardhat tests if present |

## Rollback

- Failed deploy: fund deployer, fix env, run `bun run deploy` again. New contracts are deployed; old testnet contracts remain on-chain.
- Wrong frontend addresses: run `bun run sync-env`, restart `bun run dev:app`.
- Bad user-created markets: run `bun run reset` or edit `data/markets.json` in a controlled dev environment.
- Bad CLOB orders: cancel on-chain if possible, or redeploy a new market/CLOB in testnet.
