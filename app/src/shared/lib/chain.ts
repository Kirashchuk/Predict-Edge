import { type Chain, parseGwei } from 'viem';

export const ARC_TESTNET_RPC_URL =
  import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network';

export const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
  fees: { defaultPriorityFee: parseGwei('2'), baseFeeMultiplier: 2 },
};
