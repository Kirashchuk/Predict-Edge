import { useReadContracts } from 'wagmi';
import { hexToString, type Address } from 'viem';
import { MARKET_ABI, ERC20_ABI } from '@/shared/lib/contracts/abis';
import { ARCT_ADDRESS } from '@/shared/lib/contracts/addresses';
import { useWallet } from '@/features/wallet/WalletContext';
import { LIVE_STATE_REFETCH_INTERVAL } from '@/features/wallet/wagmi';

const ZERO = '0x0000000000000000000000000000000000000000';

export function useMarketState(market?: Address) {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: market, abi: MARKET_ABI, functionName: 'pairName' },
      { address: market, abi: MARKET_ABI, functionName: 'customAncillaryData' },
      { address: market, abi: MARKET_ABI, functionName: 'priceRequested' },
      { address: market, abi: MARKET_ABI, functionName: 'receivedSettlementPrice' },
      { address: market, abi: MARKET_ABI, functionName: 'settlementPrice' },
      { address: market, abi: MARKET_ABI, functionName: 'longToken' },
      { address: market, abi: MARKET_ABI, functionName: 'shortToken' },
      { address: market, abi: MARKET_ABI, functionName: 'requestTimestamp' },
      { address: market, abi: MARKET_ABI, functionName: 'priceIdentifier' },
      { address: market, abi: MARKET_ABI, functionName: 'optimisticOracleProposerBond' },
    ],
    query: {
      enabled: !!market && market !== ZERO,
      refetchInterval: LIVE_STATE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    },
  });

  const ancillaryDataHex = data?.[1]?.result as `0x${string}` | undefined;
  let question: string | undefined;
  if (ancillaryDataHex) {
    try {
      question = hexToString(ancillaryDataHex);
    } catch {
      question = undefined;
    }
  }

  return {
    pairName: data?.[0]?.result as string | undefined,
    question,
    ancillaryDataHex,
    priceRequested: data?.[2]?.result as boolean | undefined,
    receivedSettlementPrice: data?.[3]?.result as boolean | undefined,
    settlementPrice: data?.[4]?.result as bigint | undefined,
    longTokenAddress: data?.[5]?.result as Address | undefined,
    shortTokenAddress: data?.[6]?.result as Address | undefined,
    requestTimestamp: data?.[7]?.result as bigint | undefined,
    priceIdentifier: data?.[8]?.result as `0x${string}` | undefined,
    proposerBond: data?.[9]?.result as bigint | undefined,
    isLoading,
    refetch,
  };
}

export function useTokenBalances(
  market: Address | undefined,
  longToken: Address | undefined,
  shortToken: Address | undefined,
) {
  const { address } = useWallet();
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: ARCT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined },
      { address: longToken, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined },
      { address: shortToken, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined },
      { address: ARCT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: address && market ? [address, market] : undefined },
    ],
    query: {
      enabled: !!address && !!longToken && !!shortToken,
      refetchInterval: LIVE_STATE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    },
  });

  return {
    arctBalance: data?.[0]?.result as bigint | undefined,
    longBalance: data?.[1]?.result as bigint | undefined,
    shortBalance: data?.[2]?.result as bigint | undefined,
    arctAllowance: data?.[3]?.result as bigint | undefined,
    isLoading,
    refetch,
  };
}
