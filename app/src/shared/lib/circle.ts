import { createPublicClient, http, parseGwei } from 'viem';
import { toPasskeyTransport, toModularTransport } from '@circle-fin/modular-wallets-core';
import type { CustomTransport } from 'viem';
import { arcTestnet, ARC_TESTNET_RPC_URL } from '@/shared/lib/chain';

const clientKey = import.meta.env.VITE_CIRCLE_CLIENT_KEY ?? '';
const clientUrl = import.meta.env.VITE_CIRCLE_CLIENT_URL ?? '';

const PLACEHOLDER_VALUES = ['your_circle_client_key_here', 'your_circle_client_url_here', ''];

export function isCircleConfigured(): boolean {
  return !PLACEHOLDER_VALUES.includes(clientKey) && !PLACEHOLDER_VALUES.includes(clientUrl);
}

let _passkeyTransport: CustomTransport | null = null;
let _modularTransport: CustomTransport | null = null;
let _circlePublicClient: ReturnType<typeof createPublicClient> | null = null;
let _directPublicClient: ReturnType<typeof createPublicClient> | null = null;

function assertCircleConfigured(): void {
  if (!isCircleConfigured()) {
    throw new Error(
      'Circle wallet is not configured. Set VITE_CIRCLE_CLIENT_KEY and VITE_CIRCLE_CLIENT_URL in app/.env.local.',
    );
  }
}

export function getPasskeyTransport(): CustomTransport {
  assertCircleConfigured();
  if (!_passkeyTransport) _passkeyTransport = toPasskeyTransport(clientUrl, clientKey);
  return _passkeyTransport;
}

export function getModularTransport(): CustomTransport {
  assertCircleConfigured();
  if (!_modularTransport) _modularTransport = toModularTransport(`${clientUrl}/arcTestnet`, clientKey);
  return _modularTransport;
}

export function getCirclePublicClient() {
  assertCircleConfigured();
  if (!_circlePublicClient) {
    _circlePublicClient = createPublicClient({ chain: arcTestnet, transport: getModularTransport() });
  }
  return _circlePublicClient;
}

export function getDirectPublicClient() {
  if (!_directPublicClient) {
    _directPublicClient = createPublicClient({ chain: arcTestnet, transport: http(ARC_TESTNET_RPC_URL) });
  }
  return _directPublicClient;
}

// --- UserOperation gas pricing (Pimlico-compatible bundler) ---------------
const MIN_PRIORITY_FEE = parseGwei('1');
const FALLBACK_BASE_FEE = parseGwei('48');

interface PimlicoGasPriceTier {
  maxFeePerGas: `0x${string}` | string;
  maxPriorityFeePerGas: `0x${string}` | string;
}
interface PimlicoGasPrice {
  slow?: PimlicoGasPriceTier;
  standard?: PimlicoGasPriceTier;
  fast?: PimlicoGasPriceTier;
}
interface BundlerRequester {
  request: (args: { method: string }) => Promise<unknown>;
}

export async function estimateUserOpFees({
  bundlerClient,
}: {
  bundlerClient: unknown;
}): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const fees = (await (bundlerClient as BundlerRequester)
    .request({ method: 'pimlico_getUserOperationGasPrice' })
    .catch(() => null)) as PimlicoGasPrice | null;

  const tier = fees?.fast ?? fees?.standard ?? fees?.slow;
  if (tier) {
    const priority = BigInt(tier.maxPriorityFeePerGas);
    return {
      maxFeePerGas: BigInt(tier.maxFeePerGas),
      maxPriorityFeePerGas: priority < MIN_PRIORITY_FEE ? MIN_PRIORITY_FEE : priority,
    };
  }

  const block = await getDirectPublicClient().getBlock();
  const baseFee = block.baseFeePerGas ?? FALLBACK_BASE_FEE;
  return { maxFeePerGas: baseFee * 2n + MIN_PRIORITY_FEE, maxPriorityFeePerGas: MIN_PRIORITY_FEE };
}
