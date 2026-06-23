import { useMemo, useState } from "react";
import { type Address, formatUnits, parseEther } from "viem";
import { GitCompareArrows, X } from "lucide-react";
import { useWallet } from "@/features/wallet/WalletContext";
import {
  COLLATERAL_DECIMALS,
  USDC_ADDRESS,
} from "@/shared/lib/contracts/addresses";
import { shortAddr } from "@/shared/lib/format";
import { Button } from "@/shared/ui/primitives/button";
import { toast } from "@/shared/ui/primitives/sonner";
import { buildOrderBook, type BookLevel } from "./amm-math";
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
} from "./hooks/useClob";

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

const PRICE_SCALE = parseEther("1");

function quoteUp(amount: bigint, price: bigint): bigint {
  return (amount * price + PRICE_SCALE - 1n) / PRICE_SCALE;
}

function tokenAmount(orderAmount: bigint): number {
  return Number(formatUnits(orderAmount, COLLATERAL_DECIMALS));
}

function formatBookAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0.00";
  if (amount >= 1000) return amount.toFixed(0);
  if (amount >= 1) return amount.toFixed(2);
  return amount.toFixed(4);
}

type BookSide = "ask" | "bid";

type CombinedBookLevel =
  | {
      id: string;
      kind: "clob";
      side: BookSide;
      price: number;
      size: number;
      depth: number;
      order: ClobOrder;
    }
  | {
      id: string;
      kind: "amm";
      side: BookSide;
      price: number;
      size: number;
      depth: number;
    };

function ammLevel(
  side: BookSide,
  level: BookLevel,
  index: number,
): CombinedBookLevel {
  return {
    id: `amm-${side}-${index}`,
    kind: "amm",
    side,
    price: level.price,
    size: level.size,
    depth: level.total,
  };
}

function clobLevel(side: BookSide, order: ClobOrder): CombinedBookLevel {
  const size = tokenAmount(order.amountRemaining);
  return {
    id: `clob-${order.id.toString()}`,
    kind: "clob",
    side,
    price: Number(formatUnits(order.price, 18)),
    size,
    depth: size,
    order,
  };
}

function CombinedRow({
  level,
  mine,
  busy,
  canFill,
  maxDepth,
  onCancel,
  onFill,
}: {
  level: CombinedBookLevel;
  mine: boolean;
  busy: boolean;
  canFill: boolean;
  maxDepth: number;
  onCancel: (order: ClobOrder) => void;
  onFill: (order: ClobOrder) => void;
}) {
  const color = level.side === "bid" ? "text-success" : "text-destructive";
  const bar = level.side === "bid" ? "bg-success/15" : "bg-destructive/15";
  const depthPct = Math.min(100, Math.max(3, (level.depth / maxDepth) * 100));
  return (
    <div className="relative grid min-h-8 grid-cols-[0.9fr_0.9fr_0.9fr_auto] items-center gap-2 overflow-hidden px-2 py-1 text-data-xs">
      <div
        className={`absolute inset-y-0 right-0 ${bar}`}
        style={{ width: `${depthPct}%` }}
      />
      <span className={`relative font-mono ${color}`}>
        {(level.price * 100).toFixed(1)}%
      </span>
      <span className="relative text-right font-mono text-muted-foreground">
        {formatBookAmount(level.size)}
      </span>
      <span className="relative truncate text-right font-mono text-muted-foreground">
        {level.kind === "amm"
          ? "AMM"
          : mine
            ? "you"
            : shortAddr(level.order.maker)}
      </span>
      <span className="relative text-right">
        {level.kind === "amm" ? (
          <span className="data-label text-muted-foreground">depth</span>
        ) : mine ? (
          <button
            onClick={() => onCancel(level.order)}
            disabled={busy}
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
            aria-label="Cancel order"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={() => onFill(level.order)}
            disabled={busy || !canFill}
            title={
              canFill ? undefined : "Fill the best-priced CLOB order first"
            }
            className="border border-gold/60 bg-gold/15 px-1.5 font-mono text-[0.6rem] uppercase text-gold hover:bg-gold/25 disabled:opacity-50"
          >
            Fill
          </button>
        )}
      </span>
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
  const ammOutcome = outcome === CLOB_OUTCOME.Yes ? "yes" : "no";

  const ammBook = useMemo(
    () => buildOrderBook(reserveYes, reserveNo, feeBps, 7, ammOutcome),
    [reserveYes, reserveNo, feeBps, ammOutcome],
  );

  const bestBid = clobBook.bids[0];
  const bestAsk = clobBook.asks[0];
  const crossed = Boolean(bestBid && bestAsk && bestBid.price >= bestAsk.price);
  const busy = actions.isPending || actions.isConfirming;

  const { asks, bids, maxDepth, bestAskPrice, bestBidPrice } = useMemo(() => {
    const ammAsks =
      ammBook?.asks.map((level, index) => ammLevel("ask", level, index)) ?? [];
    const ammBids =
      ammBook?.bids.map((level, index) => ammLevel("bid", level, index)) ?? [];
    const nextAsks = [
      ...ammAsks,
      ...clobBook.asks.map((order) => clobLevel("ask", order)),
    ].sort((a, b) => b.price - a.price || b.size - a.size);
    const nextBids = [
      ...ammBids,
      ...clobBook.bids.map((order) => clobLevel("bid", order)),
    ].sort((a, b) => b.price - a.price || b.size - a.size);
    const depths = [...nextAsks, ...nextBids].map((level) => level.depth);
    return {
      asks: nextAsks,
      bids: nextBids,
      maxDepth: Math.max(...depths, 1e-9),
      bestAskPrice: nextAsks.length
        ? Math.min(...nextAsks.map((level) => level.price))
        : undefined,
      bestBidPrice: nextBids.length
        ? Math.max(...nextBids.map((level) => level.price))
        : undefined,
    };
  }, [ammBook, clobBook.asks, clobBook.bids]);

  async function cancel(order: ClobOrder) {
    try {
      await actions.cancelOrder(order.id);
      toast.success("Order cancelled");
      await clobBook.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  async function fill(order: ClobOrder) {
    try {
      if (!isConnected) throw new Error("Connect a wallet to fill orders");
      const bestForSide = order.side === CLOB_SIDE.Sell ? bestAsk : bestBid;
      if (!bestForSide || bestForSide.id !== order.id) {
        throw new Error("Fill the best-priced order first");
      }

      if (order.side === CLOB_SIDE.Buy) {
        const token =
          order.outcome === CLOB_OUTCOME.Yes ? longToken : shortToken;
        const allowance =
          order.outcome === CLOB_OUTCOME.Yes
            ? allowances.yesAllowance
            : allowances.noAllowance;
        if (!token) throw new Error("Outcome token unavailable");
        if ((allowance ?? 0n) < order.amountRemaining) {
          toast.message(
            `Approving ${outcomeLabel(order.outcome).toUpperCase()} tokens for CLOB...`,
          );
          await actions.approve(token);
        }
      } else {
        const quote = quoteUp(order.amountRemaining, order.price);
        if ((allowances.usdcAllowance ?? 0n) < quote) {
          toast.message("Approving USDC for CLOB...");
          await actions.approve(USDC_ADDRESS);
        }
      }

      toast.message(
        `Filling ${sideLabel(order.side)} ${outcomeLabel(order.outcome).toUpperCase()} limit...`,
      );
      await actions.fillOrder(order.id);
      toast.success("Order filled");
      await clobBook.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fill failed");
    }
  }

  async function matchBest() {
    if (!bestBid || !bestAsk) return;
    try {
      await actions.matchOrders(bestBid.id, bestAsk.id);
      toast.success("Crossed orders matched");
      await clobBook.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    }
  }

  const spreadLabel =
    bestBidPrice !== undefined && bestAskPrice !== undefined
      ? `${(bestBidPrice * 100).toFixed(1)} / ${(bestAskPrice * 100).toFixed(1)}`
      : "OPEN";

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="data-label text-gold">// ORDER BOOK</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={outcome === CLOB_OUTCOME.Yes ? "success" : "outline"}
            onClick={() => setOutcome(CLOB_OUTCOME.Yes)}
          >
            YES
          </Button>
          <Button
            size="sm"
            variant={outcome === CLOB_OUTCOME.No ? "destructive" : "outline"}
            onClick={() => setOutcome(CLOB_OUTCOME.No)}
          >
            NO
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[0.9fr_0.9fr_0.9fr_auto] gap-2 px-2 pb-1">
        <span className="data-label">PRICE</span>
        <span className="data-label text-right">SIZE</span>
        <span className="data-label text-right">SOURCE</span>
        <span className="data-label text-right">ACTION</span>
      </div>

      <div className="min-h-24">
        <div className="data-label mb-1 px-2 text-destructive">ASKS</div>
        {asks.length === 0 ? (
          <div className="px-2 py-2 text-data-xs text-muted-foreground">
            No ask liquidity.
          </div>
        ) : (
          asks.map((level) => (
            <CombinedRow
              key={level.id}
              level={level}
              mine={
                level.kind === "clob" &&
                Boolean(
                  address &&
                  level.order.maker.toLowerCase() === address.toLowerCase(),
                )
              }
              busy={busy}
              maxDepth={maxDepth}
              canFill={level.kind === "clob" && bestAsk?.id === level.order.id}
              onCancel={cancel}
              onFill={fill}
            />
          ))
        )}
      </div>

      <div className="my-2 flex items-center justify-between border-y border-border px-2 py-1">
        <span className="font-mono text-data-sm font-semibold text-gold">
          {spreadLabel}
        </span>
        {crossed ? (
          <Button size="sm" disabled={!isConnected || busy} onClick={matchBest}>
            <GitCompareArrows className="h-3 w-3" /> Match
          </Button>
        ) : (
          <span className="data-label">
            {ammBook ? `AMM MID ${(ammBook.mid * 100).toFixed(1)}%` : "SPREAD"}
          </span>
        )}
      </div>

      <div className="min-h-24">
        <div className="data-label mb-1 px-2 text-success">BIDS</div>
        {bids.length === 0 ? (
          <div className="px-2 py-2 text-data-xs text-muted-foreground">
            No bid liquidity.
          </div>
        ) : (
          bids.map((level) => (
            <CombinedRow
              key={level.id}
              level={level}
              mine={
                level.kind === "clob" &&
                Boolean(
                  address &&
                  level.order.maker.toLowerCase() === address.toLowerCase(),
                )
              }
              busy={busy}
              maxDepth={maxDepth}
              canFill={level.kind === "clob" && bestBid?.id === level.order.id}
              onCancel={cancel}
              onFill={fill}
            />
          ))
        )}
      </div>

      {!clob && (
        <div className="mt-3 border border-border bg-surface px-3 py-2 text-data-xs text-muted-foreground">
          CLOB unavailable; showing AMM depth only.
        </div>
      )}
    </div>
  );
}
