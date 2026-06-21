# ADR-001: Архітектура тестнет-проєкту «Prediction Market на Arc»

**Status:** Accepted (для тестнет-середовища)
**Date:** 2026-06-21
**Deciders:** Архітектор проєкту / deployer (некастодіальний гаманець), рев'ювери Circle sample-коду
**Базовий код:** [circlefin/arc-prediction-markets](https://github.com/circlefin/arc-prediction-markets) (Apache-2.0)
**Мережа:** Arc Testnet (Circle, stablecoin-native L1), Chain ID `5042002`, нативний gas = USDC

---

## 1. Context

Потрібно розгорнути та задокументувати **децентралізований ринок прогнозів** (binary YES/NO)
на **Arc Testnet** на базі опенсорс-коду Circle. Ключові сили/обмеження:

- **Мережа Arc** — stablecoin-native L1, де **газ платиться нативним USDC** (немає окремого ETH-подібного активу).
  UMA-оракул-інфраструктура офіційно **не задеплоєна** на Arc, тому її треба бутстрапити самостійно.
- **Резолюція має бути недовіреною** (не через owner-а контракту), щоб ринок був credibly neutral.
- **Безперервна торгівля** позиційними токенами без потреби в order-book / маркет-мейкерах.
- **Дві категорії користувачів:** ті, хто має EVM-розширення (MetaMask), і ті, хто хоче
  безкастодіальний UX без розширення (Circle Passkey / WebAuthn, smart account).
- **Обмеження середовища:** лише тестнет; жодних мейннет-ключів і реальних коштів;
  секрети не комітяться; логіку контрактів спершу запускаємо as-is.
- **Час/прозорість:** рішення мають бути відтворюваними «з нуля» за документом.

Цей ADR фіксує **сукупність архітектурних рішень**, успадкованих із sample-коду Circle,
з явним переліком альтернатив і trade-offs — щоб майбутні зміни приймались усвідомлено.

---

## 2. Decision (стисло)

Прийнято архітектуру з **п'яти шарів**, успадковану від Circle sample, **без зміни логіки контрактів**:

1. **Контракти (Solidity 0.8.17, Hardhat):** `EventBasedPredictionMarket` (життєвий цикл) +
   `PredictionMarketAMM` (constant-product, 2% fee), що працюють поверх **UMA Optimistic Oracle V2**.
2. **Резолюція:** UMA OO V2 у **event-based** режимі (propose → dispute → settle) з
   `MockOracleAncillary` як DVM-замінником на тестнеті.
3. **Колатераль:** `TestnetERC20` (ARCT, 18 decimals) — вільно мінтиться (faucet), окремо від
   нативного газового USDC.
4. **Frontend:** Next.js (App Router) + Wagmi/Viem; абстракція двох типів гаманців через єдиний
   хук `useContractWrite`.
5. **Bootstrap UMA:** імперативний `scripts/deploy.ts` деплоїть Timer/Finder/IdentifierWhitelist/
   AddressWhitelist/Store/MockOracleAncillary/OptimisticOracleV2 + ARCT, реєструє все у Finder,
   ініціалізує ринок і сідить AMM.

Окремі рішення з альтернативами розглянуто нижче (D1–D7).

---

## 3. Options Considered

### D1. Механізм резолюції результату ринку

#### Option A: UMA Optimistic Oracle V2 (обрано)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — треба бутстрапити Finder/whitelists/OO/DVM-замінник |
| Cost | Low на тестнеті (fees=0 у Store, ARCT безкоштовний) |
| Trust model | Optimistic, **недовірений**: будь-хто proposes; dispute → DVM |
| Decentralization | High — немає owner-резолвера |

**Pros:** credibly neutral; стандарт індустрії для prediction markets; event-based режим
дозволяє кілька раундів диспутів; готові інтерфейси в `@uma/core`.
**Cons:** на Arc немає рідної UMA → треба деплоїти весь стек; на тестнеті DVM замінено
`MockOracleAncillary` (admin push price) — не реальний consensus.

#### Option B: Централізований owner/resolver (multisig або EOA викликає `resolve`)
**Pros:** просто, дешево, миттєво.
**Cons:** довірена сторона; суперечить суті prediction market; ризик маніпуляції/цензури.
**Verdict:** відхилено — ламає недовіреність.

#### Option C: Chainlink / зовнішній price feed
**Pros:** надійні дані для цінових подій.
**Cons:** покриває лише цінові, не довільні YES/NO-питання; не задеплоєний на Arc;
не вирішує «суб'єктивні» події.
**Verdict:** відхилено для загального YES/NO-кейсу.

---

### D2. Торговий механізм (ліквідність позиційних токенів)

#### Option A: Вбудований constant-product AMM `x*y=k` (обрано)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low–Medium — один контракт, прості формули |
| Capital efficiency | Medium — є проковзування/slippage |
| UX | High — миттєва ліквідність, ціна = ймовірність |

**Pros:** безперервна ліквідність без order-book; ціна YES = `reserveNo/(reserveYes+reserveNo)`
читається як ймовірність; ціни YES+NO завжди = 1.00; 2% swap fee як стимул для LP.
**Cons:** slippage на великих ордерах; impermanent-loss для seed-ліквідності; mint+swap робить
ефективну ціну купівлі нелінійною.

#### Option B: Central Limit Order Book (CLOB)
**Pros:** краще ціноутворення, менший slippage при глибокій книзі.
**Cons:** потребує маркет-мейкерів і off-chain інфраструктури; дорого/складно on-chain.
**Verdict:** відхилено для тестнет-демо.

#### Option C: LMSR (Logarithmic Market Scoring Rule)
**Pros:** обмежений збиток оператора, гладке ціноутворення.
**Cons:** складніша математика, потреба в subsidy; зайве для sample.
**Verdict:** відхилено — надлишкова складність.

---

### D3. Bootstrap UMA-інфраструктури на Arc

#### Option A: Деплой повного UMA-стека через `scripts/deploy.ts` (обрано)
**Pros:** самодостатньо; працює на будь-якому EVM-чейні без рідної UMA; повний контроль над
параметрами (liveness, bond, fees=0).
**Cons:** `MockOracleAncillary` ≠ реальний DVM (немає голосування токенхолдерів);
довіра до admin, який пушить ціну в диспуті; багато контрактів = довший деплой.

#### Option B: Чекати/використати офіційний UMA-деплой на Arc
**Cons:** його немає — UMA задеплоєна лише на Ethereum/Polygon/Optimism/Arbitrum/Base/Blast/Story/
Avalanche (+ окремі тестнети). **Verdict:** неможливо зараз.

---

### D4. Деплой-фреймворк і керування ключем деплоєра

#### Option A: Імперативний `deploy.ts` + **raw private key** (обрано в цій гілці)
| Dimension | Assessment |
|-----------|------------|
| Dependencies | Менше — без `@uma/common`, `hardhat-deploy` |
| Setup | Простий — один ключ, один скрипт |
| Reproducibility | Medium — один деплоєр, без HD-derivation |

**Pros:** мінімум залежностей; прозорий лінійний скрипт; легко читати/міняти.
**Cons:** немає декларативного multi-step фреймворку; немає HD-derivation; для multi-chain/
production менш зручно.

#### Option B: Mnemonic + `hardhat-deploy` (як в офіційному UMA-туторіалі)
**Pros:** декларативні міграції, HD-гаманці, реюз кроків.
**Cons:** більше залежностей, складніший setup для single-deployer тестнету.
**Verdict:** залишено як рекомендацію для production (див. Action Items).

> Це рішення **успадковане** із sample-коду; задокументоване тут, бо змінює модель ключів
> (raw PK замість mnemonic) — а ключі деплоєра є межею довіри (див. D7 і розділ ризиків).

---

### D5. Підтримка гаманців (wallet strategy)

#### Option A: Dual-wallet — MetaMask (injected) + Circle Passkey (WebAuthn/smart account), абстраговані `useContractWrite` (обрано)
| Dimension | Assessment |
|-----------|------------|
| UX reach | High — і «крипто-нативні», і користувачі без розширення |
| Complexity | Medium — два кодові шляхи (EOA tx vs UserOperation) |
| Coupling | Low — абстраговано одним хуком |

**Pros:** Circle passkey = біометрія/WebAuthn без розширення, smart account з paymaster
(газ-абстракція); MetaMask = звичний EVM-флоу; компоненти не знають про різницю.
**Cons:** два шляхи підпису (UserOp через bundler vs `writeContractAsync`); passkey **не**
експонує приватний ключ → **не годиться для деплою** (деплой лише з некастодіального EOA).

#### Option B: Лише MetaMask / injected
**Pros:** простіше. **Cons:** відсікає користувачів без розширення; немає газ-абстракції.

#### Option C: Лише Circle Passkey
**Cons:** не можна деплоїти контракти; залежність від Circle-інфраструктури.
**Verdict:** dual — найкращий баланс охоплення й гнучкості.

---

### D6. Створення кастомних ринків (server-side деплой)

#### Option A: API-роут `/api/create-market` деплоїть пару контрактів із серверним `PRIVATE_KEY` (обрано в sample)
**Pros:** користувач створює ринок «у кілька кліків» без газу/деплою на своєму боці; seed-ліквідність
автоматично.
**Cons:** **сервер тримає ключ деплоєра** → серверна межа довіри; будь-який POST витрачає
ARCT/газ деплоєра; немає rate-limit/авторизації в sample. **Це ключовий ризик** (див. розділ ризиків).

#### Option B: Клієнтський деплой із гаманця користувача
**Pros:** немає серверного ключа; користувач платить власний газ.
**Cons:** складніший UX; passkey-користувачі не можуть деплоїти контракти напряму так само зручно.
**Verdict:** для production — винести за auth/rate-limit або перейти на клієнтський деплой
(Action Items).

---

### D7. Колатераль і газовий актив

#### Рішення: розділити **газ (нативний USDC)** і **колатераль (ARCT, TestnetERC20)** (обрано)
**Pros:** ARCT вільно мінтиться через faucet/`allocateTo` → зручне тестування; газ окремо в USDC
з Circle faucet; whitelisting колатералю через UMA `AddressWhitelist`.
**Cons:** ARCT не має реальної вартості → **не для production**; потрібен реальний колатераль-токен
(напр. справжній USDC) для мейннету.

---

## 4. Trade-off Analysis (ключове)

| Напрям | Обрано | Головний trade-off |
|---|---|---|
| Резолюція | UMA OO V2 (optimistic) | Недовіреність ↔ складність bootstrap + Mock DVM на тестнеті |
| Торгівля | Constant-product AMM | Проста миттєва ліквідність ↔ slippage / IL |
| Деплой | Imperative + raw PK | Простота/менше залежностей ↔ немає HD/декларативності |
| Гаманці | Dual + `useContractWrite` | Широке охоплення ↔ два шляхи підпису |
| Custom markets | Server-side ключ | Зручний UX ↔ серверна межа довіри (ключ) |
| Колатераль | ARCT (mintable) | Легке тестування ↔ нульова реальна вартість |

**Наскрізна нитка:** sample оптимізований під **demoability на тестнеті**, а не під production-security.
Усі «зрізані кути» (Mock DVM, mintable collateral, серверний ключ, 1-хв liveness, fees=0) —
свідомі тестнет-спрощення, які треба переглянути перед будь-яким мейннетом.

---

## 5. Consequences

**Що стає простіше:**
- Відтворюваний деплой «з нуля» одним скриптом; усі адреси пишуться в `.env.local`.
- Недовірена резолюція без owner-а; будь-хто може proposes/disputes/settle.
- Однаковий UX для обох гаманців; компоненти не залежать від типу гаманця.
- Безперервна торгівля та читабельна ймовірність із цін AMM.

**Що стає складніше / на що зважати:**
- На тестнеті резолюція диспутів спирається на `MockOracleAncillary` (admin), а не на реальний DVM.
- Серверний `PRIVATE_KEY` у `/api/create-market` — критична межа довіри; потрібні захисти.
- AMM має проковзування й IL; ціна купівлі нелінійна (mint+swap).
- 64-hex raw private key у `.env.local` — суворо не комітити; лише `.env.example` у git.

**Що доведеться переглянути (revisit) перед production:**
- Замінити `MockOracleAncillary` на реальний UMA DVM / офіційний деплой OO.
- Замінити ARCT на реальний колатераль; прибрати вільний mint.
- Винести створення ринків за auth/rate-limit або клієнтський деплой.
- Переглянути liveness (1 хв → реалістичні години/дні), bond-економіку, fees у Store.
- Перейти на mnemonic/HD або KMS/HSM для ключів деплоєра.

---

## 6. Action Items

1. [x] Склонувати репозиторій у `C:\arc predict Edge`, зберегти структуру.
2. [x] `npm install`, `npm run compile` — зафіксувати версії/помилки (див. розділ нижче / deployment-plan).
3. [x] Задокументувати компонентну/C4-діаграму — `docs/architecture-diagram.md`.
4. [x] Скласти карту контрактів і межі довіри — `docs/smart-contract-map.md`.
5. [x] Підготувати відтворюваний план деплою в Arc Testnet — `docs/deployment-plan.md`.
6. [x] Виокремити розділ ризиків і безпеки — `docs/risks-and-security.md`.
7. [ ] (Pre-prod) Замінити Mock DVM на реальний UMA-оракул; прибрати mintable-колатераль.
8. [ ] (Pre-prod) Захистити `/api/create-market` (auth, rate-limit) або клієнтський деплой.
9. [ ] (Pre-prod) Винести ключ деплоєра в KMS/HSM; розглянути mnemonic/HD-derivation.
10. [ ] Додати юніт/інтеграційні тести (`npm run test:contracts`) для lifecycle і AMM-інваріантів.

---

## 7. Notes (зафіксовані факти середовища)

- Solidity `0.8.17`, optimizer `runs=1_000_000` (`hardhat.config.ts`).
- Контракти `EventBasedPredictionMarket.sol` / `PredictionMarketAMM.sol` — ліцензія **AGPL-3.0-only**;
  решта (scripts, lib, config) — **Apache-2.0** (Circle).
- Параметри ринку за замовчуванням (deploy.ts): liveness `60s`, proposerReward `10 ARCT`,
  proposerBond `100 ARCT`, AMM fee `200 bps (2%)`, seed `1000 ARCT`, deployer mint `100000 ARCT`.
- Resolution values: `1e18`=YES, `0`=NO, `5e17`=Undetermined.
- RPC за замовчуванням: `https://rpc.testnet.arc.network`; explorer: `https://testnet.arcscan.app`.

> Пов'язані документи: [architecture-diagram.md](architecture-diagram.md),
> [smart-contract-map.md](smart-contract-map.md), [deployment-plan.md](deployment-plan.md),
> [risks-and-security.md](risks-and-security.md), [ROADMAP.md](ROADMAP.md).
</content>
</invoke>
