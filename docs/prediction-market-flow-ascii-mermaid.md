# Prediction Market Process Flow - Mermaid ASCII

All diagram labels in this file are ASCII-only.

## End-To-End Market Lifecycle

```mermaid
flowchart TB
    Start["Start"]
    Question["Market question exists"]
    Deploy["Deploy EventBasedPredictionMarket"]
    Init["initializeMarket()<br/>request UMA price"]
    Seed["Deploy and seed AMM<br/>1 USDC initial liquidity"]
    DeployCLOB["Deploy CLOB for market"]
    Live["Market is live"]

    subgraph Trading["Trading while unresolved"]
        AMMBuy["AMM buy YES or NO"]
        AMMSell["AMM sell YES or NO"]
        PlaceLimit["Place CLOB limit order"]
        FillLimit["Fill direct order"]
        MatchLimit["Match crossed orders"]
        CancelLimit["Cancel maker order"]
    end

    Propose["Propose outcome<br/>YES, NO, or UNDET"]
    Liveness["UMA liveness window"]
    DisputeCheck{"Disputed?"}
    Dispute["Dispute proposed outcome"]
    MockDvm["Mock DVM path<br/>testnet arbitration"]
    SettleOracle["Settle UMA request"]
    Callback["Market priceSettled callback"]
    Resolved["Market resolved"]
    Redeem["Holders redeem YES/NO for USDC"]
    End["End"]

    Start --> Question
    Question --> Deploy
    Deploy --> Init
    Init --> Seed
    Seed --> DeployCLOB
    DeployCLOB --> Live

    Live --> AMMBuy
    Live --> AMMSell
    Live --> PlaceLimit
    Live --> FillLimit
    Live --> MatchLimit
    Live --> CancelLimit
    AMMBuy --> Live
    AMMSell --> Live
    PlaceLimit --> Live
    FillLimit --> Live
    MatchLimit --> Live
    CancelLimit --> Live

    Live --> Propose
    Propose --> Liveness
    Liveness --> DisputeCheck
    DisputeCheck -->|no| SettleOracle
    DisputeCheck -->|yes| Dispute
    Dispute --> MockDvm
    MockDvm --> Propose
    SettleOracle --> Callback
    Callback --> Resolved
    Resolved --> Redeem
    Redeem --> End
```

## Market Creation Flow

```mermaid
sequenceDiagram
    actor Creator as Market creator
    participant UI as CreateMarketDialog
    participant API as POST /v1/markets
    participant Key as Server PRIVATE_KEY
    participant USDC as Arc USDC
    participant MKT as EventBasedPredictionMarket
    participant UMA as UMA OO V2
    participant AMM as PredictionMarketAMM
    participant CLOB as OnChainLimitOrderBook
    participant Store as data/markets.json

    Creator->>UI: enter market title
    UI->>API: POST { title }
    API->>API: validate title
    API->>Key: load deployer EOA
    API->>USDC: check reward + seed balance
    API->>MKT: deploy pairName, USDC, question, Finder, Timer
    API->>USDC: approve proposer reward
    API->>MKT: initializeMarket()
    MKT->>UMA: requestPrice + set callbacks
    API->>AMM: deploy AMM(market, 200 bps)
    API->>USDC: approve 1 USDC seed
    API->>AMM: initialize(1 USDC)
    AMM->>MKT: create YES + NO reserves
    API->>CLOB: deploy CLOB(market)
    API->>Store: prepend market metadata
    API-->>UI: success + addresses
    UI->>UI: invalidate user-markets query
```

## AMM Buy And Sell Flow

```mermaid
flowchart TB
    Trader["Trader"]
    Connect["Connect wallet"]
    SelectMarket["Open market detail"]
    PickAMM["Choose Buy or Sell tab"]
    Outcome["Select YES or NO"]
    Amount["Enter amount"]
    Preview["Read calcBuy or calcSell preview"]
    NeedApproval{"Allowance enough?"}
    Approve["Approve USDC or position token"]
    Submit["Submit AMM tx"]
    ChainGuard["ensure Arc Testnet<br/>for injected wallet"]
    AMMExec["AMM executes swap"]
    MarketMint["Market create or redeem pairs"]
    TransferOut["Transfer YES, NO, or USDC to trader"]
    Refresh["Refetch balances, prices, reserves"]

    Trader --> Connect
    Connect --> SelectMarket
    SelectMarket --> PickAMM
    PickAMM --> Outcome
    Outcome --> Amount
    Amount --> Preview
    Preview --> NeedApproval
    NeedApproval -->|no| Approve
    Approve --> Submit
    NeedApproval -->|yes| Submit
    Submit --> ChainGuard
    ChainGuard --> AMMExec
    AMMExec --> MarketMint
    MarketMint --> TransferOut
    TransferOut --> Refresh
```

## CLOB Limit Order Flow

```mermaid
flowchart TB
    Maker["Maker"]
    SelectSide["Select buy or sell"]
    SelectOutcome["Select YES or NO"]
    PriceSize["Enter limit price and size"]
    BuySell{"Side"}
    BuyApproval["Buy: approve USDC quote"]
    SellApproval["Sell: approve YES or NO tokens"]
    Place["placeLimitOrder"]
    Escrow{"Escrow type"}
    EscrowUSDC["CLOB escrows USDC"]
    EscrowToken["CLOB escrows outcome tokens"]
    OpenBook["Order appears in on-chain book"]

    Taker["Taker or matcher"]
    DirectFill["fillOrder"]
    Crossed{"Best bid >= best ask?"}
    Match["matchOrders"]
    Cancel["Maker cancelOrder"]
    Finalize["Order filled or cancelled"]
    ReturnEscrow["Return residual escrow if any"]

    Maker --> SelectSide
    SelectSide --> SelectOutcome
    SelectOutcome --> PriceSize
    PriceSize --> BuySell
    BuySell -->|buy| BuyApproval
    BuySell -->|sell| SellApproval
    BuyApproval --> Place
    SellApproval --> Place
    Place --> Escrow
    Escrow -->|buy| EscrowUSDC
    Escrow -->|sell| EscrowToken
    EscrowUSDC --> OpenBook
    EscrowToken --> OpenBook

    OpenBook --> Taker
    Taker --> DirectFill
    OpenBook --> Crossed
    Crossed -->|yes| Match
    Crossed -->|no| OpenBook
    OpenBook --> Cancel
    DirectFill --> Finalize
    Match --> Finalize
    Cancel --> Finalize
    Finalize --> ReturnEscrow
```

## Oracle Resolution And Redeem Flow

```mermaid
sequenceDiagram
    actor P as Proposer
    actor D as Disputer
    actor H as Holder
    participant UI as Resolve tab
    participant USDC as USDC
    participant OO as OptimisticOracleV2
    participant Timer as Timer
    participant MKT as EventBasedPredictionMarket
    participant DVM as MockOracleAncillary

    P->>UI: choose YES, NO, or UNDET
    UI->>USDC: approve bond if allowance is low
    UI->>Timer: set time helper on testnet
    UI->>OO: proposePrice(identifier, timestamp, ancillaryData, price)
    OO-->>UI: state Proposed
    alt proposal accepted
        UI->>Timer: move past expiration on testnet
        UI->>OO: settle(request)
        OO->>MKT: priceSettled callback
        MKT->>MKT: store settlementPrice
    else proposal disputed
        D->>OO: disputePrice(request)
        OO->>MKT: priceDisputed callback
        MKT->>OO: re-request price at new timestamp
        OO->>DVM: escalate to mock DVM
    end
    H->>MKT: settle(longTokens, shortTokens)
    MKT->>H: return USDC by final outcome
```

## Keeper Auto-Match Flow

```mermaid
sequenceDiagram
    actor Op as Operator
    participant Keeper as scripts/keeper.ts
    participant Env as .env.local + .env
    participant Store as data/markets.json
    participant CLOB as OnChainLimitOrderBook
    participant Chain as Arc Testnet

    Op->>Keeper: bun run keeper
    Keeper->>Env: load RPC, PRIVATE_KEY, interval
    Keeper->>Store: load user-created CLOB addresses
    Keeper->>Env: load base DEPLOY_CLOB_ADDRESS
    loop every KEEPER_INTERVAL_MS
        Keeper->>CLOB: getOpenOrders(YES, Buy/Sell)
        Keeper->>CLOB: getOrders(ids)
        Keeper->>CLOB: getOpenOrders(NO, Buy/Sell)
        Keeper->>CLOB: getOrders(ids)
        alt best bid >= best ask
            Keeper->>Chain: sign and submit matchOrders(bid, ask, 0)
            Chain->>CLOB: execute escrowed match
            CLOB-->>Keeper: tx mined
        else no crossed orders
            Keeper-->>Op: wait for next tick
        end
    end
```

## Position Value Flow

```mermaid
flowchart LR
    USDCIn["USDC collateral"]
    Mint["market.create"]
    Pair["YES + NO pair"]
    AMM4["AMM trading"]
    CLOB4["CLOB escrow and matching"]
    Portfolio["Portfolio value<br/>YES * yesPrice + NO * noPrice"]
    Outcome{"Final outcome"}
    YesWin["YES = 1 USDC<br/>NO = 0"]
    NoWin["NO = 1 USDC<br/>YES = 0"]
    Undet["YES = 0.5 USDC<br/>NO = 0.5 USDC"]
    Redeem2["market.settle"]
    USDCOut["USDC returned"]

    USDCIn --> Mint
    Mint --> Pair
    Pair --> AMM4
    Pair --> CLOB4
    AMM4 --> Portfolio
    CLOB4 --> Portfolio
    Portfolio --> Outcome
    Outcome -->|YES| YesWin
    Outcome -->|NO| NoWin
    Outcome -->|UNDET| Undet
    YesWin --> Redeem2
    NoWin --> Redeem2
    Undet --> Redeem2
    Redeem2 --> USDCOut
```
