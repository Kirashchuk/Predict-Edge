import type { Address } from 'viem';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

const get = (v: string | undefined): Address => (v && v.length === 42 ? (v as Address) : ZERO);

export const ARCT_ADDRESS = get(import.meta.env.VITE_ARCT_ADDRESS);
export const MARKET_ADDRESS = get(import.meta.env.VITE_MARKET_ADDRESS);
export const AMM_ADDRESS = get(import.meta.env.VITE_AMM_ADDRESS);
export const OO_V2_ADDRESS = get(import.meta.env.VITE_OO_V2_ADDRESS);
export const FINDER_ADDRESS = get(import.meta.env.VITE_FINDER_ADDRESS);
export const TIMER_ADDRESS = get(import.meta.env.VITE_TIMER_ADDRESS);

export const COLLATERAL_DECIMALS = 18;
