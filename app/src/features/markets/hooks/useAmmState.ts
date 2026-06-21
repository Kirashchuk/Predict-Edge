import { useReadContracts } from 'wagmi';
import { type Address } from 'viem';
import { AMM_ABI, MARKET_ABI } from '@/shared/lib/contracts/abis';
import { LIVE_STATE_REFETCH_INTERVAL } from '@/features/wallet/wagmi';

export interface AmmState {
  yesPrice?: bigint;
  noPrice?: bigint;
  reserveYes?: bigint;
  reserveNo?: bigint;
  feeBps?: bigint;
  resolved?: boolean;
  priceRequested?: boolean;
  isLoading: boolean;
}

/** Live AMM + market state for a given market/AMM pair. */
export function useAmmState(market?: Address, amm?: Address): AmmState {
  const enabled = Boolean(market && amm);
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: amm, abi: AMM_ABI, functionName: 'getYesPrice' },
      { address: amm, abi: AMM_ABI, functionName: 'getNoPrice' },
      { address: amm, abi: AMM_ABI, functionName: 'getReserves' },
      { address: amm, abi: AMM_ABI, functionName: 'feeBps' },
      { address: market, abi: MARKET_ABI, functionName: 'receivedSettlementPrice' },
      { address: market, abi: MARKET_ABI, functionName: 'priceRequested' },
    ],
    query: { enabled, refetchInterval: LIVE_STATE_REFETCH_INTERVAL },
  });

  const reserves = data?.[2]?.result as readonly [bigint, bigint] | undefined;
  return {
    yesPrice: data?.[0]?.result as bigint | undefined,
    noPrice: data?.[1]?.result as bigint | undefined,
    reserveYes: reserves?.[0],
    reserveNo: reserves?.[1],
    feeBps: data?.[3]?.result as bigint | undefined,
    resolved: data?.[4]?.result as boolean | undefined,
    priceRequested: data?.[5]?.result as boolean | undefined,
    isLoading,
  };
}
