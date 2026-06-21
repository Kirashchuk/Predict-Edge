import { MARKET_ADDRESS, AMM_ADDRESS } from '@/shared/lib/contracts/addresses';

export type MarketCategory =
  | 'Crypto'
  | 'Economy'
  | 'Equities'
  | 'Commodities'
  | 'Geopolitics';

export interface MarketEntry {
  id: string;
  title: string;
  category: MarketCategory;
  /** On-chain market address; undefined for static demo markets. */
  address?: string;
  ammAddress?: string;
  /** Static probability (0..1) for demo markets without a live AMM. */
  staticYes?: number;
  live: boolean;
}

export const CATEGORIES: MarketCategory[] = [
  'Crypto',
  'Economy',
  'Equities',
  'Commodities',
  'Geopolitics',
];

// One live on-chain market (deployed by scripts/deploy.ts) + demo markets.
export const STATIC_MARKETS: MarketEntry[] = [
  {
    id: 'btc100k',
    title: 'Will Bitcoin exceed $100,000 before June 1, 2026?',
    category: 'Crypto',
    address: MARKET_ADDRESS,
    ammAddress: AMM_ADDRESS,
    live: true,
  },
  { id: 'eth-flip', title: 'Will ETH flip BTC by 2027?', category: 'Crypto', staticYes: 0.18, live: false },
  { id: 'fed-cut', title: 'Will the Fed cut rates at the next meeting?', category: 'Economy', staticYes: 0.62, live: false },
  { id: 'sp500-ath', title: 'Will the S&P 500 hit a new ATH this quarter?', category: 'Equities', staticYes: 0.55, live: false },
  { id: 'gold-2500', title: 'Will gold close above $2,500/oz this year?', category: 'Commodities', staticYes: 0.71, live: false },
  { id: 'oil-60', title: 'Will WTI crude drop below $60 this year?', category: 'Commodities', staticYes: 0.34, live: false },
];
