# Архітектурні діаграми

Діаграми відображають поточну реалізацію: Vite SPA, Hono API, Hardhat-deployed contracts,
USDC collateral, UMA OO V2 і escrowed on-chain CLOB limit orders.

## C4 Level 1: System Context

```mermaid
graph TB
    User["User / trader / proposer"]
    Deployer["Deployer EOA"]
    CircleFaucet["Circle faucet<br/>Arc Testnet USDC"]
    CircleWallets["Circle Modular Wallets<br/>passkey, bundler, paymaster"]
    Arc["Arc Testnet<br/>chainId 5042002<br/>native gas: USDC"]
    Arcscan["Arcscan explorer"]

    subgraph System["Predict-Edge"]
        App["Vite React SPA"]
        Api["Bun/Hono API"]
        Contracts["Prediction market contracts<br/>UMA OO V2 + AMM + CLOB"]
        Data["JSON data store<br/>market metadata"]
    end

    User --> App
    App --> Api
    App --> Contracts
    Api --> Contracts
    Api --> Data
    Deployer --> Contracts
    User --> CircleFaucet
    App --> CircleWallets
    CircleWallets --> Arc
    Contracts --> Arc
    User --> Arcscan
```

## C4 Level 2: Containers

```mermaid
graph TB
    subgraph Browser["Browser"]
        UI["app/<br/>Vite + React 18 + Tailwind"]
        Router["react-router<br/>/, /market/:address, /portfolio"]
        Wallet["WalletProvider<br/>MetaMask + Circle Passkey"]
        Query["TanStack Query"]
    end

    subgraph Api["server/ on Bun"]
        Hono["OpenAPIHono app"]
        Markets["/v1/markets<br/>list + create market"]
        Docs["/docs + /openapi.json"]
        Stores["data/markets.json"]
    end

    subgraph Chain["Arc Testnet"]
        USDC["USDC ERC-20<br/>0x3600...0000<br/>6 decimals"]
        Market["EventBasedPredictionMarket"]
        AMM["PredictionMarketAMM<br/>x*y=k, 2 percent fee"]
        CLOB["OnChainLimitOrderBook<br/>escrowed limit orders"]
        Tokens["PLT / PST<br/>YES / NO position tokens"]
        UMA["UMA stack<br/>Finder, whitelists, Store,<br/>MockOracle, OO V2, Timer"]
    end

    UI --> Router
    UI --> Wallet
    UI --> Query
    Query --> Markets
    Hono --> Markets
    Hono --> Docs
    Markets --> Stores
    Markets -->|ethers v6 deploy| Market
    Markets -->|ethers v6 deploy| AMM
    Markets -->|ethers v6 deploy| CLOB
    Wallet -->|wagmi or UserOperation| AMM
    Wallet -->|wagmi or UserOperation| CLOB
    Wallet -->|propose, dispute, settle| UMA
    AMM --> Market
    CLOB --> Market
    CLOB --> Tokens
    CLOB --> USDC
    Market --> Tokens
    Market --> USDC
    Market --> UMA
```

## C4 Level 3: Frontend features

```mermaid
graph LR
    subgraph App["app/src"]
        Shell["app/App.tsx<br/>providers + routes"]
        Layout["app/Layout.tsx"]
        Markets["features/markets<br/>grid, detail, create, charts"]
        Trading["features/trading<br/>buy, sell, limit, resolve, order book"]
        WalletFeature["features/wallet<br/>WalletContext, wagmi, useContractWrite"]
        Portfolio["features/portfolio"]
        Shared["shared/lib + shared/ui"]
    end

    subgraph External["External surfaces"]
        Api["Hono /v1 API"]
        Chain["Arc contracts"]
        Circle["Circle passkey infra"]
    end

    Shell --> Layout
    Shell --> Markets
    Shell --> Portfolio
    Markets --> Trading
    Trading --> WalletFeature
    Portfolio --> Markets
    Markets --> Api
    Trading --> Api
    WalletFeature --> Chain
    WalletFeature --> Circle
    Markets --> Shared
    Trading --> Shared
```

## Sequence: deploy base market

```mermaid
sequenceDiagram
    participant Op as Operator
    participant HH as Hardhat scripts/deploy.ts
    participant UMA as UMA artifacts
    participant USDC as Arc USDC ERC-20
    participant MKT as EventBasedPredictionMarket
    participant AMM as PredictionMarketAMM
    participant CLOB as OnChainLimitOrderBook
    participant Env as root .env.local

    Op->>HH: bun run deploy
    HH->>UMA: deploy Timer, Finder, whitelists, Store, MockOracle, OO V2
    HH->>UMA: register implementations in Finder
    HH->>UMA: whitelist YES_OR_NO_QUERY and USDC
    HH->>USDC: check deployer balance
    HH->>MKT: deploy market(question, USDC, finder, timer, reward, liveness, bond)
    HH->>USDC: approve market for proposer reward
    HH->>MKT: initializeMarket()
    MKT->>UMA: requestPrice + setEventBased + callbacks
    HH->>AMM: deploy AMM(market, 200 bps)
    HH->>USDC: approve AMM for 1 USDC
    HH->>AMM: initialize(1 USDC)
    AMM->>MKT: create(1 USDC)
    MKT-->>AMM: mint PLT + PST reserves
    HH->>CLOB: deploy CLOB(market)
    HH->>Env: write DEPLOY_* addresses
```

## Sequence: run app and API locally

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Sync as scripts/sync-env.ts
    participant Api as Bun/Hono server
    participant App as Vite dev server

    Dev->>Sync: bun run sync-env
    Sync-->>Dev: writes app/.env.local with VITE_*
    Dev->>Api: bun run dev:api
    Api-->>Dev: listens on :8787
    Dev->>App: bun run dev:app
    App-->>Dev: listens on :5173, proxies /v1 to :8787
```

## Sequence: buy YES through AMM

```mermaid
sequenceDiagram
    actor U as User
    participant UI as TradingPanel
    participant W as useContractWrite
    participant USDC as USDC
    participant AMM as PredictionMarketAMM
    participant MKT as EventBasedPredictionMarket
    participant YES as PLT

    U->>UI: enter USDC amount
    UI->>AMM: calcBuyYes(amount)
    UI->>W: approve USDC if allowance is low
    W->>USDC: approve(AMM, max)
    UI->>W: buyYes(amount)
    W->>AMM: tx via MetaMask or Circle UserOperation
    AMM->>USDC: transferFrom(user, AMM, amount)
    AMM->>MKT: create(amount)
    MKT-->>AMM: mint YES + NO tokens
    AMM->>AMM: swap NO into pool, compute YES out with fee
    AMM->>YES: transfer(user, yesOut)
```

## Sequence: create custom market

```mermaid
sequenceDiagram
    actor U as User
    participant Dialog as CreateMarketDialog
    participant Api as POST /v1/markets
    participant Key as PRIVATE_KEY
    participant Chain as Arc Testnet
    participant Store as data/markets.json

    U->>Dialog: submit title
    Dialog->>Api: POST { title }
    Api->>Key: load deployer EOA
    Api->>Chain: check USDC balance
    Api->>Chain: deploy EventBasedPredictionMarket
    Api->>Chain: approve reward + initializeMarket
    Api->>Chain: deploy AMM + seed 1 USDC
    Api->>Store: prepend market metadata
    Api-->>Dialog: { success: true, market }
```

## Sequence: on-chain CLOB limit order

```mermaid
sequenceDiagram
    actor U as User
    participant UI as LimitForm / OrderBook
    participant W as useContractWrite
    participant USDC as USDC
    participant TOK as PLT / PST
    participant CLOB as OnChainLimitOrderBook

    U->>UI: select side, outcome, price, size
    alt buy order
        UI->>W: approve USDC if needed
        W->>USDC: approve(CLOB, max)
    else sell order
        UI->>W: approve PLT/PST if needed
        W->>TOK: approve(CLOB, max)
    end
    UI->>W: placeLimitOrder(side, outcome, price, amount)
    W->>CLOB: tx via MetaMask or Circle UserOperation
    CLOB->>USDC: escrow collateral for buy
    CLOB->>TOK: escrow outcome tokens for sell
    UI->>CLOB: getOpenOrders + getOrders
    U->>UI: fill/cancel/match
    UI->>CLOB: fillOrder, cancelOrder, or matchOrders
```

## Sequence: resolve and redeem

```mermaid
sequenceDiagram
    actor P as Proposer
    actor D as Disputer
    actor U as Position holder
    participant UI as Resolve tab
    participant OO as OptimisticOracleV2
    participant Timer as Timer
    participant MKT as EventBasedPredictionMarket
    participant DVM as MockOracleAncillary
    participant USDC as USDC

    P->>UI: propose YES / NO / UNDET
    UI->>Timer: setCurrentTime(now) on testnet
    UI->>OO: proposePrice(...)
    alt no dispute
        UI->>Timer: jump past expiration
        UI->>OO: settle(...)
        OO->>MKT: priceSettled(...)
    else disputed
        D->>OO: disputePrice(...)
        OO->>MKT: priceDisputed(...)
        MKT->>OO: re-request price with new timestamp
        OO->>DVM: escalate to mock DVM
    end
    U->>MKT: settle(longTokens, shortTokens)
    MKT->>USDC: transfer collateral by settlementPrice
```
