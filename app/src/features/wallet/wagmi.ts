import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { arcTestnet, ARC_TESTNET_RPC_URL } from '@/shared/lib/chain';

export const WAGMI_POLLING_INTERVAL = 2_000;
export const LIVE_STATE_REFETCH_INTERVAL = 5_000;

export { arcTestnet };

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  pollingInterval: WAGMI_POLLING_INTERVAL,
  transports: { [arcTestnet.id]: http(ARC_TESTNET_RPC_URL) },
});
