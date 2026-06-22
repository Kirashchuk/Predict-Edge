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
  // --- Crypto ---
  { id: 'eth-flip', title: 'Will ETH flip BTC by 2027?', category: 'Crypto', staticYes: 0.18, live: false },
  { id: 'eth-10k', title: 'Will Ethereum trade above $10,000 this year?', category: 'Crypto', staticYes: 0.41, live: false },
  { id: 'sol-500', title: 'Will Solana reach $500 before 2027?', category: 'Crypto', staticYes: 0.29, live: false },
  { id: 'btc-etf-inflow', title: 'Will spot BTC ETFs see net inflows this quarter?', category: 'Crypto', staticYes: 0.66, live: false },
  { id: 'stable-1t', title: 'Will stablecoin market cap top $400B this year?', category: 'Crypto', staticYes: 0.52, live: false },

  // --- Economy ---
  { id: 'fed-cut', title: 'Will the Fed cut rates at the next meeting?', category: 'Economy', staticYes: 0.62, live: false },
  { id: 'us-recession', title: 'Will the US enter a recession in 2026?', category: 'Economy', staticYes: 0.27, live: false },
  { id: 'cpi-under3', title: 'Will US CPI come in under 3% next print?', category: 'Economy', staticYes: 0.58, live: false },
  { id: 'unemp-5', title: 'Will US unemployment exceed 5% this year?', category: 'Economy', staticYes: 0.22, live: false },

  // --- Equities ---
  { id: 'sp500-ath', title: 'Will the S&P 500 hit a new ATH this quarter?', category: 'Equities', staticYes: 0.55, live: false },
  { id: 'nvda-5t', title: 'Will Nvidia reach a $5T market cap this year?', category: 'Equities', staticYes: 0.44, live: false },
  { id: 'nasdaq-correction', title: 'Will the Nasdaq drop 10% from its high this quarter?', category: 'Equities', staticYes: 0.31, live: false },

  // --- Commodities ---
  { id: 'gold-2500', title: 'Will gold close above $2,500/oz this year?', category: 'Commodities', staticYes: 0.71, live: false },
  { id: 'oil-60', title: 'Will WTI crude drop below $60 this year?', category: 'Commodities', staticYes: 0.34, live: false },
  { id: 'silver-40', title: 'Will silver break $40/oz before 2027?', category: 'Commodities', staticYes: 0.38, live: false },

  { id: 'btc-200k', title: 'Will Bitcoin reach $200,000 before 2028?', category: 'Crypto', staticYes: 0.36, live: false },
  { id: 'l2-tvl', title: 'Will total L2 TVL double by year end?', category: 'Crypto', staticYes: 0.47, live: false },

  // --- Economy ---
  { id: 'gdp-3', title: 'Will US GDP growth exceed 3% this year?', category: 'Economy', staticYes: 0.33, live: false },
  { id: 'rate-zero', title: 'Will the Fed funds rate fall below 3% this year?', category: 'Economy', staticYes: 0.45, live: false },

  // --- Equities ---
  { id: 'aapl-4t', title: 'Will Apple stay above a $4T market cap all quarter?', category: 'Equities', staticYes: 0.6, live: false },
  { id: 'ipo-wave', title: 'Will there be 5+ unicorn IPOs this quarter?', category: 'Equities', staticYes: 0.4, live: false },

  // --- Commodities ---
  { id: 'gas-low', title: 'Will US natural gas stay below $3/MMBtu this quarter?', category: 'Commodities', staticYes: 0.53, live: false },
  { id: 'copper-high', title: 'Will copper hit a new all-time high this year?', category: 'Commodities', staticYes: 0.42, live: false },

  // --- Geopolitics ---
  { id: 'eu-rate', title: 'Will the ECB hold rates steady through Q3?', category: 'Geopolitics', staticYes: 0.49, live: false },
  { id: 'opec-cut', title: 'Will OPEC+ announce a production cut this year?', category: 'Geopolitics', staticYes: 0.57, live: false },
  { id: 'brics-currency', title: 'Will BRICS announce a shared settlement currency this year?', category: 'Geopolitics', staticYes: 0.16, live: false },
  { id: 'uk-election', title: 'Will the UK hold a general election this year?', category: 'Geopolitics', staticYes: 0.25, live: false },
];
