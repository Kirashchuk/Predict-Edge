// Derive an order-book-style depth ladder from the constant-product AMM
// reserves. Asks simulate buying the selected outcome. Bids use the binary
// complement relation so prices stay within the 0..1 prediction-token range:
// YES bid = 1 - NO ask, and NO bid = 1 - YES ask.

export interface BookLevel {
  price: number; // effective avg price for this level (0..1)
  size: number; // incremental outcome-token size
  total: number; // cumulative size up to this level
}

export interface OrderBookDepth {
  mid: number;
  asks: BookLevel[];
  bids: BookLevel[];
  maxTotal: number; // for depth-bar scaling
}

const FEE_DEN = 10000;
const MIN_PRICE = 0.001;
const MAX_PRICE = 0.999;

type Outcome = 'yes' | 'no';

function boundedPrice(price: number) {
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, price));
}

function buyOutcomeStep(targetReserve: number, oppositeReserve: number, collateralIn: number, feeBps: number) {
  const effectiveIn = (collateralIn * (FEE_DEN - feeBps)) / FEE_DEN;
  const newOppositeReserve = oppositeReserve + effectiveIn;
  const swapTargetOut = targetReserve - (targetReserve * oppositeReserve) / newOppositeReserve;
  const totalTargetOut = collateralIn + swapTargetOut;

  if (!(totalTargetOut > 0)) return null;

  return {
    amountOut: totalTargetOut,
    price: collateralIn / totalTargetOut,
    nextTargetReserve: targetReserve - swapTargetOut,
    nextOppositeReserve: oppositeReserve + collateralIn,
  };
}

export function buildOrderBook(
  reserveYes: number,
  reserveNo: number,
  feeBps: number,
  levels = 7,
  outcome: Outcome = 'yes',
): OrderBookDepth | null {
  if (!(reserveYes > 0) || !(reserveNo > 0)) return null;

  const targetReserve = outcome === 'yes' ? reserveYes : reserveNo;
  const oppositeReserve = outcome === 'yes' ? reserveNo : reserveYes;
  const mid = oppositeReserve / (targetReserve + oppositeReserve);
  const chunk = Math.max(((targetReserve + oppositeReserve) / 2) * 0.04, 1e-6);

  let target = targetReserve;
  let opposite = oppositeReserve;
  const asks: BookLevel[] = [];
  let askTotal = 0;
  for (let i = 0; i < levels; i++) {
    const step = buyOutcomeStep(target, opposite, chunk, feeBps);
    if (!step) break;

    target = step.nextTargetReserve;
    opposite = step.nextOppositeReserve;
    askTotal += step.amountOut;
    asks.push({ price: boundedPrice(step.price), size: step.amountOut, total: askTotal });
  }

  target = targetReserve;
  opposite = oppositeReserve;
  const bids: BookLevel[] = [];
  let bidTotal = 0;
  for (let i = 0; i < levels; i++) {
    const step = buyOutcomeStep(opposite, target, chunk, feeBps);
    if (!step) break;

    const rawBid = 1 - step.price;
    if (!(rawBid > 0)) break;

    target = step.nextOppositeReserve;
    opposite = step.nextTargetReserve;
    bidTotal += step.amountOut;
    bids.push({ price: boundedPrice(rawBid), size: step.amountOut, total: bidTotal });
  }

  const maxTotal = Math.max(askTotal, bidTotal, 1e-9);
  return { mid, asks, bids, maxTotal };
}
