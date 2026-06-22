import type { Address } from 'viem';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

const get = (v: string | undefined): Address => (v && v.length === 42 ? (v as Address) : ZERO);

// Arc Testnet native USDC exposed as an ERC-20 at a fixed system address
// (6 decimals). This is the collateral token for trading.
export const USDC_ADDRESS: Address =
  get(import.meta.env.VITE_USDC_ADDRESS) !== ZERO
    ? get(import.meta.env.VITE_USDC_ADDRESS)
    : ('0x3600000000000000000000000000000000000000' as Address);

export const MARKET_ADDRESS = get(import.meta.env.VITE_MARKET_ADDRESS);
export const AMM_ADDRESS = get(import.meta.env.VITE_AMM_ADDRESS);
export const CLOB_ADDRESS = get(import.meta.env.VITE_CLOB_ADDRESS);
export const OO_V2_ADDRESS = get(import.meta.env.VITE_OO_V2_ADDRESS);
export const FINDER_ADDRESS = get(import.meta.env.VITE_FINDER_ADDRESS);
export const TIMER_ADDRESS = get(import.meta.env.VITE_TIMER_ADDRESS);

// USDC ERC-20 on Arc uses 6 decimals (native gas USDC uses 18 — do not mix).
export const COLLATERAL_DECIMALS = 6;
export const COLLATERAL_SYMBOL = 'USDC';
