import { formatUnits } from 'viem';
import { COLLATERAL_DECIMALS } from './addresses';

export enum OracleState {
  Invalid = 0,
  Requested = 1,
  Proposed = 2,
  Expired = 3,
  Disputed = 4,
  Resolved = 5,
  Settled = 6,
}

export function oracleStateLabel(state: OracleState | undefined, opts?: { priceRequested?: boolean }): string {
  switch (state) {
    case OracleState.Invalid:
      return opts?.priceRequested ? 'Awaiting Arbitration' : 'Invalid';
    case OracleState.Requested:
      return 'No Proposal Yet';
    case OracleState.Proposed:
      return 'Proposed';
    case OracleState.Expired:
      return 'Ready to Settle';
    case OracleState.Disputed:
      return 'Disputed';
    case OracleState.Resolved:
      return 'Resolved';
    case OracleState.Settled:
      return 'Settled';
    default:
      return 'Unknown';
  }
}

export function formatCollateral(amount: bigint | undefined, full?: boolean): string {
  if (amount === undefined) return '0.00';
  const raw = formatUnits(amount, COLLATERAL_DECIMALS);
  if (full) return raw;
  const n = parseFloat(raw);
  if (n === 0) return '0.00';
  if (n >= 1000) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
