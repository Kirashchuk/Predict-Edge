# ADR-002: Реплатформа на технічний стек «Templars Trade» (nado-mvp)

**Status:** Accepted
**Date:** 2026-06-21
**Deciders:** Власник проєкту / команда Templars
**Контекст-репозиторії (еталон стеку):**
[nado-mvp/api](https://gitlab.com/nado-mvp/api), [nado-mvp/app](https://gitlab.com/nado-mvp/app), [nado-mvp/site](https://gitlab.com/nado-mvp/site)
**Гілка реалізації:** `feat/templars-stack`

---

## 1. Context

Predict-Edge було побудовано на стеку Circle-sample: **Next.js (App Router) + Node**, де серверна
логіка жила в Next API routes, а фронтенд — у тому ж застосунку. Завдання: **привести технічний
стек у відповідність до основного продукту команди — Templars Trade (nado-mvp)**, у якого:

- **Backend на Bun** (а не Node/Next API routes);
- окремі шари **api / app / site** (три репозиторії), кожен — самодостатній пакет;
- сувора архітектура та інструментарій (див. нижче).

Розбіжність стеків означала подвійні конвенції, неможливість шарити код/підходи з основним
продуктом і відмінний DX. ADR фіксує рішення мігрувати Predict-Edge на стек Templars.

### Еталонний стек Templars (за результатами аналізу репозиторіїв)

| Шар | Стек |
|---|---|
| **api** (backend) | **Bun** + **Hono** (`OpenAPIHono`), `Bun.serve`, Drizzle ORM + Postgres, awilix (DI), ethers v6, ioredis, pino, neverthrow, zod, OpenTelemetry/HyperDX, Scalar API docs; bun workspaces (apps/api·worker·scheduler·admin + packages/shared) |
| **app** (frontend) | **Vite 5** + **React 18** (SWC) + **Tailwind 3** + **shadcn/ui** (Radix, slate, CSS-vars) + **PWA**; wagmi/viem + @metamask/connect-evm; react-query, zustand, react-hook-form/zod, react-router; **feature-sliced** `src/{app,features/<x>,shared,styles}` |
| **site** | Astro 6 + React + Tailwind |
| **Tooling** | Bun, ESLint 9 flat + Prettier, Docker + nginx, GitLab CI |

---

## 2. Decision

Мігрувати Predict-Edge на стек Templars, зберігши **смартконтракти й деплой-тулінг без змін**:

- **Frontend → `app/`:** Vite + React 18 + Tailwind 3 + shadcn (slate) + PWA, **feature-sliced**
  (`src/app`, `src/features/{markets,trading,wallet}`, `src/shared/{ui,lib}`, `src/styles`),
  Bun як пакет-менеджер, ESLint 9 flat з архітектурним guard'ом (`no-restricted-imports`).
- **Backend → `server/`:** **Hono на Bun** (`Bun.serve` + `OpenAPIHono`), порт ендпойнтів
  `/v1/markets` (GET) і `/v1/markets` (POST create) на **ethers v6**, з pino, zod, neverthrow,
  Scalar `/docs`. Замінює Next API routes.
- **Contracts → `contracts/` + `scripts/`:** Hardhat/Solidity **без змін** (як вимагав ADR-001).
- **Корінь:** монорепо-оркестратор (`dev:app`, `dev:api`, `compile`, `deploy`, `sync-env`).

---

## 3. Options Considered

### Option A: Повна реплатформа на стек Templars (обрано)
| Dimension | Assessment |
|---|---|
| Відповідність основному продукту | High — однакові конвенції, шарінг підходів |
| DX / швидкість збірки | High — Vite/Bun значно швидші за Next dev |
| Обсяг робіт | High — переписати фронтенд-шелл + бекенд |

**Pros:** єдиний стек із Templars; Bun-бекенд як у проді; feature-sliced масштабованіша;
Vite+Bun швидкі; чисте розділення app/server/contracts.
**Cons:** одноразовий обсяг міграції; втрата Next-специфічних можливостей (SSR/RSC — не потрібні
для цього SPA).

### Option B: Залишити Next.js, лише «причесати» структуру
**Pros:** мінімум роботи. **Cons:** не виконує мету (стек ≠ Templars); зберігає Node-бекенд у Next.
**Verdict:** відхилено — суперечить цілі.

### Option C: Гібрид (Next-фронтенд + окремий Bun-бекенд)
**Pros:** Bun-бекенд швидко. **Cons:** фронтенд усе ще не на стеку Templars; два різні фронтенд-стеки
в команді. **Verdict:** відхилено.

---

## 4. Окремі рішення міграції

| # | Рішення | Обґрунтування |
|---|---|---|
| M1 | **Next API routes → Hono на Bun** (`server/`) | Заголовкова вимога цілі; ethers v6 як у nado |
| M2 | **viem-деплой у create-market → ethers v6** | Уніфікація з бекендом Templars (ethers) |
| M3 | **Прибрати Circle Passkey** (лишити wagmi injected/MetaMask) | nado-app використовує wagmi + @metamask/connect-evm, не Circle; спрощує `useContractWrite` |
| M4 | **`NEXT_PUBLIC_*` → `VITE_*`** (`import.meta.env`) | Vite-конвенція; скрипт `sync-env.ts` мостить root `.env.local` → `app/.env.local` |
| M5 | **Feature-sliced + ESLint guard** | Точна копія архітектури nado-app (`no-restricted-imports`) |
| M6 | **Контракти/Hardhat без змін** | ADR-001: не міняти логіку; деплой уже відтворюваний |
| M7 | **shadcn-примітиви → `shared/ui/primitives`** | Як у nado (не `@/components/ui`) |

---

## 5. Consequences

**Що стало краще:**
- Єдиний стек і конвенції з Templars Trade; код/паттерни переносні між проєктами.
- Швидший DX: Vite dev ~0.3s, Bun install/тест.
- Чисте розділення `app/` (Vite) ↔ `server/` (Hono/Bun) ↔ `contracts/` (Hardhat).
- Bun-бекенд з OpenAPI/Scalar-документацією «з коробки».

**Що складніше / на що зважати:**
- Втрата SSR/RSC (не потрібні для SPA-дашборда).
- Circle Passkey прибрано — лише injected-гаманець (MetaMask). За потреби повертається окремим
  feature-модулем.
- Серверний `PRIVATE_KEY` у create-market лишається межею довіри (як в ADR-001 / risks-and-security).

**Що переглянути далі:**
- Додати Drizzle+Postgres та awilix-DI у `server/`, якщо знадобиться персистентність понад
  `data/markets.json`.
- Винести спільні типи в `packages/shared` (як у nado) при зростанні.
- Astro-`site/` за потреби маркетинг-сторінки.

---

## 6. Verification (виконано на цій гілці)

| Крок | Результат |
|---|---|
| `cd server && bun install` | 56 packages ✅ |
| `server` typecheck | EXITCODE=0 ✅ |
| `server` runtime | `/health` 200, `/v1/markets` `[]`, `/openapi.json` 200 ✅ |
| `cd app && bun install` | 584 packages ✅ |
| `app` `bun run build` (Vite) | 2976 modules, PWA згенеровано ✅ |
| `app` `bun run typecheck` (`tsc -b`) | EXITCODE=0 ✅ |
| `app` dev (Vite) | `http://localhost:5173` 200 ✅ |
| `sync-env.ts` | адреси → `app/.env.local` (VITE_) ✅ |
| `hardhat compile` (контракти без змін) | EXITCODE=0 ✅ |

---

## 7. Action Items

1. [x] Створити `server/` (Hono/Bun) — порт `/v1/markets` GET+POST на ethers v6.
2. [x] Створити `app/` (Vite, feature-sliced) — markets/trading/wallet.
3. [x] Тулінг: ESLint 9 flat (+architecture guard), Prettier, Docker+nginx, PWA.
4. [x] `sync-env.ts`; root монорепо-скрипти.
5. [x] Прибрати Next.js-файли; зберегти контракти/Hardhat.
6. [ ] (Далі) Drizzle+Postgres / awilix у `server/` за потреби.
7. [ ] (Далі) GitLab CI / docker-compose dev·prod (як у nado).
8. [ ] (Далі) Опційно повернути Circle Passkey як окремий feature.

> Пов'язано: [ADR-001-architecture.md](ADR-001-architecture.md),
> [tech-stack.md](tech-stack.md), [risks-and-security.md](risks-and-security.md).
</content>
