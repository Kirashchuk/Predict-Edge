/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ARC_RPC_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_MARKET_ADDRESS?: string;
  readonly VITE_AMM_ADDRESS?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_OO_V2_ADDRESS?: string;
  readonly VITE_FINDER_ADDRESS?: string;
  readonly VITE_TIMER_ADDRESS?: string;
  readonly VITE_CIRCLE_CLIENT_KEY?: string;
  readonly VITE_CIRCLE_CLIENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
