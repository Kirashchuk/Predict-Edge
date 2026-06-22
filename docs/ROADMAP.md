# Roadmap Predict-Edge

Roadmap описує не маркетингові плани, а технічні фази для поточної архітектури:
Hardhat contracts, Bun/Hono API, Vite frontend, USDC collateral і on-chain CLOB orders.

```mermaid
graph LR
    P0["P0 Local setup"] --> P1["P1 Contracts compile"]
    P1 --> P2["P2 Testnet funding"]
    P2 --> P3["P3 Deploy contracts"]
    P3 --> P4["P4 Run API + app"]
    P4 --> P5["P5 Trading smoke"]
    P5 --> P6["P6 Market/order UX"]
    P6 --> P7["P7 Hardening"]
    P7 --> P8["P8 Production redesign"]
```

## P0. Local setup

Goal:

- Install dependencies for root, `app`, and `server`.

Commands:

```bash
bun install
cd app && bun install && cd ..
cd server && bun install && cd ..
```

Gate:

- Root Hardhat dependencies installed.
- `app/node_modules` and `server/node_modules` installed.

Rollback:

- Delete relevant `node_modules` and reinstall.

## P1. Contracts compile

Goal:

- Build Solidity artifacts and TypeChain types.

Command:

```bash
bun run compile
```

Gate:

- `EventBasedPredictionMarket`, `PredictionMarketAMM`, and `OnChainLimitOrderBook` compile with Solidity 0.8.17.
- UMA/OpenZeppelin dependencies resolve.

Rollback:

- `bunx hardhat clean`, then compile again.

## P2. Testnet funding

Goal:

- Fund deployer with Arc Testnet USDC for gas and collateral.

Steps:

1. Create or select EOA deployer.
2. Put `PRIVATE_KEY` in root `.env.local`.
3. Set RPC in `NEXT_PUBLIC_ALCHEMY_RPC_URL` or use fallback.
4. Fund address from [Circle faucet](https://faucet.circle.com/).

Gate:

- Deployer has enough USDC for gas, proposer reward, and AMM seed.

Rollback:

- Re-fund from faucet or switch to another testnet EOA.

## P3. Deploy contracts

Goal:

- Deploy UMA infrastructure, base market, AMM, and CLOB to Arc Testnet.

Commands:

```bash
bun run deploy
bun run verify-deploy
bun run sync-env
```

Gate:

- Root `.env.local` has deployed `NEXT_PUBLIC_*` addresses.
- `app/.env.local` has matching `VITE_*` addresses.
- Verify script reports `priceRequested=true`, AMM initialized, reserves near `5/5 USDC`.

Rollback:

- Re-run deploy with funded key. Old testnet contracts remain on-chain, new addresses replace env.

## P4. Run API and app

Goal:

- Full local runtime with frontend and API.

Commands:

```bash
bun run dev:api
bun run dev:app
```

Gate:

- Hono listens on `http://localhost:8787`.
- Scalar docs open at `http://localhost:8787/docs`.
- Vite app opens at `http://localhost:5173`.
- Frontend `/v1` calls proxy to backend.

Rollback:

- Check ports 8787/5173, env values, and rerun `bun run sync-env`.

## P5. Trading smoke

Goal:

- Validate core market lifecycle from UI.

Steps:

1. Connect MetaMask or configured Circle Passkey.
2. Confirm wallet is on Arc Testnet.
3. Open live market.
4. Approve USDC.
5. Buy YES/NO.
6. Sell YES/NO.
7. Propose outcome.
8. Settle oracle after test Timer jump.
9. Redeem positions.

Gate:

- Transactions land on Arc Testnet.
- Balances and reserves update in UI.
- Arcscan shows emitted events.

Rollback:

- Redeploy a clean testnet market if lifecycle state is no longer useful.

## P6. Market and order UX

Goal:

- Validate app-specific features beyond base AMM.

Implemented:

- Create custom market via `POST /v1/markets`.
- Store custom market metadata in `data/markets.json`.
- Place escrowed on-chain limit order via `OnChainLimitOrderBook`.
- Show CLOB open orders and AMM depth reference in `OrderBook`.
- Fill/cancel/match CLOB orders through wallet transactions.
- Auto-match crossed CLOB orders with `bun run keeper`.
- Show on-chain AMM/CLOB trade history on market detail pages.
- Show positions in `/portfolio`.
- Show aggregate portfolio value chart in `/portfolio`.

Gate:

- New market appears in grid.
- Order appears in order book.
- Fill/cancel/match transactions are visible in CLOB events and `TradeHistory`.

Rollback:

- `bun run reset` for markets.
- Cancel CLOB orders on-chain if possible or redeploy a fresh testnet market/CLOB.
- Clear `data/orders.json` only if testing legacy `/v1/orders`.

## P7. Hardening

Goal:

- Make the testnet service safer before broader exposure.

Checklist:

- [ ] Add auth and rate-limit to `POST /v1/markets`.
- [ ] Add server-side quotas per user/IP/wallet.
- [ ] Replace raw file writes with a DB or transactional store.
- [ ] Remove legacy `ARCT` naming in code where it now means USDC.
- [x] Fix `useClob.ts` viem typecheck path.
- [x] Add tests for `OnChainLimitOrderBook` partial fills, cancellation, residual escrow and `matchOrders`.
- [x] Implement testnet keeper/matcher script.
- [ ] Define production keeper monitoring and failure policy.
- [ ] Add contract tests for AMM math, settlement, callbacks, and decimals.
- [ ] Add frontend tests for chain guard and amount formatting.
- [ ] Add API tests for market/order validation.
- [ ] Add CI for root, app, and server.
- [ ] Reconcile legacy `/v1/orders` code with the current CLOB UI path.

## P8. Production redesign

Goal:

- Move from testnet demo to a defensible production architecture.

Required decisions:

- Real oracle/DVM or accepted resolution governance.
- Production liveness and bond economics.
- AMM slippage parameters and contract-level `minOut`/deadline.
- CLOB keeper/indexer strategy.
- Durable database and audit trail.
- Key management through KMS/HSM or user-paid deploy model.
- External audit for contracts.
- Operational monitoring and incident response.

## Current status table

| Phase | Status | Notes |
|---|---|---|
| P0 Local setup | Done locally | Root/app/server dependency sets exist |
| P1 Compile | Expected working | Verify with `bun run compile` |
| P2 Funding | Operator-dependent | Requires faucet USDC |
| P3 Deploy | Done for documented addresses | See [deployed-addresses.md](deployed-addresses.md) |
| P4 Runtime | Implemented | API `:8787`, app `:5173` |
| P5 Trading smoke | Needs periodic manual check | Depends on wallet and testnet state |
| P6 Market/order UX | Implemented for testnet | Current recorded base env may need redeploy/sync for CLOB address |
| P7 Hardening | Pending | Needed before public testnet |
| P8 Production redesign | Pending | Needed before mainnet |
