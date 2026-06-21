import { useReadContracts } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { AMM_ABI, ERC20_ABI } from '@/shared/lib/contracts/abis';
import { ARCT_ADDRESS, COLLATERAL_DECIMALS } from '@/shared/lib/contracts/addresses';
import { useWallet } from '@/features/wallet/WalletContext';
import { useContractWrite } from '@/features/wallet/useContractWrite';
import { LIVE_STATE_REFETCH_INTERVAL } from '@/features/wallet/wagmi';

/** Preview output for a buy (USDC in -> tokens out) or sell (tokens in -> USDC out). */
export function useTradePreview(amm: Address | undefined, side: 'buy' | 'sell', outcome: 'yes' | 'no', amount: string) {
  const value = amount && parseFloat(amount) > 0 ? parseUnits(amount, COLLATERAL_DECIMALS) : 0n;
  const fn =
    side === 'buy'
      ? outcome === 'yes'
        ? 'calcBuyYes'
        : 'calcBuyNo'
      : outcome === 'yes'
        ? 'calcSellYes'
        : 'calcSellNo';
  const { data, isLoading } = useReadContracts({
    contracts: [{ address: amm, abi: AMM_ABI, functionName: fn, args: [value] }],
    query: { enabled: !!amm && value > 0n, refetchInterval: 30_000, refetchIntervalInBackground: false },
  });
  return { out: data?.[0]?.result as bigint | undefined, isLoading };
}

export function useTradeAllowances(
  amm: Address | undefined,
  longToken: Address | undefined,
  shortToken: Address | undefined,
) {
  const { address } = useWallet();
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: ARCT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: address && amm ? [address, amm] : undefined },
      { address: longToken, abi: ERC20_ABI, functionName: 'allowance', args: address && amm ? [address, amm] : undefined },
      { address: shortToken, abi: ERC20_ABI, functionName: 'allowance', args: address && amm ? [address, amm] : undefined },
    ],
    query: {
      enabled: !!address && !!amm && !!longToken && !!shortToken,
      refetchInterval: LIVE_STATE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    },
  });
  return {
    arctAllowance: data?.[0]?.result as bigint | undefined,
    longAllowance: data?.[1]?.result as bigint | undefined,
    shortAllowance: data?.[2]?.result as bigint | undefined,
    refetch,
    isLoading,
  };
}

/** Buy/sell execution + approvals against the AMM. */
export function useAmmTrade(amm: Address | undefined) {
  const w = useContractWrite();

  const approve = (token: Address, amount: bigint) =>
    amm && w.write({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [amm, amount] });

  const buy = (outcome: 'yes' | 'no', amount: string) => {
    if (!amm) return;
    w.write({
      address: amm,
      abi: AMM_ABI,
      functionName: outcome === 'yes' ? 'buyYes' : 'buyNo',
      args: [parseUnits(amount, COLLATERAL_DECIMALS)],
    });
  };

  const sell = (outcome: 'yes' | 'no', amount: string) => {
    if (!amm) return;
    w.write({
      address: amm,
      abi: AMM_ABI,
      functionName: outcome === 'yes' ? 'sellYes' : 'sellNo',
      args: [parseUnits(amount, COLLATERAL_DECIMALS)],
    });
  };

  return { approve, buy, sell, ...w };
}
