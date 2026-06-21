# Задеплоєні контракти — Arc Testnet

**Мережа:** Arc Testnet (chainId `5042002`) · **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)
**Дата деплою:** 2026-06-21 · **Деплоєр:** `0x72CA27CC843373671DaA8F4876C36aa84ee74A3E`
**Газу витрачено:** ~0.39 USDC

> Це публічні адреси (безпечно зберігати в git). Приватний ключ — лише в `.env.local` (gitignored).

## Ринок

| Контракт | Адреса |
|---|---|
| EventBasedPredictionMarket (BTC100K) | [`0xd5d9d07a2675D282ba86Eea84C189C3De9878D3e`](https://testnet.arcscan.app/address/0xd5d9d07a2675D282ba86Eea84C189C3De9878D3e) |
| PredictionMarketAMM | [`0xc142618eE210987510f1aBD8E7e60aB2D7410F20`](https://testnet.arcscan.app/address/0xc142618eE210987510f1aBD8E7e60aB2D7410F20) |

## Токени

| Токен | Адреса |
|---|---|
| ARCT (колатераль, TestnetERC20) | [`0xC0CE6e992A98874079A425f83Dc6BB76f87bfE71`](https://testnet.arcscan.app/address/0xC0CE6e992A98874079A425f83Dc6BB76f87bfE71) |
| Long Token (PLT / YES) | [`0x74De6c64B783C42F454C3D8b9CddD467765c2887`](https://testnet.arcscan.app/address/0x74De6c64B783C42F454C3D8b9CddD467765c2887) |
| Short Token (PST / NO) | [`0x128f01C3f61a9317cF00ba07040da9e3AC0A58Fe`](https://testnet.arcscan.app/address/0x128f01C3f61a9317cF00ba07040da9e3AC0A58Fe) |

## UMA-інфраструктура

| Контракт | Адреса |
|---|---|
| Timer | `0x30251D5B27edA16C5f4991907bBF56dBF4806558` |
| Finder | `0x301063cb89554446D2cBf84159aFa662d88E1e85` |
| IdentifierWhitelist | `0x99dD5748DAec241ED7A4c79FFc8103308Ef1BAfE` |
| AddressWhitelist | `0x07cC3D6d61A9EeE7F7E8Aa77F1bc7da636f249c8` |
| Store | `0xE1B515811e4B10dA013fc0D0D3FD06CC9439685E` |
| MockOracleAncillary (DVM-замінник) | `0xDF67a2a5679E4993B4CAc7AE0E184De34acbc130` |
| OptimisticOracleV2 | [`0x237d4Cff755708dBE57B24dB59634a68EB964E01`](https://testnet.arcscan.app/address/0x237d4Cff755708dBE57B24dB59634a68EB964E01) |

## Перевірений стан (post-deploy)

- Market `priceRequested = true`, `receivedSettlementPrice = false` (до резолюції) ✅
- AMM `initialized = true`, резерви `YES=1000 / NO=1000`, ціни `0.50 / 0.50`, fee `200 bps` ✅
- Deployer ARCT: `98990` (100000 − 10 reward − 1000 seed) ✅
- Перевірка відтворювана: `node --experimental-strip-types scripts/verify-deploy.ts`

> Для нового деплою (нові адреси) — `npm run deploy`; адреси автоматично перезапишуться в `.env.local`.
</content>
