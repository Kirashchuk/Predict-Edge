# План деплою в Arc Testnet

Відтворюваний «з нуля» план: від чистого клону до робочого dApp на **Arc Testnet** (chainId `5042002`).
Усе виконується **лише в тестнеті**; жодних мейннет-ключів і реальних коштів. Секрети — тільки в
`.env.local` (gitignored), у git іде **лише** `.env.example`.

---

## 0. Передумови

| Вимога | Деталь |
|---|---|
| Node.js | **v18+** (перевірено на v24.14.0) |
| npm | 9+ (перевірено на 11.9.0) |
| Git | будь-яка свіжа |
| Гаманець-деплоєр | **некастодіальний EOA** (MetaMask) — потрібен експортований приватний ключ |
| Тестовий USDC | на газ — з [Circle faucet](https://faucet.circle.com/) на адресу деплоєра |
| ARCT | мінтиться автоматично деплой-скриптом / через UI faucet |
| Circle creds (опц.) | для passkey-гаманця: `NEXT_PUBLIC_CIRCLE_CLIENT_KEY` / `_URL` з [Circle Console](https://console.circle.com/) |

> **Важливо:** Circle passkey-гаманець **не** експонує приватний ключ → ним **не можна деплоїти**.
> Деплой — лише з некастодіального EOA.

---

## 1. Клон і залежності

```bash
git clone https://github.com/circlefin/arc-prediction-markets.git "arc predict Edge"
cd "arc predict Edge"
npm install
```

✅ Перевірено: `added 2197 packages` (~60s), exit 0.

---

## 2. Налаштування середовища (`.env.local`)

```bash
cp .env.example .env.local
```

Заповнити **`.env.local`** (НЕ комітити):

```ini
# Приватний ключ деплоєра (64 hex, з/без 0x) — некастодіальний EOA
PRIVATE_KEY=<ваш_приватний_ключ>

# RPC Arc Testnet (за замовч. публічний; можна Alchemy-URL)
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network

# Circle modular wallets (опційно — лише для passkey-гаманця)
NEXT_PUBLIC_CIRCLE_CLIENT_KEY=<circle_client_key>
NEXT_PUBLIC_CIRCLE_CLIENT_URL=<circle_client_url>

# Адреси контрактів — допише deploy-скрипт автоматично (не чіпати вручну)
# NEXT_PUBLIC_MARKET_ADDRESS=0x...
# NEXT_PUBLIC_AMM_ADDRESS=0x...
# NEXT_PUBLIC_ARCT_ADDRESS=0x...
# NEXT_PUBLIC_OO_V2_ADDRESS=0x...
# NEXT_PUBLIC_FINDER_ADDRESS=0x...
# NEXT_PUBLIC_TIMER_ADDRESS=0x...
# NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=0x...
```

> Шаблон без секретів збережено в репозиторії як **`.env.example`** (вже присутній).
> `.gitignore` виключає `**/.env`, `**/.env.local`, `**/.env*.local`.

---

## 3. Поповнення газу (USDC) на адресу деплоєра

1. Відкрити [faucet.circle.com](https://faucet.circle.com/), обрати **Arc Testnet**.
2. Запросити тестовий **USDC** на адресу деплоєра (це нативний газовий актив Arc).
3. Перевірити баланс на [testnet.arcscan.app](https://testnet.arcscan.app) → адреса деплоєра.

> Деплой-скрипт впаде з помилкою «Deployer has no balance…», якщо газу немає.

---

## 4. Компіляція контрактів

```bash
npm run compile
```

✅ Перевірено: `Compiled 23 Solidity files successfully (evm target: london)`,
`Successfully generated 86 typings` (solc 0.8.17, optimizer runs=1_000_000).

---

## 5. Деплой UMA-стека + ринку + AMM

```bash
npm run deploy   # hardhat run scripts/deploy.ts --network arcTestnet
```

Скрипт виконує 7 фаз (див. `scripts/deploy.ts`):

| Фаза | Дія |
|---|---|
| Pre-flight | Очищає «застряглі» pending-транзакції деплоєра |
| 1 | Деплой Timer, Finder, IdentifierWhitelist, AddressWhitelist, Store, TestnetERC20 (ARCT), MockOracleAncillary, OptimisticOracleV2 |
| 2 | Реєстрація в Finder; whitelist `YES_OR_NO_QUERY` та ARCT-колатералю |
| 3 | Мінт `100 000 ARCT` деплоєру |
| 4 | Деплой `EventBasedPredictionMarket` (BTC100K, liveness 60s, reward 10, bond 100) |
| 5 | `approve` + `initializeMarket()` → requestPrice в OO |
| 6 | Деплой `PredictionMarketAMM` (2% fee) + `initialize(1000 ARCT)` seed |
| 7 | Запис усіх адрес у `.env.local` |

Очікуваний хвіст логу — `=== Deployment Summary ===` з адресами всіх контрактів і
`Updated .env.local with deployed addresses.`

> **Параметри для зміни** (у `scripts/deploy.ts → CONFIG`): `question`, `pairName`,
> `marketLiveness`, `proposerReward`, `proposerBond`, `ammFeeBps`, `seedLiquidity`.

---

## 6. (Опційно) Верифікація контрактів через Arcscan

`hardhat.config.ts` уже містить customChain `arcTestnet` (apiURL `https://testnet.arcscan.app/api`):

```bash
npx hardhat verify --network arcTestnet <MARKET_ADDRESS> "<...конструкторні аргументи...>"
```

Або вручну переглянути транзакції/контракти на [testnet.arcscan.app](https://testnet.arcscan.app).

---

## 7. Запуск dApp

```bash
npm run dev
```

✅ Перевірено: `Next.js 16.2.0 (Turbopack) … Ready in ~0.6s`, `GET / 200`.
Відкрити **http://localhost:3000**.

**Перевірка end-to-end у браузері:**
1. **Connect Wallet** → MetaMask (Arc Testnet) або Circle Passkey.
2. **Faucet** (навбар) → мінт ARCT.
3. На сторінці ринку: **Approve** → **Buy/Sell** YES/NO через AMM.
4. **Resolve** (вкладка): `proposePrice` (1e18/0/5e17) → чекати liveness (60s) → `settle`.
5. **Redeem/Settle** позиції → отримати ARCT за результатом.
6. **Create Market** → ввести YES/NO питання → новий ринок у грід.

---

## 8. Корисні команди

| Команда | Дія |
|---|---|
| `npm run compile` | Компіляція контрактів |
| `npm run deploy` | Деплой у Arc Testnet |
| `npm run dev` | Dev-сервер (localhost:3000) |
| `npm run build` / `npm start` | Production-білд Next.js |
| `npm run test:contracts` | Hardhat-тести (за наявності) |
| `npm run reset` | Очистити користувацькі ринки (`data/markets.json`); BTC-ринок не чіпає |
| `npm run lint` | ESLint |

---

## 9. Чеклист «готово»

- [ ] `.env.local` заповнено, **не** в git; у git лише `.env.example`.
- [ ] Газовий USDC на адресі деплоєра (Circle faucet).
- [ ] `npm run compile` — без помилок.
- [ ] `npm run deploy` — Summary з адресами; `.env.local` дописано.
- [ ] (опц.) Контракти видно/верифіковано на Arcscan.
- [ ] `npm run dev` → `localhost:3000` 200; e2e-флоу проходить.

> Покроковий **роадмап деплою** (з контрольними точками й rollback) — у [ROADMAP.md](ROADMAP.md).
> Ризики й мітигації — у [risks-and-security.md](risks-and-security.md).
</content>
