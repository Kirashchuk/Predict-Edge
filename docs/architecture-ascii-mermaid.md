# Predict-Edge Architecture - Mermaid ASCII

All diagram labels in this file are ASCII-only.

## System Context

```mermaid
flowchart TB
    Trader["Trader / proposer / disputer"]
    Operator["Operator / deployer EOA"]
    Faucet["Circle Faucet<br/>Arc Testnet USDC"]
    Explorer["Arcscan Explorer"]
    CircleWallets["Circle Modular Wallets<br/>passkey, bundler, paymaster"]

    subgraph PredictEdge["Predict-Edge"]
        App["app/<br/>Vite React SPA + PWA"]
        Api["server/<br/>Bun + Hono API"]
        Data["data/<br/>markets.json + legacy orders.json"]
        Scripts["scripts/<br/>Hardhat deploy + keeper + env sync"]
    end

    subgraph Arc["Arc Testnet<br/>chainId 5042002"]
        USDC["USDC ERC20<br/>0x3600...0000<br/>6 decimals"]
        Market["EventBasedPredictionMarket"]
        AMM["PredictionMarketAMM<br/>x*y=k, 2 percent fee"]
        CLOB["OnChainLimitOrderBook<br/>escrowed limit orders"]
        Tokens["PLT / PST<br/>YES / NO position tokens"]
        UMA["UMA OO V2 stack<br/>Finder, whitelists, Store,<br/>MockOracle, Timer"]
    end

    Trader --> App
    Trader --> Faucet
    Trader --> Explorer
    App -->|HTTP /v1| Api
    App -->|contract reads| Market
    App -->|contract reads and writes| AMM
    App -->|contract reads and writes| CLOB
    App -->|oracle actions| UMA
    App --> CircleWallets
    CircleWallets --> AMM
    CircleWallets --> CLOB
    CircleWallets --> UMA

    Api --> Data
    Api -->|ethers v6 deploy| Market
    Api -->|ethers v6 deploy| AMM
    Api -->|ethers v6 deploy| CLOB
    Operator --> Scripts
    Scripts -->|deploy and verify| Market
    Scripts -->|deploy and verify| AMM
    Scripts -->|deploy and verify| CLOB
    Scripts -->|match crossed orders| CLOB

    AMM --> Market
    CLOB --> Market
    Market --> Tokens
    Market --> USDC
    Market --> UMA
    CLOB --> USDC
    CLOB --> Tokens
```

## Container And Module Map

```mermaid
flowchart LR
    subgraph Frontend["Frontend container: app/src"]
        AppShell["app/App.tsx<br/>providers + routes"]
        Layout["app/Layout.tsx"]
        Markets["features/markets<br/>grid, detail, create, charts"]
        Trading["features/trading<br/>AMM trade, CLOB order book,<br/>oracle resolve, history"]
        Portfolio["features/portfolio<br/>cross-market balances"]
        Wallet["features/wallet<br/>MetaMask + Circle Passkey<br/>useContractWrite"]
        Shared["shared/lib + shared/ui<br/>contracts, chain, format, UI"]
    end

    subgraph Backend["Backend container: server/src"]
        Hono["app.ts<br/>OpenAPIHono, CORS, docs"]
        MarketsApi["modules/markets<br/>GET/POST /v1/markets"]
        OrdersApi["modules/orders<br/>legacy /v1/orders"]
        Config["core/config<br/>env + RPC + private key"]
        Stores["stores<br/>JSON file persistence"]
    end

    subgraph Contracts["Chain contracts"]
        EPM["EventBasedPredictionMarket"]
        AMM2["PredictionMarketAMM"]
        CLOB2["OnChainLimitOrderBook"]
        OO["OptimisticOracleV2"]
        TokenPair["YES / NO ERC20 tokens"]
        USDC2["Arc USDC ERC20"]
    end

    AppShell --> Layout
    AppShell --> Markets
    AppShell --> Portfolio
    Markets --> Trading
    Markets --> Shared
    Trading --> Wallet
    Trading --> Shared
    Portfolio --> Markets
    Wallet --> Shared

    Markets -->|fetch user markets| MarketsApi
    Markets -->|create market| MarketsApi
    Trading -->|legacy path only| OrdersApi

    Hono --> MarketsApi
    Hono --> OrdersApi
    Hono --> Config
    MarketsApi --> Stores
    OrdersApi --> Stores
    MarketsApi -->|deploy market + AMM + CLOB| EPM
    MarketsApi --> AMM2
    MarketsApi --> CLOB2

    Wallet -->|write tx or UserOperation| AMM2
    Wallet -->|write tx or UserOperation| CLOB2
    Wallet -->|propose, dispute, settle| OO
    AMM2 --> EPM
    CLOB2 --> EPM
    EPM --> TokenPair
    EPM --> USDC2
    EPM --> OO
```

## Runtime Data Planes

```mermaid
flowchart TB
    subgraph UIPlane["UI and read plane"]
        Browser["Browser SPA"]
        Query["TanStack Query"]
        Wagmi["wagmi / viem public client"]
        Charts["Price charts, order book, portfolio"]
    end

    subgraph ApiPlane["API and metadata plane"]
        HonoApi["Hono API"]
        MarketStore["data/markets.json"]
        LegacyOrderStore["data/orders.json"]
        OpenApi["/docs + /openapi.json"]
    end

    subgraph WritePlane["Transaction write plane"]
        Injected["Injected wallet path<br/>ensure Arc Testnet"]
        Passkey["Circle passkey path<br/>UserOperation + paymaster"]
        TxRouter["useContractWrite"]
    end

    subgraph ChainPlane["On-chain execution plane"]
        USDC3["USDC approvals and transfers"]
        Market3["Market mint, redeem, settle"]
        AMM3["AMM buy and sell"]
        CLOB3["CLOB place, cancel, fill, match"]
        UMA3["UMA proposal, dispute, settlement"]
    end

    Browser --> Query
    Query --> HonoApi
    Query --> Wagmi
    HonoApi --> MarketStore
    HonoApi --> LegacyOrderStore
    HonoApi --> OpenApi
    Wagmi --> Charts

    Browser --> TxRouter
    TxRouter --> Injected
    TxRouter --> Passkey
    Injected --> USDC3
    Injected --> Market3
    Injected --> AMM3
    Injected --> CLOB3
    Injected --> UMA3
    Passkey --> USDC3
    Passkey --> Market3
    Passkey --> AMM3
    Passkey --> CLOB3
    Passkey --> UMA3

    ChainPlane --> USDC3
    ChainPlane --> Market3
    ChainPlane --> AMM3
    ChainPlane --> CLOB3
    ChainPlane --> UMA3
```

## Deployment Architecture

```mermaid
sequenceDiagram
    participant Op as Operator
    participant Deploy as scripts/deploy.ts
    participant UMA as UMA artifacts
    participant USDC as Arc USDC
    participant MKT as EventBasedPredictionMarket
    participant AMM as PredictionMarketAMM
    participant CLOB as OnChainLimitOrderBook
    participant Env as .env.local
    participant Sync as scripts/sync-env.ts
    participant AppEnv as app/.env.local

    Op->>Deploy: bun run deploy
    Deploy->>UMA: deploy Timer, Finder, whitelists, Store, MockOracle, OO V2
    Deploy->>UMA: register Finder implementations
    Deploy->>UMA: whitelist YES_OR_NO_QUERY and USDC
    Deploy->>USDC: check deployer balance
    Deploy->>MKT: deploy market(question, USDC, Finder, Timer)
    Deploy->>USDC: approve proposer reward
    Deploy->>MKT: initializeMarket()
    MKT->>UMA: requestPrice + callbacks + event based mode
    Deploy->>AMM: deploy AMM(market, 200 bps)
    Deploy->>USDC: approve seed liquidity
    Deploy->>AMM: initialize(5 USDC)
    AMM->>MKT: create YES and NO reserves
    Deploy->>CLOB: deploy CLOB(market)
    Deploy->>Env: write NEXT_PUBLIC_* addresses
    Op->>Sync: bun run sync-env
    Sync->>AppEnv: write VITE_* addresses
```

## Trust Boundaries

```mermaid
flowchart TB
    User["Permissionless user"]
    Frontend2["Frontend signing UX"]
    Wallet2["User wallet<br/>MetaMask or Circle smart account"]
    Api2["Backend API<br/>server deployer key"]
    Store2["JSON stores"]
    Contracts2["Auditable contract surface"]
    Oracle2["UMA OO V2"]
    MockDvm["MockOracleAncillary<br/>testnet DVM substitute"]
    Keeper["Keeper / matcher script"]

    User --> Frontend2
    Frontend2 --> Wallet2
    Wallet2 -->|signed tx| Contracts2
    Frontend2 -->|create market request| Api2
    Api2 -->|deploy with PRIVATE_KEY| Contracts2
    Api2 --> Store2
    Contracts2 --> Oracle2
    Oracle2 --> MockDvm
    Keeper -->|match crossed CLOB orders| Contracts2

    RiskA["Risk: wrong chain"] --> Frontend2
    MitA["Mitigation: ensureArcChain before injected writes"] --> Frontend2
    RiskB["Risk: public create-market spend"] --> Api2
    MitB["Needed before production: auth, quotas, rate limits"] --> Api2
    RiskC["Risk: mock oracle decision power"] --> MockDvm
    MitC["Needed before production: real oracle governance path"] --> Oracle2
```
