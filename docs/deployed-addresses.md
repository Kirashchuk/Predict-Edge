# Deployed addresses: Arc Testnet

- **Network:** Arc Testnet
- **Chain ID:** `5042002`
- **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)
- **Deployer:** `0x72CA27CC843373671DaA8F4876C36aa84ee74A3E`

These are public testnet addresses. The deployer private key must remain only in local `.env.local`.

## Collateral

| Asset | Address | Notes |
|---|---|---|
| USDC ERC-20 | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) | Arc system contract, 6 decimals, used as trading collateral |

Arc also represents native gas balance as USDC with 18 decimals. Contract transfers use the ERC-20 interface above with 6 decimals.

## Base market

| Contract | Address |
|---|---|
| `EventBasedPredictionMarket` (`BTC100K`) | [`0x45f03Ee08C61A1319Ee672E7312127e37CC894af`](https://testnet.arcscan.app/address/0x45f03Ee08C61A1319Ee672E7312127e37CC894af) |
| `PredictionMarketAMM` | [`0xA4E18fFf8E551A81a54DD1d9F45c7Bb7e396d690`](https://testnet.arcscan.app/address/0xA4E18fFf8E551A81a54DD1d9F45c7Bb7e396d690) |
| `OnChainLimitOrderBook` | [`0x9905724FFb9ec9f11172b9C373fBa836Ed743459`](https://testnet.arcscan.app/address/0x9905724FFb9ec9f11172b9C373fBa836Ed743459) |

Question:

```text
Will Bitcoin exceed $100,000 before June 1, 2026?
```

## Position tokens

| Token | Address |
|---|---|
| Long token, PLT / YES | [`0xd33813B05D9d718BD7A0E07F7C9Fb68c12B4Ed07`](https://testnet.arcscan.app/address/0xd33813B05D9d718BD7A0E07F7C9Fb68c12B4Ed07) |
| Short token, PST / NO | [`0x9b1EB696Ed283e143C2f77DDad93951fF06220cB`](https://testnet.arcscan.app/address/0x9b1EB696Ed283e143C2f77DDad93951fF06220cB) |

## UMA infrastructure

| Contract | Address |
|---|---|
| Timer | [`0x9b29D73ef5889aa1C1DF98212EFBF41BCB513E5b`](https://testnet.arcscan.app/address/0x9b29D73ef5889aa1C1DF98212EFBF41BCB513E5b) |
| Finder | [`0xFD3608a755D33cCFeb85B71840615f74eeA6CbF5`](https://testnet.arcscan.app/address/0xFD3608a755D33cCFeb85B71840615f74eeA6CbF5) |
| IdentifierWhitelist | [`0x6eFcf1e735913bB4DE1f558EF39A69c71d18919d`](https://testnet.arcscan.app/address/0x6eFcf1e735913bB4DE1f558EF39A69c71d18919d) |
| AddressWhitelist | [`0xE9264DEbA6F9530d5dBe3D275C5306727AC81832`](https://testnet.arcscan.app/address/0xE9264DEbA6F9530d5dBe3D275C5306727AC81832) |
| Store | [`0x8B84F612eb00E2aB69C71bBaF78366bF6a22DE83`](https://testnet.arcscan.app/address/0x8B84F612eb00E2aB69C71bBaF78366bF6a22DE83) |
| MockOracleAncillary | [`0xB129B9a47F695B003C1202A15ddCc758831C4289`](https://testnet.arcscan.app/address/0xB129B9a47F695B003C1202A15ddCc758831C4289) |
| OptimisticOracleV2 | [`0xFABb7DcaAdD1275E183A33b19eb6b96E96F83EC7`](https://testnet.arcscan.app/address/0xFABb7DcaAdD1275E183A33b19eb6b96E96F83EC7) |

## User-created markets in local data

`data/markets.json` can contain additional markets created through `POST /v1/markets`. At the time of this documentation pass, local data contains:

| Market | Market address | AMM address |
|---|---|---|
| `Will Ethereum close above 10000 USD in 2026?` | [`0xd4fba19137E43dbc5702C27e114fd16f6702a973`](https://testnet.arcscan.app/address/0xd4fba19137E43dbc5702C27e114fd16f6702a973) | [`0x2a07F0978145eacf04eF51c322Af56981eff19ff`](https://testnet.arcscan.app/address/0x2a07F0978145eacf04eF51c322Af56981eff19ff) |

This local list is not canonical for every checkout. It is file-backed testnet state and can be reset with `npm run reset`.

The current code deploys `OnChainLimitOrderBook` for newly created markets, but the local
`data/markets.json` entry above does not yet include `clobAddress`. Create a new market or redeploy
to get CLOB metadata.

## Verified state

Use:

```bash
npm run verify-deploy
```

Expected state for the base market:

| Check | Expected |
|---|---|
| `priceRequested` | `true` |
| `receivedSettlementPrice` | `false` until resolution |
| AMM `initialized` | `true` |
| AMM reserves | around `YES=5`, `NO=5` USDC |
| Prices | around `0.5`, `0.5` |
| Fee | `200` bps |
| Collateral | USDC ERC-20, 6 decimals |
| CLOB | `0x9905724FFb9ec9f11172b9C373fBa836Ed743459` |

## Env mapping

Root `.env.local` should contain:

```ini
NEXT_PUBLIC_MARKET_ADDRESS=0x45f03Ee08C61A1319Ee672E7312127e37CC894af
NEXT_PUBLIC_AMM_ADDRESS=0xA4E18fFf8E551A81a54DD1d9F45c7Bb7e396d690
NEXT_PUBLIC_CLOB_ADDRESS=0x9905724FFb9ec9f11172b9C373fBa836Ed743459
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_OO_V2_ADDRESS=0xFABb7DcaAdD1275E183A33b19eb6b96E96F83EC7
NEXT_PUBLIC_FINDER_ADDRESS=0xFD3608a755D33cCFeb85B71840615f74eeA6CbF5
NEXT_PUBLIC_TIMER_ADDRESS=0x9b29D73ef5889aa1C1DF98212EFBF41BCB513E5b
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=0xB129B9a47F695B003C1202A15ddCc758831C4289
```

Then run `npm run sync-env` so `app/.env.local` receives the matching `VITE_*` values.
