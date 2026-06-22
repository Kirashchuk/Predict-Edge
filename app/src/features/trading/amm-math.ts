// Derive an order-book-style depth ladder from the constant-product AMM
// reserves. This mirrors the exact reserve-update rules in PredictionMarketAMM
// (buyYes / sellYes), so the ladder reflects REAL on-chain liquidity — the
// price you'd get buying/selling YES at increasing size.

export interface BookLevel {
  price: number; // effective avg price for this level (0..1)
  size: number; // incremental size (USDC for asks / YES tokens for bids)
  total: number; // cumulative size up to this level
}

export interface OrderBookDepth {
  mid: number;
  asks: BookLevel[]; // buying YES pushes price up
  bids: BookLevel[]; // selling YES pushes price down
  maxTotal: number; // for depth-bar scaling
}

const FEE_DEN = 10000;

export function buildOrderBook(
  reserveYes: number,
  reserveNo: number,
  feeBps: number,
  levels = 7,
): OrderBookDepth | null {
  if (!(reserveYes > 0) || !(reserveNo > 0)) return null;
  const mid = reserveNo / (reserveYes + reserveNo);
  const chunk = Math.max(((reserveYes + reserveNo) / 2) * 0.04, 1e-6);

  // --- Asks: simulate buying YES in chunks (price rises) ---
  let ry = reserveYes;
  let rn = reserveNo;
  const asks: BookLevel[] = [];
  let askTotal = 0;
  for (let i = 0; i < levels; i++) {
    const dx = chunk;
    const eff = (dx * (FEE_DEN - feeBps)) / FEE_DEN;
    const newRn = rn + eff;
    const swapYesOut = ry - (ry * rn) / newRn;
    const yesOut = dx + swapYesOut;
    if (!(yesOut > 0)) break;
    ry -= swapYesOut;
    rn += dx;
    askTotal += yesOut;
    asks.push({ price: Math.min(0.999, dx / yesOut), size: yesOut, total: askTotal });
  }

  // --- Bids: simulate selling YES in chunks (price falls) ---
  ry = reserveYes;
  rn = reserveNo;
  const bids: BookLevel[] = [];
  let bidTotal = 0;
  const sellChunk = Math.max(reserveYes * 0.06, 1e-6);
  for (let i = 0; i < levels; i++) {
    const size = sellChunk;
    const eff = (size * (FEE_DEN - feeBps)) / FEE_DEN;
    const newRy = ry + eff;
    const noOut = rn - (ry * rn) / newRy;
    if (!(noOut > 0)) break;
    ry += size - noOut;
    rn -= noOut;
    bidTotal += size;
    bids.push({ price: Math.max(0.001, noOut / size), size, total: bidTotal });
  }

  const maxTotal = Math.max(askTotal, bidTotal, 1e-9);
  return { mid, asks, bids, maxTotal };
}
