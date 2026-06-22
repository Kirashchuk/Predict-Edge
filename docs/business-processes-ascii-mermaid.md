# Predict-Edge Business Processes - Mermaid ASCII

All diagram labels in this file are ASCII-only.

## Business Capability Map

```mermaid
flowchart TB
    subgraph Access["Access and onboarding"]
        Discover["Discover product"]
        Fund["Fund Arc Testnet USDC"]
        Connect["Connect wallet<br/>MetaMask or Circle Passkey"]
        ChainGuard["Stay on Arc Testnet"]
    end

    subgraph MarketSupply["Market supply"]
        CreateIdea["Create market idea"]
        ValidateTitle["Validate title"]
        DeployMarket["Deploy market + AMM + CLOB"]
        Publish["Publish market metadata"]
    end

    subgraph TradingDemand["Trading demand"]
        Browse["Browse markets"]
        Analyze["View prices, reserves, book, history"]
        TradeAMM["Trade through AMM"]
        TradeCLOB["Place, fill, match, cancel limits"]
        Portfolio["Track portfolio value"]
    end

    subgraph Resolution["Resolution and settlement"]
        Propose["Propose result"]
        Dispute["Dispute if needed"]
        SettleOracle["Settle oracle"]
        Redeem["Redeem positions for USDC"]
    end

    subgraph Operations["Operations and controls"]
        DeployOps["Deploy and verify contracts"]
        EnvOps["Sync addresses and env"]
        LaunchOps["Launch app profile<br/>.claude/launch.json"]
        KeeperOps["Run keeper for crossed orders"]
        DocsOps["Maintain docs, risks, addresses"]
        SecurityOps["Add production controls before launch"]
    end

    Discover --> Fund
    Fund --> Connect
    Connect --> ChainGuard
    ChainGuard --> Browse

    CreateIdea --> ValidateTitle
    ValidateTitle --> DeployMarket
    DeployMarket --> Publish
    Publish --> Browse

    Browse --> Analyze
    Analyze --> TradeAMM
    Analyze --> TradeCLOB
    TradeAMM --> Portfolio
    TradeCLOB --> Portfolio
    Portfolio --> Propose

    Propose --> Dispute
    Propose --> SettleOracle
    Dispute --> Propose
    SettleOracle --> Redeem

    DeployOps --> EnvOps
    EnvOps --> LaunchOps
    LaunchOps --> KeeperOps
    KeeperOps --> DocsOps
    DocsOps --> SecurityOps
```

## Stakeholder And Value Flow

```mermaid
flowchart LR
    Trader["Trader"]
    Creator["Market creator"]
    Proposer["Oracle proposer"]
    Disputer["Disputer"]
    Operator["Project operator"]
    Keeper["Keeper / matcher"]

    subgraph Product["Predict-Edge product"]
        UI["Frontend UX"]
        API["Market metadata API"]
        Contracts["On-chain market contracts"]
        Book["AMM + CLOB liquidity"]
        Portfolio["Portfolio view"]
    end

    subgraph Value["Value objects"]
        USDC["USDC collateral"]
        YesNo["YES / NO positions"]
        Metadata["Market metadata"]
        Outcome["Final outcome"]
        Fees["AMM fee in pool reserves"]
    end

    Trader -->|connect and trade| UI
    Creator -->|submit market question| UI
    UI --> API
    API -->|deploy and store| Contracts
    API --> Metadata
    Trader --> USDC
    USDC --> Contracts
    Contracts --> YesNo
    YesNo --> Book
    Book --> Trader
    Book --> Fees
    Keeper -->|match crossed orders| Book
    Proposer -->|bond and proposal| Contracts
    Disputer -->|challenge proposal| Contracts
    Contracts --> Outcome
    Outcome -->|redeem value| Trader
    UI --> Portfolio
    Operator -->|deploy, fund, verify, monitor| UI
    Operator -->|deploy, fund, verify, monitor| API
    Operator -->|deploy, fund, verify, monitor| Contracts
```

## Core User Journey

```mermaid
flowchart TB
    Start["User enters app"]
    WalletChoice{"Wallet path"}
    MetaMask["MetaMask / injected wallet"]
    Circle["Circle Passkey smart account"]
    HasUSDC{"Has Arc Testnet USDC?"}
    Faucet["Use Circle faucet"]
    MarketChoice{"Choose action"}
    BrowseMarket["Browse existing markets"]
    CreateMarket["Create new market"]
    TradeChoice{"Trade action"}
    BuySell["Buy or sell via AMM"]
    LimitOrder["Use CLOB limit order"]
    Monitor["Monitor price, book, history"]
    ResolveChoice{"Market resolved?"}
    Resolve["Propose, dispute, or settle"]
    Redeem["Redeem positions"]
    Portfolio["Review portfolio"]

    Start --> WalletChoice
    WalletChoice -->|injected| MetaMask
    WalletChoice -->|passkey| Circle
    MetaMask --> HasUSDC
    Circle --> HasUSDC
    HasUSDC -->|no| Faucet
    Faucet --> HasUSDC
    HasUSDC -->|yes| MarketChoice
    MarketChoice -->|browse| BrowseMarket
    MarketChoice -->|create| CreateMarket
    CreateMarket --> BrowseMarket
    BrowseMarket --> TradeChoice
    TradeChoice -->|instant liquidity| BuySell
    TradeChoice -->|limit price| LimitOrder
    BuySell --> Monitor
    LimitOrder --> Monitor
    Monitor --> ResolveChoice
    ResolveChoice -->|no| Portfolio
    ResolveChoice -->|yes| Resolve
    Resolve --> Redeem
    Redeem --> Portfolio
```

## Market Supply Business Process

```mermaid
sequenceDiagram
    actor Creator as Creator
    participant UI as Frontend
    participant API as Hono API
    participant Ops as Server deployer key
    participant Chain as Arc Testnet
    participant Store as Metadata store
    participant Users as Traders

    Creator->>UI: request new market
    UI->>API: title
    API->>API: validate length and shape
    API->>Ops: use configured PRIVATE_KEY
    Ops->>Chain: deploy market contract
    Ops->>Chain: initialize UMA request
    Ops->>Chain: deploy and seed AMM
    Ops->>Chain: deploy CLOB
    API->>Store: save address metadata
    API-->>UI: created market
    UI-->>Creator: show new market
    Users->>UI: discover market in grid
    Users->>Chain: trade or resolve
```

## Trading And Liquidity Business Process

```mermaid
flowchart TB
    Trader["Trader intent"]
    Intent{"Need"}
    Instant["Immediate execution"]
    PriceControl["Price control"]
    AMMPreview["Preview AMM output"]
    AMMApproval["Approve USDC or position token"]
    AMMTrade["Execute AMM buy or sell"]
    LimitPrice["Set limit price and size"]
    CLOBApproval["Approve escrow asset"]
    PlaceOrder["Place on-chain limit"]
    WaitBook["Wait in order book"]
    FillOrMatch{"Execution path"}
    DirectFill["Another trader fills"]
    KeeperMatch["Keeper or user matches crossed book"]
    Cancel["Maker cancels"]
    PositionUpdate["Balances and portfolio update"]

    Trader --> Intent
    Intent -->|fast trade| Instant
    Intent -->|specific price| PriceControl
    Instant --> AMMPreview
    AMMPreview --> AMMApproval
    AMMApproval --> AMMTrade
    AMMTrade --> PositionUpdate
    PriceControl --> LimitPrice
    LimitPrice --> CLOBApproval
    CLOBApproval --> PlaceOrder
    PlaceOrder --> WaitBook
    WaitBook --> FillOrMatch
    FillOrMatch -->|taker| DirectFill
    FillOrMatch -->|crossed| KeeperMatch
    FillOrMatch -->|maker exits| Cancel
    DirectFill --> PositionUpdate
    KeeperMatch --> PositionUpdate
    Cancel --> PositionUpdate
```

## Resolution Business Process

```mermaid
flowchart TB
    EventEnds["Real-world event can be judged"]
    Proposer["Participant proposes YES, NO, or UNDET"]
    Bond["Bond is approved and posted"]
    Window["Liveness window"]
    Challenge{"Challenge?"}
    NoChallenge["No dispute"]
    ChallengeYes["Disputer challenges proposal"]
    Arbitration["Mock DVM in testnet"]
    ReRequest["Market re-requests price"]
    OracleSettle["Oracle settles request"]
    MarketResolved["Market stores settlementPrice"]
    Redeem2["Users redeem positions"]
    Accounting["Portfolio and balances reflect final USDC"]

    EventEnds --> Proposer
    Proposer --> Bond
    Bond --> Window
    Window --> Challenge
    Challenge -->|no| NoChallenge
    NoChallenge --> OracleSettle
    Challenge -->|yes| ChallengeYes
    ChallengeYes --> Arbitration
    Arbitration --> ReRequest
    ReRequest --> Proposer
    OracleSettle --> MarketResolved
    MarketResolved --> Redeem2
    Redeem2 --> Accounting
```

## Operations Process

```mermaid
flowchart TB
    Dev["Developer / operator"]
    Install["bun install root, app, server deps"]
    Wallet["Generate deployer wallet"]
    Fund["Fund deployer with Arc Testnet USDC"]
    Compile["Compile contracts"]
    Deploy["Deploy UMA stack + market + AMM + CLOB"]
    Verify["Verify deployment state"]
    Sync["Sync env to app"]
    RunApi["bun run dev:api<br/>server on :8787"]
    LaunchConfig["Start app profile<br/>.claude/launch.json"]
    RunApp["bun run dev:app<br/>Vite on :5173"]
    Keeper["bun run keeper<br/>optional auto-match"]
    Monitor["Monitor transactions, logs, docs"]
    ProductionGate{"Production readiness?"}
    ControlledTestnet["Controlled testnet only"]
    Harden["Add auth, rate limits, real oracle path,<br/>slippage protection, durable DB, reviews"]

    Dev --> Install
    Install --> Wallet
    Wallet --> Fund
    Fund --> Compile
    Compile --> Deploy
    Deploy --> Verify
    Verify --> Sync
    Sync --> RunApi
    Sync --> LaunchConfig
    LaunchConfig --> RunApp
    RunApi --> Keeper
    RunApp --> Monitor
    Keeper --> Monitor
    Monitor --> ProductionGate
    ProductionGate -->|no| ControlledTestnet
    ProductionGate -->|yes| Harden
    Harden --> ProductionGate
```

## Control And Risk Process

```mermaid
flowchart LR
    Risk["Risk found"]
    Classify["Classify impact<br/>funds, oracle, key, UX, data"]
    CurrentControl["Current testnet control"]
    Gap["Production gap"]
    Owner["Assign owner"]
    Fix["Implement mitigation"]
    Verify["Test and verify"]
    Document["Update docs and roadmap"]
    Release["Release or keep gated"]

    Risk --> Classify
    Classify --> CurrentControl
    CurrentControl --> Gap
    Gap --> Owner
    Owner --> Fix
    Fix --> Verify
    Verify --> Document
    Document --> Release
```
