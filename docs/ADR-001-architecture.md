# ADR-001: Архітектура Predict-Edge на Arc Testnet

- **Status:** Accepted for testnet
- **Date:** 2026-06-22
- **Scope:** Smart contracts, backend API, frontend wallet/trading flows, deploy model
- **Base:** Circle `arc-prediction-markets`, repackaged into the current Predict-Edge monorepo

## Context

Потрібна testnet-система binary YES/NO prediction markets на Arc Testnet:

- Торгівля має працювати без market maker operator, тому потрібна вбудована on-chain ліквідність.
- Резолюція не має залежати від owner-only resolver.
- Arc використовує USDC як native gas asset, а поточний продукт також торгує USDC як ERC-20 collateral.
- Frontend має підтримувати звичайний injected EVM wallet і Circle Passkey smart account.
- Створення ринків у demo має бути швидким із UI, але без production claims.

## Decision

Прийнято архітектуру з п'яти шарів:

1. **Contracts:** `EventBasedPredictionMarket` + `PredictionMarketAMM` + `OnChainLimitOrderBook` на Solidity 0.8.17.
2. **Resolution:** UMA Optimistic Oracle V2, який локально bootstraps deploy script, з `MockOracleAncillary` як testnet DVM substitute.
3. **Collateral/trading asset:** Arc Testnet USDC ERC-20 system contract `0x3600000000000000000000000000000000000000` з 6 decimals.
4. **Application runtime:** Vite React SPA в `app/` + Bun/Hono API в `server/`.
5. **Market creation:** `POST /v1/markets` деплоїть market + AMM + CLOB серверним deployer key і зберігає metadata в `data/markets.json`.

Це замінює попередній test-token варіант із mintable ARCT як колатералем. ARCT більше не є актуальним торговим collateral у deploy script.

## D1. Resolution mechanism

**Chosen:** UMA Optimistic Oracle V2 in event-based mode.

Pros:

- Permissionless propose/dispute/settle flow.
- Ринок не має centralized owner-resolver.
- `EventBasedPredictionMarket` перевіряє sender callback, identifier, ancillary data і current timestamp.

Trade-offs:

- UMA не є нативно задеплоєною на Arc у цьому проєкті, тому deploy script піднімає Finder, whitelists, Store, MockOracle і OO V2.
- Dispute arbitration у testnet спирається на `MockOracleAncillary`, тобто admin може push price. Це не production DVM.
- `marketLiveness = 60s` оптимізовано для demo, не для реального оскарження.

Rejected alternatives:

- Owner/multisig resolver: простіше, але centralized.
- Chainlink-style price feed: не покриває довільні event-based YES/NO питання.

## D2. Trading venues

**Chosen:** AMM for instant liquidity plus on-chain CLOB for escrowed limit orders.

AMM mechanics:

- Buy YES/NO: користувач вносить USDC, AMM викликає `market.create`, отримує пару YES+NO і свапає небажану ногу.
- Sell YES/NO: AMM свапає позиційний токен на протилежну ногу, викликає `market.redeem` і повертає USDC.
- Price: YES = `reserveNo / (reserveYes + reserveNo)`, NO = `reserveYes / (reserveYes + reserveNo)`.
- Fee: `200 bps`.

CLOB mechanics:

- `OnChainLimitOrderBook` деплоїться для конкретного market.
- Buy limit orders escrow USDC.
- Sell limit orders escrow YES або NO position tokens.
- Makers can cancel open orders.
- Takers can `fillOrder`.
- Any matcher can `matchOrders` when bid and ask are crossed.

Trade-offs:

- Простий UX і безперервна ліквідність.
- Slippage росте з розміром trade.
- Немає `minOut`/deadline в contract methods, тому production потребує slippage protection.
- CLOB дає on-chain escrow, але потребує deployed CLOB address і keeper/matcher UX для crossed books.

Rejected alternatives:

- LMSR: більше математики й subsidy mechanics, зайве для поточної реалізації.

## D3. Collateral model

**Chosen:** USDC as both user-facing collateral and gas asset context.

Important distinction:

- Wallet native balance on Arc показується як USDC з 18 decimals і платить gas.
- Trading collateral використовує ERC-20 interface за адресою `0x3600...0000` з 6 decimals.
- UI і scripts не повинні змішувати 18-dec native balance із 6-dec ERC-20 token amounts.

Consequences:

- Немає free mint collateral. Deployer і users мають отримати USDC з Circle faucet.
- Market seed у deploy script малий: `5 USDC`, reward `0.1 USDC`, bond `1 USDC`.
- Production migration не потребує заміни fake collateral, але все ще потребує реального oracle/governance hardening.

## D4. Application runtime

**Chosen:** Vite SPA + Bun/Hono API.

Frontend:

- `app/` на Vite, React 18, Tailwind, shadcn/Radix primitives, PWA.
- `react-router-dom` для `/`, `/market/:address`, `/portfolio`.
- wagmi/viem reads/writes, Circle passkey path through Modular Wallets.

Backend:

- `server/` на Hono + Bun.
- `/v1/markets` для user-created markets і server-side deploy.
- `/v1/orders` legacy API ще існує, але поточний UI для limit orders використовує `OnChainLimitOrderBook`.
- `/docs` і `/openapi.json` генеруються з OpenAPI routes.

Rejected:

- Keep Next.js App Router: не відповідає Templars stack і створює інший backend model.

## D5. Wallet strategy

**Chosen:** dual wallet.

- MetaMask/injected wallet через wagmi.
- Circle Passkey smart account через `@circle-fin/modular-wallets-core`, WebAuthn і bundler/paymaster, якщо `VITE_CIRCLE_CLIENT_KEY` та `VITE_CIRCLE_CLIENT_URL` задані.
- `useContractWrite` єдина точка write abstraction.
- Для injected path `ensureArcChain` форсує Arc Testnet перед tx.

Trade-offs:

- Кращий UX coverage.
- Два signing paths і Circle infra dependency.
- Circle passkey не підходить для root deploy, бо deploy scripts потребують EOA private key.

## D6. Market creation API

**Chosen:** server-side deploy through `POST /v1/markets`.

Flow:

1. Client sends `{ title }`.
2. Server validates title.
3. Server uses `PRIVATE_KEY`, `FINDER_ADDRESS`, `TIMER_ADDRESS`.
4. Server checks deployer USDC balance.
5. Server deploys `EventBasedPredictionMarket`, initializes OO request, deploys and seeds AMM, then deploys CLOB.
6. Server prepends metadata to `data/markets.json`.

Trade-offs:

- User can create markets without exporting their own deploy key.
- Server key becomes a critical trust boundary.
- No auth/rate-limit exists yet. This is acceptable only for controlled testnet usage.

## D7. On-chain CLOB limit orders

**Chosen:** escrowed on-chain order book in `OnChainLimitOrderBook`.

- Contract stores open order IDs by `(outcome, side)`.
- Buy orders escrow collateral based on `amount * price / 1e18`.
- Sell orders escrow outcome tokens.
- `getOpenOrders` and `getOrders` power the UI order book.
- `fillOrder` handles direct taker fills.
- `matchOrders` handles crossed bid/ask pairs at seller ask price.

Trade-offs:

- Stronger execution guarantees than the previous JSON-backed order demo.
- More gas and contract surface area.
- Needs allowance UX for USDC and position tokens.
- Needs a keeper/matcher process for automatic matching; the repo includes `bun run keeper` for testnet auto-matching of crossed books.
- Current recorded base-market env may not have a CLOB address because those addresses were deployed before the CLOB addition.

## Consequences

What is simple now:

- Reproducible testnet deploy from one Hardhat script.
- Vite/Hono split mirrors the current codebase and README.
- USDC-only product surface is clearer for users than ARCT test collateral.
- CLOB limit orders are escrowed on-chain instead of being only JSON metadata.

What must be revisited before production:

- Replace Mock DVM with real oracle/governance path.
- Increase liveness and design realistic bond/reward economics.
- Add AMM slippage protection.
- Expand CLOB gas/security review and define production keeper policy.
- Protect `POST /v1/markets` with auth, quotas, rate-limit, or move deploy to user wallet.
- Replace JSON market metadata storage with a database if the API becomes public.
- Add tests for lifecycle, AMM invariants, oracle callbacks, chain guard, and order state transitions.

## Current parameters

| Parameter | Value |
|---|---|
| Chain | Arc Testnet, chainId `5042002` |
| RPC fallback | `https://rpc.testnet.arc.network` |
| Collateral ERC-20 | `0x3600000000000000000000000000000000000000` |
| Collateral decimals | 6 |
| Native gas display | USDC, 18 decimals |
| Base market | `BTC100K` |
| Question | `Will Bitcoin exceed $100,000 before June 1, 2026?` |
| Market liveness | 60 seconds |
| OO default liveness | 7200 seconds |
| Proposer reward | 0.1 USDC |
| Proposer bond | 1 USDC |
| AMM fee | 200 bps |
| Seed liquidity | 5 USDC |
| CLOB price scale | `1e18` |
| Resolution values | `1e18` YES, `0` NO, `5e17` Undetermined |
