# Deployed addresses: Arc Testnet

- **Network:** Arc Testnet
- **Chain ID:** `5042002`
- **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)
- **Deployer:** `0x72CA27CC843373671DaA8F4876C36aa84ee74A3E`
- **Last verified:** `2026-06-22`

These are public testnet addresses. The deployer private key must remain only in local `.env.local`.

## Collateral

| Asset | Address | Notes |
|---|---|---|
| USDC ERC-20 | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) | Arc system contract, 6 decimals, used as trading collateral |

Arc also represents native gas balance as USDC with 18 decimals. Contract transfers use the ERC-20 interface above with 6 decimals.

## Base market

| Contract | Address |
|---|---|
| `EventBasedPredictionMarket` (`BTC100K`) | [`0xD606e05095Bb3B3Eda4d4253bba641eb3441AA4b`](https://testnet.arcscan.app/address/0xD606e05095Bb3B3Eda4d4253bba641eb3441AA4b) |
| `PredictionMarketAMM` | [`0x10542230cedcC6Da7F13e3d213617F908df9aA3A`](https://testnet.arcscan.app/address/0x10542230cedcC6Da7F13e3d213617F908df9aA3A) |
| `OnChainLimitOrderBook` | [`0x350B3C2271BAD7ddDB0d610b43c3ad2f2cD95998`](https://testnet.arcscan.app/address/0x350B3C2271BAD7ddDB0d610b43c3ad2f2cD95998) |

Question:

```text
Will Bitcoin exceed $100,000 before June 1, 2026?
```

## Position tokens

| Token | Address |
|---|---|
| Long token, PLT / YES | [`0x39473B6A8Cc08C2a90F9d07dcAF84D194FCef900`](https://testnet.arcscan.app/address/0x39473B6A8Cc08C2a90F9d07dcAF84D194FCef900) |
| Short token, PST / NO | [`0x53E47c473b518D04Fa193fCaf9678d876895d62A`](https://testnet.arcscan.app/address/0x53E47c473b518D04Fa193fCaf9678d876895d62A) |

## UMA infrastructure

| Contract | Address |
|---|---|
| Timer | [`0xEC0E461FB8F3bC3Ceb48836bcC00E103e92909F8`](https://testnet.arcscan.app/address/0xEC0E461FB8F3bC3Ceb48836bcC00E103e92909F8) |
| Finder | [`0x4F7e4074133AC90F548f7EB0b10b102f00037f7A`](https://testnet.arcscan.app/address/0x4F7e4074133AC90F548f7EB0b10b102f00037f7A) |
| IdentifierWhitelist | [`0x5b0971726Cf6648071B4922d879264D0666453E9`](https://testnet.arcscan.app/address/0x5b0971726Cf6648071B4922d879264D0666453E9) |
| AddressWhitelist | [`0x8A5B23dDfD08A5132327F7A1b9c8763698966375`](https://testnet.arcscan.app/address/0x8A5B23dDfD08A5132327F7A1b9c8763698966375) |
| Store | [`0x679F7bEAF7372f996366D579D7De443Fe2c4DFf0`](https://testnet.arcscan.app/address/0x679F7bEAF7372f996366D579D7De443Fe2c4DFf0) |
| MockOracleAncillary | [`0x4FA6596d98F526B978014b6368E4365fAa22A743`](https://testnet.arcscan.app/address/0x4FA6596d98F526B978014b6368E4365fAa22A743) |
| OptimisticOracleV2 | [`0x880ACE2246c032BfBCb0b5daB8747fFBB87E3273`](https://testnet.arcscan.app/address/0x880ACE2246c032BfBCb0b5daB8747fFBB87E3273) |

## User-created markets in local data

`data/markets.json` can contain additional markets created through `POST /v1/markets`. At the time of this documentation pass, local data contains:

| Market | Market address | AMM address | CLOB address |
|---|---|---|---|
| `Will!` | [`0x4cb387424d449e806E1888e4748023056104c55f`](https://testnet.arcscan.app/address/0x4cb387424d449e806E1888e4748023056104c55f) | [`0xa663FBc23311dd5138AEd9C87AcecEDAA3407C39`](https://testnet.arcscan.app/address/0xa663FBc23311dd5138AEd9C87AcecEDAA3407C39) | [`0x057dea9A6eF23C43E53783f9b28FE9B81D0A1461`](https://testnet.arcscan.app/address/0x057dea9A6eF23C43E53783f9b28FE9B81D0A1461) |
| `Will Ethereum close above 10000 USD in 2026?` | [`0xd4fba19137E43dbc5702C27e114fd16f6702a973`](https://testnet.arcscan.app/address/0xd4fba19137E43dbc5702C27e114fd16f6702a973) | [`0x2a07F0978145eacf04eF51c322Af56981eff19ff`](https://testnet.arcscan.app/address/0x2a07F0978145eacf04eF51c322Af56981eff19ff) | [`0xA2e0ad9b89b79BB4694AA753d3Fc261D17c9982e`](https://testnet.arcscan.app/address/0xA2e0ad9b89b79BB4694AA753d3Fc261D17c9982e) |

This local list is not canonical for every checkout. It is file-backed testnet state and can be reset with `bun run reset`.

## Verified state

Use:

```bash
bun run verify-deploy
```

Expected state for the base market:

| Check | Expected |
|---|---|
| `priceRequested` | `true` |
| `receivedSettlementPrice` | `false` until resolution |
| AMM `initialized` | `true` |
| AMM reserves | around `YES=1`, `NO=1` USDC |
| Prices | around `0.5`, `0.5` |
| Fee | `200` bps |
| Collateral | USDC ERC-20, 6 decimals |
| CLOB | `0x350B3C2271BAD7ddDB0d610b43c3ad2f2cD95998` |

## Env mapping

Root `.env.local` should contain:

```ini
DEPLOY_MARKET_ADDRESS=0xD606e05095Bb3B3Eda4d4253bba641eb3441AA4b
DEPLOY_AMM_ADDRESS=0x10542230cedcC6Da7F13e3d213617F908df9aA3A
DEPLOY_CLOB_ADDRESS=0x350B3C2271BAD7ddDB0d610b43c3ad2f2cD95998
DEPLOY_USDC_ADDRESS=0x3600000000000000000000000000000000000000
DEPLOY_OO_V2_ADDRESS=0x880ACE2246c032BfBCb0b5daB8747fFBB87E3273
DEPLOY_FINDER_ADDRESS=0x4F7e4074133AC90F548f7EB0b10b102f00037f7A
DEPLOY_TIMER_ADDRESS=0xEC0E461FB8F3bC3Ceb48836bcC00E103e92909F8
DEPLOY_MOCK_ORACLE_ADDRESS=0x4FA6596d98F526B978014b6368E4365fAa22A743
```

Then run `bun run sync-env` so `app/.env.local` receives the matching `VITE_*` values.
