# Документація — Prediction Market на Arc Testnet

Архітектурні артефакти тестнет-проєкту на базі [circlefin/arc-prediction-markets](https://github.com/circlefin/arc-prediction-markets).
Мережа: **Arc Testnet** (chainId `5042002`, газ = USDC). Резолюція: **UMA Optimistic Oracle V2**.
Торгівля: вбудований **constant-product AMM** (2% fee).

## Зміст

| Документ | Що всередині |
|---|---|
| [ADR-001-architecture.md](ADR-001-architecture.md) | Архітектурні рішення (D1–D7), альтернативи, trade-offs, наслідки, action items |
| [ADR-002-templars-stack.md](ADR-002-templars-stack.md) | Реплатформа Next.js → стек Templars (Vite + Bun/Hono + feature-sliced) |
| [tech-stack.md](tech-stack.md) | Карта технічного стеку (копія Templars) + команди |
| [architecture-diagram.md](architecture-diagram.md) | C4 (Context/Container/Component) + sequence-потоки: create / trade / resolve / redeem |
| [smart-contract-map.md](smart-contract-map.md) | Карта контрактів: функції, події, інтеграція з UMA OO V2, межі довіри |
| [deployment-plan.md](deployment-plan.md) | Відтворюваний план деплою в Arc Testnet «з нуля» + `.env.local` шаблон |
| [risks-and-security.md](risks-and-security.md) | Oracle manipulation, AMM slippage, reentrancy, ключі деплоєра, межі тестнету |
| [deployed-addresses.md](deployed-addresses.md) | Адреси задеплоєних контрактів у Arc Testnet + перевірений стан |
| [ROADMAP.md](ROADMAP.md) | Фазовий роадмап деплою з контрольними точками й rollback |

## Статус (перевірено)

- ✅ `npm install` — 2197 packages
- ✅ `npm run compile` — 23 Solidity files (solc 0.8.17), 86 typings
- ✅ `npm run dev` — Next.js 16.2.0, `GET / 200`, `GET /market/… 200`
- ✅ `npm run deploy` — **задеплоєно в Arc Testnet** (адреси в [deployed-addresses.md](deployed-addresses.md)); газу ~0.39 USDC
- ✅ `verify-deploy.ts` — AMM 1000/1000, ціни 0.5/0.5, ринок `priceRequested=true`

## Ключові факти

- Контракти: `EventBasedPredictionMarket.sol` (lifecycle) + `PredictionMarketAMM.sol` (AMM), AGPL-3.0-only.
- UMA-стек бутстрапиться скриптом `scripts/deploy.ts` (Timer, Finder, Whitelists, Store, MockOracle, OO V2).
- Колатераль ARCT (TestnetERC20, mintable) ≠ газовий USDC.
- Dual-wallet: MetaMask (injected) + Circle Passkey (WebAuthn/smart account), абстраговані `useContractWrite`.
- Resolution: `1e18`=YES, `0`=NO, `5e17`=Undetermined.
</content>
