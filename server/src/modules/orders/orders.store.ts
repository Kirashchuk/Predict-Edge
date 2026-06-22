import * as fs from 'node:fs';
import { ORDERS_FILE } from '../../core/paths';

export type OrderSide = 'buy' | 'sell';
export type Outcome = 'yes' | 'no';
export type OrderStatus = 'open' | 'filled' | 'cancelled';

export interface LimitOrder {
  id: string;
  market: string; // market address (lowercased)
  owner: string; // wallet address (lowercased)
  side: OrderSide;
  outcome: Outcome;
  /** Limit price for the outcome, 0..1 (18-dec-style ratio as a float). */
  limitPrice: number;
  /** Size in USDC (buy) or in outcome tokens (sell). */
  size: number;
  status: OrderStatus;
  createdAt: string;
  filledAt?: string;
  txHash?: string;
}

function readAll(): LimitOrder[] {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8')) as LimitOrder[];
  } catch {
    return [];
  }
}

function writeAll(orders: LimitOrder[]): void {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2) + '\n');
}

export function listOrders(market?: string, owner?: string): LimitOrder[] {
  let out = readAll().filter((o) => o.status === 'open');
  if (market) out = out.filter((o) => o.market === market.toLowerCase());
  if (owner) out = out.filter((o) => o.owner === owner.toLowerCase());
  return out.sort((a, b) => b.limitPrice - a.limitPrice);
}

export function createOrder(input: Omit<LimitOrder, 'id' | 'status' | 'createdAt'>): LimitOrder {
  const orders = readAll();
  const order: LimitOrder = {
    ...input,
    market: input.market.toLowerCase(),
    owner: input.owner.toLowerCase(),
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  orders.unshift(order);
  writeAll(orders);
  return order;
}

export function updateOrder(id: string, owner: string, patch: Partial<LimitOrder>): LimitOrder | null {
  const orders = readAll();
  const idx = orders.findIndex((o) => o.id === id && o.owner === owner.toLowerCase());
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch };
  writeAll(orders);
  return orders[idx];
}
