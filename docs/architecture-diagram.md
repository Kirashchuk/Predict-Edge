# Архітектурна діаграма — Prediction Market на Arc Testnet

Документ містить **C4-діаграми** (Context → Container → Component) і **потоки даних** для чотирьох
сценаріїв: *create market*, *trade*, *resolve*, *redeem*. Усі діаграми — у Mermaid (рендеряться на
GitHub та у VS Code з відповідним розширенням).

> Легенда меж довіри (trust boundaries) і деталі функцій — у [smart-contract-map.md](smart-contract-map.md).

---

## 1. C4 Level 1 — System Context

```mermaid
graph TB
    User([Користувач<br/>трейдер / proposer / creator])
    Deployer([Deployer<br/>некастодіальний EOA])

    subgraph "Prediction Market on Arc (тестнет-система)"
        APP[Next.js dApp<br/>+ Smart Contracts]
    end

    Circle[Circle Faucet<br/>тестовий USDC на газ]
    CircleW[Circle Modular Wallets<br/>passkey / bundler / paymaster]
    Arc[(Arc Testnet L1<br/>chainId 5042002<br/>gas = USDC)]
    Arcscan[Arcscan<br/>explorer]

    User -->|торгує, proposes, disputes, settle, redeem| APP
    Deployer -->|деплоїть контракти, сідить ліквідність| APP
    User -->|отримує USDC на газ| Circle
    APP -->|MetaMask injected / Circle passkey UserOp| CircleW
    APP -->|read/write tx| Arc
    CircleW -->|bundles UserOp, спонсорує газ| Arc
    User -->|перевіряє tx/адреси| Arcscan
```

---

## 2. C4 Level 2 — Containers

```mermaid
graph TB
    subgraph Browser["Браузер користувача"]
        UI[Next.js App Router UI<br/>React 19 + Tailwind + shadcn/ui]
        WAGMI[Wagmi + Viem<br/>config: arcTestnet]
        WCTX[WalletContext<br/>dual-wallet state]
    end

    subgraph Server["Next.js сервер (Node)"]
        APIM[/api/markets<br/>GET список ринків/]
        APIC[/api/create-market<br/>POST деплой пари контрактів/]
        DATA[(data/markets.json)]
        ENV[[.env.local<br/>PRIVATE_KEY + адреси]]
    end

    subgraph Chain["Arc Testnet (chainId 5042002)"]
        MKT[EventBasedPredictionMarket]
        AMM[PredictionMarketAMM]
        TOKENS[ARCT / Long PLT / Short PST]
        UMA[UMA-стек:<br/>OO V2, Finder, Whitelists,<br/>Store, MockOracle, Timer]
    end

    CircleInfra[Circle Modular Wallets<br/>passkey transport + bundler + paymaster]

    UI --> WAGMI --> Chain
    UI --> WCTX
    WCTX -->|circle UserOp| CircleInfra --> Chain
    UI -->|fetch| APIM --> DATA
    UI -->|fetch| APIC
    APIC -->|viem walletClient<br/>підпис PRIVATE_KEY| Chain
    APIC --> ENV
    APIC --> DATA
    AMM --> MKT --> UMA
    MKT --> TOKENS
```

---

## 3. C4 Level 3 — Components (frontend hooks ↔ контракти)

```mermaid
graph LR
    subgraph Hooks["hooks/"]
        UCW[useContractWrite<br/>єдина абстракція запису]
        UMS[useMarketState / useMarketActions]
        UOS[useOracleState / useOracleActions]
        UAS[useAMMState / useAMMTrade / useAMMCalc / useAMMApprovals]
        UTB[useTokenBalances]
    end

    subgraph Lib["lib/"]
        ABIS[contracts/abis/*<br/>market, amm, oracle, erc20, timer]
        ADDR[contracts/addresses.ts<br/>з env vars]
        CHAIN[chain.ts / wagmi.ts]
        CIRCLE[circle.ts<br/>passkey transport, gas estimate]
    end

    subgraph Contracts["Arc Testnet"]
        MKT[EventBasedPredictionMarket]
        AMM[PredictionMarketAMM]
        OO[OptimisticOracleV2]
        ERC[ARCT / PLT / PST]
    end

    UMS --> UCW
    UOS --> UCW
    UAS --> UCW
    UCW -->|injected: writeContractAsync| MKT
    UCW -->|injected| AMM
    UCW -->|circle: sendUserOperation + paymaster| AMM
    UOS --> OO
    UTB --> ERC
    UCW --> ABIS
    UCW --> ADDR
    UCW --> CIRCLE
    UAS --> AMM
    UMS --> MKT
```

`useContractWrite` — ключова точка абстракції: для `walletType === "circle"` формує **UserOperation**
через bundler з `paymaster: true` (газ спонсорується), інакше — звичайний `writeContractAsync` (MetaMask/injected).

---

## 4. Потоки даних (sequence)

### 4.1 Create market (server-side деплой кастомного ринку)

```mermaid
sequenceDiagram
    actor U as Користувач
    participant UI as CreateMarketDialog
    participant API as /api/create-market
    participant DK as Deployer key (.env.local)
    participant CH as Arc Testnet
    participant DB as data/markets.json

    U->>UI: вводить YES/NO питання
    UI->>API: POST { title }
    API->>DK: privateKeyToAccount(PRIVATE_KEY)
    API->>CH: (за потреби) ARCT.allocateTo(deployer)
    API->>CH: deploy EventBasedPredictionMarket(question, ARCT, finder, timer, reward, liveness, bond)
    API->>CH: ARCT.approve(market, reward) + market.initializeMarket()
    Note over CH: market → OO.requestPrice(YES_OR_NO_QUERY)
    API->>CH: deploy PredictionMarketAMM(market, 200bps)
    API->>CH: ARCT.approve(amm, 1000) + amm.initialize(1000)
    Note over CH: amm → market.create(1000) → mint 1000 PLT+PST, reserves=1000/1000
    API->>DB: append { address, ammAddress, title }
    API-->>UI: { success, market }
```

### 4.2 Trade — Buy YES через AMM

```mermaid
sequenceDiagram
    actor U as Користувач
    participant UI as BuyTab
    participant H as useAMMTrade / useContractWrite
    participant AMM as PredictionMarketAMM
    participant MKT as EventBasedPredictionMarket
    participant T as ARCT / PLT / PST

    U->>UI: вводить суму USDC(ARCT), бачить calcBuyYes preview
    UI->>H: approve ARCT → AMM (за потреби)
    UI->>H: buyYes(amount)
    H->>AMM: tx (injected) або UserOp (circle + paymaster)
    AMM->>T: ARCT.transferFrom(user, amm, amount)
    AMM->>MKT: create(amount)  %% mint amount PLT + amount PST до AMM
    MKT->>T: mint PLT, PST → AMM
    Note over AMM: swap No→Yes за x*y=k, fee 2%<br/>reserveYes -= swapYesOut; reserveNo += amount
    AMM->>T: PLT.transfer(user, amount + swapYesOut)
    AMM-->>U: подія BuyYes(user, amount, yesOut)
```

### 4.3 Resolve — Propose → (Dispute) → Settle через UMA OO V2

```mermaid
sequenceDiagram
    actor P as Proposer
    actor D as Disputer (опційно)
    participant UI as ResolveTab
    participant OO as OptimisticOracleV2
    participant MKT as EventBasedPredictionMarket
    participant DVM as MockOracleAncillary (DVM-замінник)

    Note over MKT,OO: initializeMarket() вже зробив requestPrice (event-based, callbacks on)
    P->>OO: proposePrice(1e18=YES | 0=NO | 5e17=Undet) + bond
    alt Немає диспуту протягом liveness (60s)
        P->>OO: settle()
        OO->>MKT: priceSettled(identifier, ts, ancillary, price)
        Note over MKT: settlementPrice = 1e18|5e17|0<br/>receivedSettlementPrice = true
    else Диспут протягом liveness
        D->>OO: disputePrice() + matching bond
        OO->>MKT: priceDisputed(...)  %% callback
        MKT->>OO: re-requestPrice(new timestamp)  %% event-based: нова ітерація
        OO->>DVM: ескалація на DVM
        Note over DVM: admin pushPrice (тестнет-замінник голосування)
        P->>OO: settle() після резолюції DVM
        OO->>MKT: priceSettled(...)
    end
```

### 4.4 Redeem — отримання колатералю після резолюції

```mermaid
sequenceDiagram
    actor U as Користувач
    participant UI as RedeemSection
    participant MKT as EventBasedPredictionMarket
    participant T as ARCT / PLT / PST

    Note over MKT: receivedSettlementPrice == true, settlementPrice ∈ {0, 5e17, 1e18}
    U->>UI: settle(longTokens, shortTokens)
    UI->>MKT: settle(longAmt, shortAmt)
    MKT->>T: PLT.burnFrom(user, longAmt)
    MKT->>T: PST.burnFrom(user, shortAmt)
    Note over MKT: long*settlementPrice/1e18 + short*(1e18-settlementPrice)/1e18
    MKT->>T: ARCT.transfer(user, collateralReturned)
    MKT-->>U: подія PositionSettled
```

> Альтернатива до резолюції: `redeem(n)` спалює рівну пару PLT+PST і повертає `n` ARCT 1:1.

---

## 5. Збірна компонентна схема (frontend ↔ контракти ↔ UMA ↔ AMM ↔ гаманці)

```mermaid
graph TB
    subgraph FE["Frontend (Next.js)"]
        PAGES[page.tsx / market/address/page.tsx]
        TRADE[TradingPanel: Buy/Sell/Resolve]
        ACT[MarketActions: Approve/Create/Redeem/Settle]
        WALLET[ConnectDialog: MetaMask | Circle Passkey]
        HOOKS[hooks: market / amm / oracle]
        UCW[useContractWrite]
    end

    subgraph WAL["Гаманці"]
        MM[MetaMask injected EOA]
        CP[Circle Passkey smart account<br/>+ bundler + paymaster]
    end

    subgraph CORE["Контракти ринку"]
        AMM[PredictionMarketAMM<br/>x*y=k, 2% fee]
        MKT[EventBasedPredictionMarket<br/>lifecycle + OO callbacks]
        PLT[Long PLT]
        PST[Short PST]
        ARCT[ARCT collateral]
    end

    subgraph UMAINF["UMA-інфраструктура"]
        OO[OptimisticOracleV2]
        FIND[Finder]
        IDW[IdentifierWhitelist]
        ADW[AddressWhitelist]
        STORE[Store fees=0]
        MOCK[MockOracleAncillary DVM]
        TIMER[Timer]
    end

    PAGES --> TRADE --> HOOKS
    PAGES --> ACT --> HOOKS
    WALLET --> UCW
    HOOKS --> UCW
    UCW --> MM
    UCW --> CP
    MM --> AMM
    MM --> MKT
    MM --> OO
    CP --> AMM
    CP --> MKT
    AMM --> MKT
    MKT --> PLT
    MKT --> PST
    MKT --> ARCT
    MKT --> OO
    OO --> FIND
    FIND --> IDW
    FIND --> ADW
    FIND --> STORE
    FIND --> MOCK
    OO --> MOCK
    MKT --> TIMER
```

---

## 6. Як рендерити

- **GitHub** рендерить Mermaid у `.md` автоматично.
- **VS Code:** розширення *Markdown Preview Mermaid Support*.
- **Експорт у PNG/SVG:** [mermaid.live](https://mermaid.live) або `@mermaid-js/mermaid-cli`
  (`npx -p @mermaid-js/mermaid-cli mmdc -i architecture-diagram.md -o out.svg`).
</content>
