# Ризики та безпека

Розділ покриває загрози й мітигації для тестнет-проєкту: oracle manipulation, AMM
liquidity/slippage, reentrancy, ключі деплоєра та межі тестнет-середовища. Класифікація:
🔴 high · 🟠 medium · 🟡 low (у контексті **тестнету**; для мейннету пріоритети зростають).

> Межі довіри візуалізовано в [smart-contract-map.md](smart-contract-map.md) §4.

---

## 1. Маніпуляція оракулом (Oracle manipulation)

| Загроза | Рівень | Опис | Мітигація |
|---|---|---|---|
| Фальшива пропозиція результату | 🟠 | Будь-хто може `proposePrice` хибне значення | Optimistic-модель: dispute-вікно (`liveness`) + proposerBond (100 ARCT) — диспутер забирає бонд хибного proposer-а |
| Короткий liveness | 🔴 (на тестнеті свідомо) | `marketLiveness = 60s` замало, щоб чесні учасники встигли оскаржити | Для production підняти до годин/днів; параметр у `CONFIG.marketLiveness` |
| Mock DVM як арбітр | 🔴 (тестнет) | `MockOracleAncillary` — admin `pushPrice`, а не реальне голосування DVM | Лише тестнет; перед production — реальний UMA DVM / офіційний OO-деплой |
| Stale/невідповідні callbacks | 🟡 | Підробка `priceSettled`/`priceDisputed` | Контракт вимагає `msg.sender == OO`, звіряє `identifier`, `ancillaryData`, ігнорує чужий `timestamp` |
| Маніпуляція ancillaryData | 🟡 | Невідповідне питання | `keccak256(ancillaryData) == keccak256(customAncillaryData)` у callback-ах |

**Підсумок:** автономний шлях безпечний від підробки callback-ів; головний залишковий ризик —
**тестнет Mock DVM** і **короткий liveness** (свідомі спрощення, ADR D3).

---

## 2. AMM: ліквідність і проковзування (Liquidity / Slippage)

| Загроза | Рівень | Опис | Мітигація |
|---|---|---|---|
| Slippage на великих ордерах | 🟠 | `x*y=k` дає велике проковзування при тонкій ліквідності (seed лише 1000 ARCT) | `calcBuy*/calcSell*` прев'ю перед tx; збільшити seed; (рекомендація) додати `minOut`/deadline захист |
| Відсутність slippage-guard | 🟠 | У `buyYes/sellYes` немає `minAmountOut` → вразливість до фронтрану/сендвіча | **Рекомендація** (pre-prod): додати параметр `minOut` і перевірку |
| Impermanent loss для seed-LP | 🟡 | Deployer-LP несе IL при русі ймовірності | Тестнет — кошти без вартості; для prod — економіка LP/винагороди |
| Ділення/округлення | 🟡 | Цілочисельне ділення у формулах | 18-decimal токени; малі залишки, не критично на тестнеті |
| Торгівля після резолюції | 🟡 | Спроба торгувати завершеним ринком | `whenActive` блокує, якщо `receivedSettlementPrice` |

**Ключова рекомендація:** перед будь-яким production додати **slippage-protection (`minOut` + deadline)**
у торгові методи AMM — зараз їх немає.

---

## 3. Reentrancy та безпека контрактів

| Аспект | Статус | Деталь |
|---|---|---|
| Reentrancy guard | ✅ | `PredictionMarketAMM` успадковує `ReentrancyGuard`; усі торги `nonReentrant` |
| SafeERC20 | ✅ | `SafeERC20` для трансферів/approve у market і AMM |
| External call ordering | 🟡 | AMM оновлює `reserves` навколо зовнішніх `create/redeem`; guard покриває, але **CEI** не скрізь ідеальний — варто рев'ю при змінах |
| Mint/burn авторизація | ✅ | Тільки market є minter/burner PLT/PST (`addMinter/addBurner` у конструкторі) |
| Безмежні approve | 🟡 | AMM робить `approve(market, max)` на колатераль/PLT/PST — зручно, але широкий дозвіл |
| Цілочисельне переповнення | ✅ | Solidity 0.8.17 — вбудована перевірка overflow |

**Рекомендація:** при будь-якій зміні логіки — формальне рев'ю CEI-патерну та тести
інваріантів AMM (`reserveYes+reserveNo`, ціни YES+NO=1).

---

## 4. Ключі деплоєра та серверна межа довіри 🔴

| Загроза | Рівень | Опис | Мітигація |
|---|---|---|---|
| Витік `PRIVATE_KEY` | 🔴 | Ключ у `.env.local`; компрометація = повний контроль над деплоєром | `.gitignore` виключає `.env*`; **ніколи** не комітити; лише `.env.example`; на тестнеті — окремий «гарячий» ключ без цінності |
| Серверний ключ у `/api/create-market` | 🔴 | API підписує деплої серверним ключем; **немає auth/rate-limit** | Кожен POST витрачає газ/ARCT деплоєра. **Pre-prod:** auth + rate-limit, або клієнтський деплой з гаманця користувача |
| Мейннет-ключ помилково | 🔴 | Використання реального ключа/мережі | Працювати **лише** в Arc Testnet; окремий гаманець; нульовий баланс мейннету |
| Raw PK замість HD/KMS | 🟠 | Один ключ, без ротації | Pre-prod: KMS/HSM або mnemonic/HD (ADR D4) |

**Найкритичніше для цього sample:** `/api/create-market` — публічний ендпойнт, що деплоїть
контракти **серверним ключем** без захисту. На тестнеті прийнятно; перед будь-яким відкритим
деплоєм — обов'язково закрити (ADR Action Item #8).

---

## 5. Межі тестнет-середовища

| Обмеження | Наслідок |
|---|---|
| `MockOracleAncillary` ≠ реальний DVM | Резолюція диспутів керована admin-ом — **не** децентралізована |
| ARCT вільно мінтиться (`allocateTo`) | Нульова реальна вартість; немає sybil-захисту економікою |
| `Store` fees = 0 | Немає реальної економіки оракула |
| `liveness = 60s` | Нереалістично для чесного оскарження |
| Газовий USDC з faucet | Без реальної вартості; rate-limit faucet |
| Circle bundler/paymaster | Зовнішня залежність; відмова → passkey-tx недоступні |
| Демо-ринки зі статичними цінами | Лише BTC100K — реальний on-chain; решта в `lib/markets.ts` — статичні |

---

## 6. Підсумкова матриця та дії

| # | Ризик | Рівень (тестнет) | Дія |
|---|---|---|---|
| R1 | Серверний ключ у create-market | 🔴 | Pre-prod: auth + rate-limit / клієнтський деплой |
| R2 | Mock DVM + короткий liveness | 🔴 | Pre-prod: реальний UMA DVM; realistic liveness |
| R3 | Витік PRIVATE_KEY | 🔴 | Не комітити; окремий тестнет-ключ; KMS для prod |
| R4 | AMM без slippage-guard | 🟠 | Pre-prod: `minOut` + deadline |
| R5 | Mintable ARCT як колатераль | 🟠 | Pre-prod: реальний колатераль, прибрати mint |
| R6 | Тонка ліквідність / slippage | 🟠 | Більший seed; прев'ю-розрахунки |
| R7 | CEI/approve-max нюанси | 🟡 | Рев'ю + інваріант-тести при змінах |

**Загальний висновок:** автономна частина (AMM ↔ market ↔ OO) спроєктована розумно
(reentrancy-guard, авторизовані callbacks, SafeERC20, Solidity 0.8). Основні ризики —
**операційні/тестнетні**: серверний ключ деплоєра, Mock DVM, відсутність slippage-guard і
mintable-колатераль. Усі вони — свідомі тестнет-компроміси, зафіксовані в
[ADR-001](ADR-001-architecture.md) як обов'язкові до перегляду перед production.
</content>
