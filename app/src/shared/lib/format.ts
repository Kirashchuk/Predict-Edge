import { formatUnits } from 'viem';

export function fmtToken(value: bigint | undefined, decimals = 18, maxFrac = 4): string {
  if (value === undefined) return '—';
  const n = Number(formatUnits(value, decimals));
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}

/** 18-decimal fixed-point price (0..1e18) -> percentage string. */
export function fmtPricePct(price: bigint | undefined): string {
  if (price === undefined) return '—';
  return `${(Number(formatUnits(price, 18)) * 100).toFixed(1)}%`;
}

export function shortAddr(addr?: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
