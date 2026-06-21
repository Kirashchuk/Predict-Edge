import { type Address } from 'viem';
import { MARKET_ABI } from '@/shared/lib/contracts/abis';
import { useContractWrite } from '@/features/wallet/useContractWrite';

/** Settle (redeem) Long/Short positions for collateral after resolution. */
export function useSettlePosition(market: Address | undefined) {
  const w = useContractWrite();
  const settle = (longAmount: bigint, shortAmount: bigint) => {
    if (!market) return;
    w.write({ address: market, abi: MARKET_ABI, functionName: 'settle', args: [longAmount, shortAmount] });
  };
  return { settle, ...w };
}
