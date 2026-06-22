import { useMemo } from 'react';
import { type Address } from 'viem';
import { X } from 'lucide-react';
import { useWallet } from '@/features/wallet/WalletContext';
import { buildOrderBook } from './amm-math';
import { useOrders, useUpdateOrder, isFillable } from './hooks/useOrders';
import { useFillOrder } from './hooks/useFillOrder';

interface OrderBookProps {
  market: Address;
  amm?: Address;
  longToken?: Address;
  shortToken?: Address;
  reserveYes: number;
  reserveNo: number;
  feeBps: number;
  yesPrice: number; // 0..1
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

export function OrderBook({ market, amm, longToken, shortToken, reserveYes, reserveNo, feeBps, yesPrice }: OrderBookProps) {
  const { address } = useWallet();
  const { data: orders = [] } = useOrders(market);
  const cancel = useUpdateOrder(market);
  const { fill, fillingId } = useFillOrder(market, amm, longToken, shortToken);

  const book = useMemo(
    () => buildOrderBook(reserveYes, reserveNo, feeBps),
    [reserveYes, reserveNo, feeBps],
  );

  if (!book) {
    return (
      <div className="corner-markers border border-border bg-card p-4 text-data-sm text-muted-foreground">
        Order book unavailable (no liquidity).
      </div>
    );
  }

  const asksDesc = [...book.asks].sort((a, b) => b.price - a.price);
  const bidsDesc = [...book.bids].sort((a, b) => b.price - a.price);

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="data-label text-gold">// ORDER BOOK</span>
        <span className="data-label">AMM DEPTH · YES</span>
      </div>

      <div className="grid grid-cols-2 px-2 pb-1">
        <span className="data-label">PRICE</span>
        <span className="data-label text-right">SIZE (YES)</span>
      </div>

      {/* Asks (buying YES drives price up) */}
      <div className="flex flex-col-reverse">
        {asksDesc.map((l, i) => (
          <DepthRow key={`a${i}`} price={l.price} size={l.size} depth={l.total / book.maxTotal} side="ask" />
        ))}
      </div>

      {/* Mid */}
      <div className="my-1 flex items-center justify-between border-y border-border px-2 py-1">
        <span className="font-mono text-data-sm font-semibold text-gold">{(book.mid * 100).toFixed(1)}%</span>
        <span className="data-label">MID</span>
      </div>

      {/* Bids (selling YES drives price down) */}
      <div className="flex flex-col">
        {bidsDesc.map((l, i) => (
          <DepthRow key={`b${i}`} price={l.price} size={l.size} depth={l.total / book.maxTotal} side="bid" />
        ))}
      </div>

      {/* Open limit orders */}
      {orders.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="data-label mb-2">OPEN LIMIT ORDERS ({orders.length})</div>
          <div className="space-y-1">
            {orders.slice(0, 8).map((o) => {
              const fillable = isFillable(o, yesPrice);
              const mine = address && o.owner === address.toLowerCase();
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 px-2 py-1 text-data-xs">
                  <span className={`font-mono ${o.side === 'buy' ? 'text-success' : 'text-destructive'}`}>
                    {o.side.toUpperCase()} {o.outcome.toUpperCase()}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {(o.limitPrice * 100).toFixed(0)}% · {o.size}
                  </span>
                  {mine && fillable && (
                    <button
                      onClick={() => fill(o)}
                      disabled={fillingId === o.id}
                      className="border border-gold/60 bg-gold/15 px-1.5 font-mono text-[0.6rem] uppercase text-gold hover:bg-gold/25 disabled:opacity-50"
                    >
                      {fillingId === o.id ? '…' : 'Fill'}
                    </button>
                  )}
                  {!mine && fillable && <span className="font-mono text-gold">● fillable</span>}
                  {mine && (
                    <button
                      onClick={() => address && cancel.mutate({ id: o.id, owner: address, status: 'cancelled' })}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Cancel order"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
