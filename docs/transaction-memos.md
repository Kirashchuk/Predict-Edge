# Arc Transaction Memos

Predict-Edge can attach app-level metadata to Arc Testnet contract calls through
Arc's predeployed `Memo` contract. The main use case is payment reconciliation:
invoice ids, market ids, payout references, or customer/account ids can be
emitted onchain without changing the target contract.

## Contracts

| Contract | Address | Purpose |
|---|---|---|
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | Wraps a target call and emits memo events |
| USDC | `0x3600000000000000000000000000000000000000` | Arc Testnet USDC ERC-20, 6 decimals |

The Memo contract emits:

- `BeforeMemo(uint256 indexed memoIndex)`
- `Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)`

`memoId` is indexed, so the app can query logs by an offchain reference hash
without needing the transaction hash.

## Local Script

Use:

```bash
bun run memo:payment
```

Optional parameters:

```bash
bun run memo:payment -- --recipient 0xRecipient --amount 0.05 --ref predict-edge-test-001 --note "app=predict-edge;type=test-payment"
```

If no recipient is provided, the script creates one and stores it in
`.env.memo-test.local`:

```ini
MEMO_TEST_RECIPIENT_ADDRESS=0x...
MEMO_TEST_RECIPIENT_PRIVATE_KEY=0x...
```

That file is ignored by git. It is testnet-only and must not be used for real
funds.

The script:

1. Loads the deployer key from root `.env.local`.
2. Verifies Arc Testnet chain id `5042002`.
3. Verifies bytecode exists at the Memo address.
4. Encodes `USDC.transfer(recipient, amount)` as the inner call.
5. Computes `memoId = keccak256(ref)` and memo bytes from the note string.
6. Sends `Memo.memo(USDC, transferData, memoId, memoBytes)`.
7. Verifies receipt events, the USDC `Transfer`, and a follow-up `getLogs`
   query by `memoId`.

## Product Fit

Good fits:

- Invoice-like USDC payments where an offchain record needs an onchain anchor.
- Deposit, payout, referral, or market-creation fee reconciliation.
- A future indexer pipeline that joins Arc logs to local app records.
- Optional metadata around direct AMM/CLOB calls, if the user call can be
  wrapped by Memo and the required token approvals already exist.

Poor fits:

- Private user data. Memo bytes are public event data.
- Cases where the target call must be hidden or mutable after submission.
- Contract-to-contract flows. Arc memo guardrails require direct EOA submission.

## Architecture Notes

- Memos are an event-layer feature, not application storage. Store the original
  offchain reference in the app database and store/query the `memoId` hash
  onchain.
- Use a versioned memo schema before production, for example
  `v=1;app=predict-edge;type=payment;ref=...`.
- Keep memo payloads compact. Large memo bytes increase calldata and fee cost.
- Reconciliation should compare both `memoId` and `callDataHash`. `memoId`
  identifies the business reference; `callDataHash` binds the memo to the exact
  target call bytes.
- Arc has a decimal split: native gas balance is displayed with 18 decimals,
  while the USDC ERC-20 interface uses 6 decimals.
- If the child call reverts, the outer memo transaction reverts too. No final
  Memo event is emitted for failed payments.
- The wrapped target still sees the original EOA as `msg.sender`; for a USDC
  transfer that means tokens move from the wallet, not from the Memo contract.

## Smoke Test

Latest local smoke test:

| Field | Value |
|---|---|
| Date | `2026-06-24` |
| Sender | `0x72CA27CC843373671DaA8F4876C36aa84ee74A3E` |
| Recipient | `0x84516e81F6E7139Ae8Eb4d0AEAEf0a77B9085319` |
| Amount | `0.05 USDC` |
| Transaction | [`0x6cb10da76a5bca8b8f20c99e377244e0d22c360b24c7789503930cedcad63b72`](https://testnet.arcscan.app/tx/0x6cb10da76a5bca8b8f20c99e377244e0d22c360b24c7789503930cedcad63b72) |
| Block | `48537966` |
| Memo index | `14930` |
| Memo ref | `predict-edge-memo-2026-06-24-001` |
| Memo id | `0xd8174e7822660165f25eca6a87986ea7d135806f28d0b00addee1e7330099a20` |
| Call data hash | `0x389c3d4cc553687f90ec35f66908c1eb2c20479e9b9724b165b0a9aa6c600bec` |

The script verified one `BeforeMemo`, one `Memo`, the expected USDC `Transfer`,
and one historical log match for the same `memoId`.
