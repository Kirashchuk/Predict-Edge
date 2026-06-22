import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOrders, placeOrder, updateOrder, type LimitOrder } from '../api/orders';

export function useOrders(market: string | undefined) {
  return useQuery({
    queryKey: ['orders', market],
    queryFn: () => fetchOrders(market!),
    enabled: !!market,
    refetchInterval: 5000,
  });
}

export function usePlaceOrder(market: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: placeOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', market] }),
  });
}

export function useUpdateOrder(market: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, owner, status, txHash }: { id: string; owner: string; status: 'filled' | 'cancelled'; txHash?: string }) =>
      updateOrder(id, owner, status, txHash),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', market] }),
  });
}

/** A user buy-limit fills when YES price <= limit; a sell-limit fills when YES price >= limit. */
export function isFillable(order: LimitOrder, yesPrice: number): boolean {
  const px = order.outcome === 'yes' ? yesPrice : 1 - yesPrice;
  return order.side === 'buy' ? px <= order.limitPrice : px >= order.limitPrice;
}
