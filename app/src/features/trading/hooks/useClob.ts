import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useReadContracts } from 'wagmi';
import { maxUint256, type Address } from 'viem';
import { CLOB_ABI, ERC20_ABI } from '@/shared/lib/contracts/abis';
import { USDC_ADDRESS } from '@/shared/lib/contracts/addresses';
import { useWallet } from '@/features/wallet/WalletContext';
import { useContractWrite } from '@/features/wallet/useContractWrite';
import { LIVE_STATE_REFETCH_INTERVAL } from '@/features/wallet/wagmi';

export const CLOB_SIDE = { Buy: 0, Sell: 1 } as const;
export const CLOB_OUTCOME = { Yes: 0, No: 1 } as const;
export const CLOB_STATUS = { Open: 0, Filled: 1, Cancelled: 2 } as const;

export type ClobSide = (typeof CLOB_SIDE)[keyof typeof CLOB_SIDE];
export type ClobOutcome = (typeof CLOB_OUTCOME)[keyof typeof CLOB_OUTCOME];

export interface ClobOrder {
  id: bigint;
  maker: Address;
  side: ClobSide;
  outcome: ClobOutcome;
  price: bigint;
  amountInitial: bigint;
  amountRemaining: bigint;
  escrowRemaining: bigint;
  status: number;
  createdAt: bigint;
  filledAt: bigint;
}

function normalizeOrder(raw: unknown): ClobOrder {
  const o = raw as Record<string, unknown> & readonly unknown[];
  return {
    id: BigInt((o.id ?? o[0]) as bigint),
    maker: (o.maker ?? o[1]) as Address,
    side: Number(o.side ?? o[2]) as ClobSide,
    outcome: Number(o.outcome ?? o[3]) as ClobOutcome,
    price: BigInt((o.price ?? o[4]) as bigint),
    amountInitial: BigInt((o.amountInitial ?? o[5]) as bigint),
    amountRemaining: BigInt((o.amountRemaining ?? o[6]) as bigint),
    escrowRemaining: BigInt((o.escrowRemaining ?? o[7]) as bigint),
    status: Number(o.status ?? o[8]),
    createdAt: BigInt((o.createdAt ?? o[9]) as bigint),
    filledAt: BigInt((o.filledAt ?? o[10]) as bigint),
  };
}

export function sideLabel(side: ClobSide): 'buy' | 'sell' {
  return side === CLOB_SIDE.Buy ? 'buy' : 'sell';
}

export function outcomeLabel(outcome: ClobOutcome): 'yes' | 'no' {
  return outcome === CLOB_OUTCOME.Yes ? 'yes' : 'no';
}

export function useClobOrders(clob: Address | undefined) {
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ['clob-orders', clob],
    enabled: Boolean(publicClient && clob),
    refetchInterval: LIVE_STATE_REFETCH_INTERVAL,
    queryFn: async () => {
      if (!publicClient || !clob) return [] as ClobOrder[];
      const readContract = publicClient.readContract as (args: unknown) => Promise<unknown>;

      const idGroups = await Promise.all([
        readContract({ address: clob, abi: CLOB_ABI, functionName: 'getOpenOrders', args: [CLOB_OUTCOME.Yes, CLOB_SIDE.Buy] }),
        readContract({ address: clob, abi: CLOB_ABI, functionName: 'getOpenOrders', args: [CLOB_OUTCOME.Yes, CLOB_SIDE.Sell] }),
        readContract({ address: clob, abi: CLOB_ABI, functionName: 'getOpenOrders', args: [CLOB_OUTCOME.No, CLOB_SIDE.Buy] }),
        readContract({ address: clob, abi: CLOB_ABI, functionName: 'getOpenOrders', args: [CLOB_OUTCOME.No, CLOB_SIDE.Sell] }),
      ]) as bigint[][];

      const ids = [...new Set(idGroups.flat().map((id) => id.toString()))].map((id) => BigInt(id));
      if (ids.length === 0) return [] as ClobOrder[];

      const rawOrders = await readContract({
        address: clob,
        abi: CLOB_ABI,
        functionName: 'getOrders',
        args: [ids],
      });

      return (rawOrders as unknown[]).map(normalizeOrder).filter((order) => order.status === CLOB_STATUS.Open);
    },
  });
}

export function useClobOrderBook(clob: Address | undefined, outcome: ClobOutcome) {
  const ordersQuery = useClobOrders(clob);
  const book = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const selected = orders.filter((order) => order.outcome === outcome);
    return {
      bids: selected
        .filter((order) => order.side === CLOB_SIDE.Buy)
        .sort((a, b) => Number(b.price - a.price) || Number(a.createdAt - b.createdAt)),
      asks: selected
        .filter((order) => order.side === CLOB_SIDE.Sell)
        .sort((a, b) => Number(a.price - b.price) || Number(a.createdAt - b.createdAt)),
      all: orders,
    };
  }, [ordersQuery.data, outcome]);

  return { ...ordersQuery, ...book };
}

export function useClobAllowances(
  clob: Address | undefined,
  longToken: Address | undefined,
  shortToken: Address | undefined,
) {
  const { address } = useWallet();
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: address && clob ? [address, clob] : undefined },
      { address: longToken, abi: ERC20_ABI, functionName: 'allowance', args: address && clob ? [address, clob] : undefined },
      { address: shortToken, abi: ERC20_ABI, functionName: 'allowance', args: address && clob ? [address, clob] : undefined },
    ],
    query: {
      enabled: !!address && !!clob && !!longToken && !!shortToken,
      refetchInterval: LIVE_STATE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    },
  });

  return {
    usdcAllowance: data?.[0]?.result as bigint | undefined,
    yesAllowance: data?.[1]?.result as bigint | undefined,
    noAllowance: data?.[2]?.result as bigint | undefined,
    isLoading,
    refetch,
  };
}

export function useClobActions(clob: Address | undefined) {
  const writeState = useContractWrite();

  const approve = (token: Address) => {
    if (!clob) return Promise.resolve();
    return writeState.write({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [clob, maxUint256] });
  };

  const placeLimitOrder = (side: ClobSide, outcome: ClobOutcome, price: bigint, amount: bigint) => {
    if (!clob) return Promise.resolve();
    return writeState.write({
      address: clob,
      abi: CLOB_ABI,
      functionName: 'placeLimitOrder',
      args: [side, outcome, price, amount],
    });
  };

  const cancelOrder = (orderId: bigint) => {
    if (!clob) return Promise.resolve();
    return writeState.write({ address: clob, abi: CLOB_ABI, functionName: 'cancelOrder', args: [orderId] });
  };

  const fillOrder = (orderId: bigint, amount: bigint = 0n) => {
    if (!clob) return Promise.resolve();
    return writeState.write({ address: clob, abi: CLOB_ABI, functionName: 'fillOrder', args: [orderId, amount] });
  };

  const matchOrders = (buyOrderId: bigint, sellOrderId: bigint, amount: bigint = 0n) => {
    if (!clob) return Promise.resolve();
    return writeState.write({ address: clob, abi: CLOB_ABI, functionName: 'matchOrders', args: [buyOrderId, sellOrderId, amount] });
  };

  return { approve, placeLimitOrder, cancelOrder, fillOrder, matchOrders, ...writeState };
}
