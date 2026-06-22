import { useMemo, useState } from 'react';
import { type Address, formatUnits, parseEther } from 'viem';
import { GitCompareArrows, X } from 'lucide-react';
import { useWallet } from '@/features/wallet/WalletContext';
import { USDC_ADDRESS } from '@/shared/lib/contracts/addresses';
import { formatCollateral } from '@/shared/lib/contracts/types';
import { shortAddr } from '@/shared/lib/format';
import { Button } from '@/shared/ui/primitives/button';
import { toast } from '@/shared/ui/primitives/sonner';
import { buildOrderBook } from './amm-math';
import {
  CLOB_OUTCOME,
  CLOB_SIDE,
  type ClobOrder,
  type ClobOutcome,
  outcomeLabel,
  sideLabel,
  useClobActions,
  useClobAllowances,
  useClobOrderBook,
} from './hooks/useClob';

interface OrderBookProps {
  market: Address;
  amm?: Address;
  clob?: Address;
  longToken?: Address;
  shortToken?: Address;
  reserveYes: number;
  reserveNo: number;
  feeBps: number;
  yesPrice: number; // 0..1
}

const PRICE_SCALE = parseEther('1');

function quoteUp(amount: bigint, price: bigint): bigint {
  return (amount * price + PRICE_SCALE - 1n) / PRICE_SCALE;
}

function DepthRow({ price, size, depth, side }: { price: number; size: number; depth: number; side: 'ask' | 'bid' }) {
  const color = side === 'ask' ? 'text-destructive' : 'text-success';
  const bar = side === 'ask' ? 'bg-destructive/15' : 'bg-success/15';
  return (
    <div className="relative grid grid-cols-2 px-2 py-0.5">
      <div className={`absolute inset-y-0 right-0 ${bar}`} style={{ width: `${Math.min(100, depth * 100)}%` }} />
      <span className={`relative font-mono text-data-xs ${color}`}>{(price * 100).toFixed(1)}%</span>
      <span className="relative text-right font-mono text-data-xs text-muted-foreground">{size.toFixed(2)}</span>
    </div>
  );
}

function ClobRow({
  order,
  mine,
  busy,
  canFill,
  onCancel,
  onFill,
}: {
  order: ClobOrder;
  mine: boolean;
  busy: boolean;
  canFill: boolean;
  onCancel: (order: ClobOrder) => void;
  onFill: (order: ClobOrder) => void;
}) {
  const side = sideLabel(order.side);
  const color = side === 'buy' ? 'text-success' : 'text-destructive';
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 px-2 py-1 text-data-xs">
      <span className={`font-mono ${color}`}>{(Number(formatUnits(order.price, 18)) * 100).toFixed(1)}%</span>
      <span className="text-right font-mono text-muted-foreground">{formatCollateral(order.amountRemaining)}</span>
      <span className="truncate text-right font-mono text-muted-foreground">{mine ? 'you' : shortAddr(order.maker)}</span>
      {mine ? (
        <button
          onClick={() => onCancel(order)}
          disabled={busy}
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          aria-label="Cancel order"
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <button
          onClick={() => onFill(order)}
          disabled={busy || !canFill}
          title={canFill ? undefined : 'Fill the best-priced order first'}
          className="border border-gold/60 bg-gold/15 px-1.5 font-mono text-[0.6rem] uppercase text-gold hover:bg-gold/25 disabled:opacity-50"
        >
          Fill
        </button>
      )}
    </div>
  );
}

export function OrderBook({
  clob,
  longToken,
  shortToken,
  reserveYes,
  reserveNo,
  feeBps,
}: OrderBookProps) {
  const { address, isConnected } = useWallet();
  const [outcome, setOutcome] = useState<ClobOutcome>(CLOB_OUTCOME.Yes);
  const clobBook = useClobOrderBook(clob, outcome);
  const actions = useClobActions(clob);
  const allowances = useClobAllowances(clob, longToken, shortToken);
  const ammOutcome = outcome === CLOB_OUTCOME.Yes ? 'yes' : 'no';

  const ammBook = useMemo(
    () => buildOrderBook(reserveYes, reserveNo, feeBps, 7, ammOutcome),
    [reserveYes, reserveNo, feeBps, ammOutcome],
  );

  const bestBid = clobBook.bids[0];
  const bestAsk = clobBook.asks[0];
  const crossed = Boolean(bestBid && bestAsk && bestBid.price >= bestAsk.price);
  const busy = actions.isPending || actions.isConfirming;

  async function cancel(order: ClobOrder) {
    try {
      await actions.cancelOrder(order.id);
      toast.success('Order cancelled');
      await clobBook.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  async function fill(order: ClobOrder) {
    try {
      if (!isConnected) throw new Error('Connect a wallet to fill orders');
      const bestForSide = order.side === CLOB_SIDE.Sell ? bestAsk : bestBid;
      if (!bestForSide || bestForSide.id !== order.id) {
        throw new Error('Fill the best-priced order first');
      }

      if (order.side === CLOB_SIDE.Buy) {
        const token = order.outcome === CLOB_OUTCOME.Yes ? longToken : shortToken;
        const allowance = order.outcome === CLOB_OUTCOME.Yes ? allowances.yesAllowance : allowances.noAllowance;
        if (!token) throw new Error('Outcome token unavailable');
        if ((allowance ?? 0n) < order.amountRemaining) {
          toast.message(`Approving ${outcomeLabel(order.outcome).toUpperCase()} tokens for CLOB...`);
          await actions.approve(token);
        }
      } else {
        const quote = quoteUp(order.amountRemaining, order.price);
        if ((allowances.usdcAllowance ?? 0n) < quote) {
          toast.message('Approving USDC for CLOB...');
          await actions.approve(USDC_ADDRESS);
        }
      }

      toast.message(`Filling ${sideLabel(order.side)} ${outcomeLabel(order.outcome).toUpperCase()} limit...`);
      await actions.fillOrder(order.id);
      toast.success('Order filled');
      await clobBook.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fill failed');
    }
  }

  async function matchBest() {
    if (!bestBid || !bestAsk) return;
    try {
      await actions.matchOrders(bestBid.id, bestAsk.id);
      toast.success('Crossed orders matched');
      await clobBook.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Match failed');
    }
  }

  const asks = clobBook.asks;
  const bids = clobBook.bids;
  const asksDesc = ammBook ? [...ammBook.asks].sort((a, b) => b.price - a.price) : [];
  const bidsDesc = ammBook ? [...ammBook.bids].sort((a, b) => b.price - a.price) : [];

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="data-label text-gold">// ORDER BOOK</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={outcome === CLOB_OUTCOME.Yes ? 'success' : 'outline'}
            onClick={() => setOutcome(CLOB_OUTCOME.Yes)}
          >
            YES
          </Button>
          <Button
            size="sm"
            variant={outcome === CLOB_OUTCOME.No ? 'destructive' : 'outline'}
            onClick={() => setOutcome(CLOB_OUTCOME.No)}
          >
            NO
          </Button>
        </div>
      </div>

      {!clob ? (
        <div className="border border-border bg-surface px-3 py-2 text-data-xs text-muted-foreground">
          CLOB address unavailable for this market.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-2 pb-1">
            <span className="data-label">PRICE</span>
            <span className="data-label text-right">SIZE</span>
            <span className="data-label text-right">MAKER</span>
            <span className="data-label text-right">ACTION</span>
          </div>

          <div className="min-h-16">
            <div className="data-label mb-1 px-2 text-destructive">ASKS</div>
            {asks.length === 0 ? (
              <div className="px-2 py-2 text-data-xs text-muted-foreground">No sell limits.</div>
            ) : (
              asks.map((order) => (
                <ClobRow
                  key={order.id.toString()}
                  order={order}
                  mine={Boolean(address && order.maker.toLowerCase() === address.toLowerCase())}
                  busy={busy}
                  canFill={bestAsk?.id === order.id}
                  onCancel={cancel}
                  onFill={fill}
                />
              ))
            )}
          </div>

          <div className="my-2 flex items-center justify-between border-y border-border px-2 py-1">
            <span className="font-mono text-data-sm font-semibold text-gold">
              {bestBid && bestAsk
                ? `${(Number(formatUnits(bestBid.price, 18)) * 100).toFixed(1)} / ${(Number(formatUnits(bestAsk.price, 18)) * 100).toFixed(1)}`
                : 'OPEN'}
            </span>
            {crossed ? (
              <Button size="sm" disabled={!isConnected || busy} onClick={matchBest}>
                <GitCompareArrows className="h-3 w-3" /> Match
              </Button>
            ) : (
              <span className="data-label">SPREAD</span>
            )}
          </div>

          <div className="min-h-16">
            <div className="data-label mb-1 px-2 text-success">BIDS</div>
            {bids.length === 0 ? (
              <div className="px-2 py-2 text-data-xs text-muted-foreground">No buy limits.</div>
            ) : (
              bids.map((order) => (
                <ClobRow
                  key={order.id.toString()}
                  order={order}
                  mine={Boolean(address && order.maker.toLowerCase() === address.toLowerCase())}
                  busy={busy}
                  canFill={bestBid?.id === order.id}
                  onCancel={cancel}
                  onFill={fill}
                />
              ))
            )}
          </div>
        </>
      )}

      {ammBook && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="data-label">AMM DEPTH REF</span>
            <span className="data-label">{outcome === CLOB_OUTCOME.Yes ? 'YES' : 'NO'}</span>
          </div>
          <div className="flex flex-col-reverse">
            {asksDesc.slice(0, 4).map((l, i) => (
              <DepthRow key={`a${i}`} price={l.price} size={l.size} depth={l.total / ammBook.maxTotal} side="ask" />
            ))}
          </div>
          <div className="my-1 flex items-center justify-between border-y border-border px-2 py-1">
            <span className="font-mono text-data-xs text-gold">{(ammBook.mid * 100).toFixed(1)}%</span>
            <span className="data-label">AMM MID</span>
          </div>
          <div className="flex flex-col">
            {bidsDesc.slice(0, 4).map((l, i) => (
              <DepthRow key={`b${i}`} price={l.price} size={l.size} depth={l.total / ammBook.maxTotal} side="bid" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
