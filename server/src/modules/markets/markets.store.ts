import * as fs from 'node:fs';
import { MARKETS_FILE } from '../../core/paths';

export interface StoredMarket {
  id: string;
  address: string;
  ammAddress: string;
  title: string;
  category: string;
  createdAt: string;
}

export function readMarkets(): StoredMarket[] {
  try {
    const data = fs.readFileSync(MARKETS_FILE, 'utf-8');
    return JSON.parse(data) as StoredMarket[];
  } catch {
    return [];
  }
}

export function writeMarkets(markets: StoredMarket[]): void {
  fs.writeFileSync(MARKETS_FILE, JSON.stringify(markets, null, 2) + '\n');
}

export function prependMarket(market: StoredMarket): void {
  const markets = readMarkets();
  markets.unshift(market);
  writeMarkets(markets);
}
