import { useState } from 'react';
import { type Address, parseUnits, maxUint256 } from 'viem';
import { USDC_ADDRESS, COLLATERAL_DECIMALS } from '@/shared/lib/contracts/addresses';
import { toast } from '@/shared/ui/primitives/sonner';
import { useWallet } from '@/features/wallet/WalletContext';
import { useAmmTrade, useTradeAllowances } from './useTrade';
import { useUpdateOrder } from './useOrders';
import type { LimitOrder } from '../api/orders';

/** Execute a triggered limit order against the AMM, then mark it filled. */
export function useFillOrder(
  market: Address | undefined,
  amm: Address | undefined,
  longToken: Address | undefined,
  shortToken: Address | undefined,
) {
  const { address } = useWallet();
  const { approve, buy, sell } = useAmmTrade(amm);
  const { arctAllowance, longAllowance, shortAllowance } = useTradeAllowances(amm, longToken, shortToken);
  const update = useUpdateOrder(market);
  const [fillingId, setFillingId] = useState<string | null>(null);

  async function fill(order: LimitOrder) {
    if (!address) return;
    setFillingId(order.id);
    try {
      const sizeUnits = parseUnits(String(order.size), COLLATERAL_DECIMALS);
      if (order.side === 'buy') {
        if ((arctAllowance ?? 0n) < sizeUnits) {
          toast.message('Approving USDC…');
          await approve(USDC_ADDRESS, maxUint256);
        }
        toast.message(`Filling limit — buy ${order.outcome.toUpperCase()}…`);
        await buy(order.outcome, String(order.size));
      } else {
        const token = order.outcome === 'yes' ? longToken : shortToken;
        const allow = order.outcome === 'yes' ? longAllowance : shortAllowance;
        if (token && (allow ?? 0n) < sizeUnits) {
          toast.message('Approving tokens…');
          await approve(token, maxUint256);
        }
        toast.message(`Filling limit — sell ${order.outcome.toUpperCase()}…`);
        await sell(order.outcome, String(order.size));
      }
      await update.mutateAsync({ id: order.id, owner: address, status: 'filled' });
      toast.success('Limit order filled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fill failed');
    } finally {
      setFillingId(null);
    }
  }

  return { fill, fillingId };
}
