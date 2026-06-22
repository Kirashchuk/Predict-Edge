# Ризики та безпека

Predict-Edge у поточному вигляді є testnet-продуктом. Основні ризики зосереджені не лише в
контрактах, а й у demo-інфраструктурі: Mock DVM, серверний deploy key, CLOB matching, JSON metadata
storage, відсутність auth/rate-limit і AMM без slippage guard.

Severity у цьому документі оцінена для testnet. Для production більшість пунктів стають критичнішими.

## Summary

| ID | Ризик | Severity | Статус |
|---|---|---|---|
| R1 | Server-held `PRIVATE_KEY` для `POST /v1/markets` | High | Прийнятий testnet-компроміс |
| R2 | `MockOracleAncillary` замість real UMA DVM | High | Прийнятий testnet-компроміс |
| R3 | 60s liveness | Medium | Demo convenience |
| R4 | AMM без `minOut`/deadline | Medium | Потрібен contract/API upgrade |
| R5 | On-chain CLOB matching/escrow complexity | Medium | Implemented with focused tests and keeper script; needs production policy |
| R6 | JSON market metadata and legacy order storage | Medium | Потрібна DB для public prod |
| R7 | Circle passkey infra dependency | Low/Medium | Optional wallet path |
| R8 | Key/env leakage | High | Mitigated by gitignore, still operationally sensitive |

## 1. Server-held deployer key

`POST /v1/markets` використовує `PRIVATE_KEY` із root `.env.local` для deploy market + AMM.

Risk:

- Будь-який неавторизований caller може змусити сервер витрачати deployer USDC/gas, якщо endpoint відкритий публічно.
- Компрометація сервера або env дає контроль над deployer EOA.
- Це не custody user funds, але це operational key з testnet USDC і правом deploy.

Current mitigations:

- `.env.local` gitignored.
- `.env.example` не містить секретів.
- Endpoint призначений для локального/testnet середовища.

Required before public deployment:

- Auth for create market.
- Rate-limit and quota.
- Per-user costing or client-side deploy flow.
- Key rotation plan.
- KMS/HSM or managed secret store.
- Monitoring for repeated failed/successful deploy attempts.

## 2. Mock DVM and oracle resolution

UMA OO V2 flow у контрактах permissionless, але disputed requests у цьому testnet bootstrap ідуть у
`MockOracleAncillary`, а не real UMA DVM.

Risk:

- Mock admin can push disputed outcome.
- Немає реальної voting/governance security.
- 60s liveness недостатній для відкритого market.

Current mitigations:

- Market validates OO callback sender, identifier, ancillary data and timestamp.
- False proposals can be disputed in the OO model.
- Documentation marks Mock DVM as testnet-only.

Required before production:

- Use real UMA deployment/governance path where available.
- Increase liveness to hours/days depending on market type.
- Review proposer bond/reward economics.
- Define market resolution policy and ancillary data standards.

## 3. AMM slippage and MEV

`PredictionMarketAMM` uses `x*y=k` and a 2 percent fee. Trade functions do not accept `minOut` or deadline.

Risk:

- Large trades can receive worse execution due to price impact.
- Transaction can be sandwiched or executed after price changes.
- UI preview is not a binding guarantee.

Current mitigations:

- UI calls `calcBuy*` and `calcSell*` previews.
- Order book depth is derived from the same AMM math.
- Liquidity is small and testnet-only.

Required before production:

- Add `minOut` and deadline arguments to buy/sell functions.
- Surface slippage tolerance in UI.
- Add tests for AMM invariant and rounding behavior.
- Consider larger liquidity and fee economics.

## 4. On-chain CLOB limit orders

Current limit orders use `OnChainLimitOrderBook`. Buy orders escrow USDC; sell orders escrow YES/NO
tokens; takers can fill orders directly; crossed orders can be matched on-chain.

Risk:

- More contract surface area than AMM-only trading.
- Users must approve CLOB to spend USDC or PLT/PST.
- Crossed books need a matcher/keeper or manual matching; `npm run keeper` is available for testnet matching.
- Existing documented base deployment may not have `CLOB_ADDRESS`; CLOB UI is unavailable until redeploy/sync.
- Production still needs broader gas, indexing and security review around matching policy.

Current mitigations:

- CLOB escrow is on-chain, not a JSON promise.
- `nonReentrant` guards state-changing CLOB functions.
- `whenActive` prevents place/fill/match after market resolution.
- Makers can cancel open orders and recover remaining escrow.
- Contract tests cover crossed matching, partial direct fills, cancellation, residual escrow refunds and resolved-market guard.

Required before production:

- Broader integration tests for multi-market keeper behavior.
- Production keeper/matcher policy.
- Gas review and event indexing strategy.
- UI guardrails around approvals and residual escrow.
- Security review of direct fill and match pricing.

## 5. JSON persistence

`data/markets.json` is the active local metadata store. `data/orders.json` remains for legacy
`/v1/orders` routes but is not the current CLOB UI path.

Risk:

- Data loss on reset/deploy environment changes.
- File write races for API-created markets or legacy orders.
- No audit trail.
- No multi-instance support.

Current mitigations:

- Simple enough for local/testnet demo.
- `npm run reset` intentionally clears user-created markets.

Required before production:

- Move market metadata to Postgres or equivalent if public.
- Add migrations.
- Add server-side validation constraints.
- Add backups and audit logging.

## 6. Wallet and chain safety

Frontend supports MetaMask/injected and Circle Passkey.

Risks:

- Injected wallet could be on the wrong network.
- Circle passkey path depends on Circle client URL/key, bundler, and paymaster.
- Passkey smart account is not suitable for deploy scripts that need an EOA private key.

Current mitigations:

- `ensureArcChain` switches/forces Arc Testnet before injected write.
- wagmi config is restricted to `arcTestnet`.
- Circle wallet is disabled unless `VITE_CIRCLE_CLIENT_KEY` and `VITE_CIRCLE_CLIENT_URL` are configured.
- `useContractWrite` centralizes write behavior.

Required before production:

- Better user-facing error handling for chain switch failures.
- Explicit wallet support matrix.
- Monitoring for Circle bundler/paymaster failures.

## 7. Collateral and decimals

Current collateral is Arc USDC ERC-20 at `0x3600...0000` with 6 decimals. Native gas balance uses USDC with 18 decimals.

Risk:

- Mixing native 18-dec gas balance with ERC-20 6-dec collateral amounts can display or transfer wrong values.
- Scripts and UI must consistently use `parseUnits(..., 6)` for collateral.

Current mitigations:

- `COLLATERAL_DECIMALS = 6` in frontend.
- Deploy script uses `ethers.parseUnits(n, 6)`.
- Verify script prints ERC-20 USDC with 6 decimals and gas balance with 18 decimals.

Required before production:

- Add tests around amount formatting and parse/format boundaries.
- Avoid legacy `ARCT` variable names in code where possible.

## 8. Smart contract review points

Positive controls:

- `PredictionMarketAMM` trade functions are `nonReentrant`.
- `whenActive` blocks trading after market resolution.
- Market callback authorization checks current OO address.
- Solidity 0.8 overflow checks are active.
- `SafeERC20` is used for token transfers.

Review before production:

- CEI ordering in sell paths.
- Max approvals from AMM to market.
- Lack of slippage protection.
- Event coverage for operational indexing.
- Full test suite for create/redeem/settle and AMM math.

## Pre-production checklist

- [ ] Real oracle/DVM path or explicitly accepted governance model.
- [ ] Liveness and bond economics reviewed.
- [ ] `POST /v1/markets` protected or moved to client-side/user-paid deploy.
- [ ] AMM functions upgraded with `minOut` and deadline.
- [x] Focused CLOB order lifecycle tests added.
- [x] Testnet keeper/matcher script implemented.
- [ ] Production keeper policy and monitoring defined.
- [ ] JSON stores replaced with DB.
- [ ] Key management moved out of raw `.env.local`.
- [ ] Contract tests and frontend/backend CI added.
- [ ] External contract audit before any mainnet deployment.
