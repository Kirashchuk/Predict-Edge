// Client for the Hono backend (/v1/markets). Proxied via Vite dev server.

export interface UserMarket {
  id: string;
  address: string;
  ammAddress: string;
  title: string;
  category: string;
  createdAt: string;
}

const BASE = '/v1';

export async function fetchUserMarkets(): Promise<UserMarket[]> {
  const res = await fetch(`${BASE}/markets`);
  if (!res.ok) return [];
  return (await res.json()) as UserMarket[];
}

export async function createMarket(title: string): Promise<UserMarket> {
  const res = await fetch(`${BASE}/markets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Failed to create market');
  return data.market as UserMarket;
}
