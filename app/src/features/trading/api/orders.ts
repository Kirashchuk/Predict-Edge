export type OrderSide = 'buy' | 'sell';
export type Outcome = 'yes' | 'no';

export interface LimitOrder {
  id: string;
  market: string;
  owner: string;
  side: OrderSide;
  outcome: Outcome;
  limitPrice: number;
  size: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: string;
  filledAt?: string;
  txHash?: string;
}

const BASE = '/v1';

export async function fetchOrders(market: string): Promise<LimitOrder[]> {
  const res = await fetch(`${BASE}/orders?market=${market}`);
  if (!res.ok) return [];
  return (await res.json()) as LimitOrder[];
}

export async function placeOrder(input: {
  market: string;
  owner: string;
  side: OrderSide;
  outcome: Outcome;
  limitPrice: number;
  size: number;
}): Promise<LimitOrder> {
  const res = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Failed to place order');
  return data as LimitOrder;
}

export async function updateOrder(
  id: string,
  owner: string,
  status: 'filled' | 'cancelled',
  txHash?: string,
): Promise<void> {
  await fetch(`${BASE}/orders/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner, status, txHash }),
  });
}
