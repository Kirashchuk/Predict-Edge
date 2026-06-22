# Задеплоєні контракти — Arc Testnet

**Мережа:** Arc Testnet (chainId `5042002`) · **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)
**Деплоєр:** `0x72CA27CC843373671DaA8F4876C36aa84ee74A3E`
**Колатераль:** **USDC** (нативний ERC-20, 6 decimals) — `0x3600000000000000000000000000000000000000`

> Це публічні адреси (безпечно в git). Приватний ключ — лише в `.env.local`.

## Ринок (USDC-колатераль)

| Контракт | Адреса |
|---|---|
| EventBasedPredictionMarket (BTC100K) | [`0x45f03Ee08C61A1319Ee672E7312127e37CC894af`](https://testnet.arcscan.app/address/0x45f03Ee08C61A1319Ee672E7312127e37CC894af) |
| PredictionMarketAMM | [`0xA4E18fFf8E551A81a54DD1d9F45c7Bb7e396d690`](https://testnet.arcscan.app/address/0xA4E18fFf8E551A81a54DD1d9F45c7Bb7e396d690) |

## Токени

| Токен | Адреса |
|---|---|
| **USDC** (колатераль, ERC-20, 6 dec) | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |
| Long Token (PLT / YES) | `0xd33813B05D9d718BD7A0E07F7C9Fb68c12B4Ed07` |
| Short Token (PST / NO) | `0x9b1EB696Ed283e143C2f77DDad93951fF06220cB` |

## UMA-інфраструктура

| Контракт | Адреса |
|---|---|
| Timer | `0x9b29D73ef5889aa1C1DF98212EFBF41BCB513E5b` |
| Finder | `0xFD3608a755D33cCFeb85B71840615f74eeA6CbF5` |
| IdentifierWhitelist | `0x6eFcf1e735913bB4DE1f558EF39A69c71d18919d` |
| AddressWhitelist | `0xE9264DEbA6F9530d5dBe3D275C5306727AC81832` |
| Store | `0x8B84F612eb00E2aB69C71bBaF78366bF6a22DE83` |
| MockOracleAncillary | `0xB129B9a47F695B003C1202A15ddCc758831C4289` |
| OptimisticOracleV2 | [`0xFABb7DcaAdD1275E183A33b19eb6b96E96F83EC7`](https://testnet.arcscan.app/address/0xFABb7DcaAdD1275E183A33b19eb6b96E96F83EC7) |

## Перевірений стан (post-deploy)

- Market `priceRequested = true` ✅
- AMM `initialized = true`, резерви `YES=5 / NO=5 USDC`, ціни `0.50 / 0.50`, fee `2%` ✅
- Колатераль = USDC ERC-20 (6 dec); seed 5 USDC; reward 0.1 USDC; bond 1 USDC
- Перевірка: `node --experimental-strip-types scripts/verify-deploy.ts`

## Нотатки щодо USDC на Arc

- USDC — **нативний газовий токен** Arc (18 dec), але має **ERC-20-інтерфейс** за системною адресою
  `0x3600…0000` з **6 decimals**. Маркет використовує саме ERC-20 (approve/transferFrom).
- USDC **не мінтиться** — отримати з [faucet.circle.com](https://faucet.circle.com/). UI має кнопку «USDC Faucet».
- Суми малі (seed 5, reward 0.1, bond 1), бо газ і колатераль — з одного USDC-балансу.
- **Chain-guard:** усі транзакції форсять Arc Testnet (chainId 5042002); якщо гаманець на іншій
  мережі — UI показує «Switch to Arc Testnet». Це усуває ризик випадкових транзакцій у mainnet.
</content>
