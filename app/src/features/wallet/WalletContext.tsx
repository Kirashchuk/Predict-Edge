import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { type Address, type Hex, encodeFunctionData } from 'viem';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  toWebAuthnCredential,
  toCircleSmartAccount,
  WebAuthnMode,
} from '@circle-fin/modular-wallets-core';
import { toWebAuthnAccount, createBundlerClient } from 'viem/account-abstraction';
import {
  getPasskeyTransport,
  getModularTransport,
  getCirclePublicClient,
  isCircleConfigured,
  estimateUserOpFees,
} from '@/shared/lib/circle';
import { arcTestnet } from '@/features/wallet/wagmi';

const STORAGE_KEY = 'circle-wallet-credential';

interface StoredCredential {
  credentialId: string;
}

export type WalletType = 'metamask' | 'circle' | null;

interface CircleBundlerClient {
  sendUserOperation: (args: {
    calls: { to: Hex; data: Hex; value?: bigint }[];
    paymaster: true;
  }) => Promise<Hex>;
  waitForUserOperationReceipt: (args: { hash: Hex }) => Promise<{ receipt: { transactionHash: Hex } }>;
}

interface WalletContextValue {
  address: Address | undefined;
  isConnected: boolean;
  walletType: WalletType;
  bundlerClient: CircleBundlerClient | null;
  connectMetaMask: () => void;
  connectCircle: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  circleConfigured: boolean;
  circleError: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connect: wagmiConnect, isPending: wagmiPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const [circleAddress, setCircleAddress] = useState<Address | undefined>();
  const [bundlerClient, setBundlerClient] = useState<CircleBundlerClient | null>(null);
  const [circleConnecting, setCircleConnecting] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);
  const restoringRef = useRef(false);

  const walletType: WalletType = wagmiConnected ? 'metamask' : circleAddress ? 'circle' : null;
  const address = walletType === 'metamask' ? wagmiAddress : circleAddress;
  const isConnected = walletType !== null;

  const initCircleAccount = useCallback(
    async (credential: Awaited<ReturnType<typeof toWebAuthnCredential>>) => {
      const owner = toWebAuthnAccount({ credential });
      // viem type skew between @circle-fin's bundled viem and the app's viem
      // collapses these client/account params to `never`; cast through to call.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const smartAccount = await (
        toCircleSmartAccount as unknown as (a: any) => Promise<{ address: Address }>
      )({ client: getCirclePublicClient(), owner });
      const client = (createBundlerClient as unknown as (a: any) => CircleBundlerClient)({
        account: smartAccount,
        chain: arcTestnet,
        transport: getModularTransport(),
        paymaster: true,
        userOperation: { estimateFeesPerGas: estimateUserOpFees },
      });
      /* eslint-enable @typescript-eslint/no-explicit-any */
      setCircleAddress(smartAccount.address);
      setBundlerClient(client);
    },
    [],
  );

  const connectCircle = useCallback(async () => {
    setCircleConnecting(true);
    setCircleError(null);
    try {
      if (!isCircleConfigured()) {
        throw new Error(
          'Circle wallet is not configured. Set VITE_CIRCLE_CLIENT_KEY and VITE_CIRCLE_CLIENT_URL in app/.env.local.',
        );
      }
      if (wagmiConnected) wagmiDisconnect();

      let credential: Awaited<ReturnType<typeof toWebAuthnCredential>>;
      try {
        credential = await toWebAuthnCredential({ transport: getPasskeyTransport(), mode: WebAuthnMode.Login });
      } catch {
        const username = `user_${crypto.randomUUID().slice(0, 8)}`;
        credential = await toWebAuthnCredential({
          transport: getPasskeyTransport(),
          mode: WebAuthnMode.Register,
          username,
        });
      }
      await initCircleAccount(credential);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ credentialId: credential.id } as StoredCredential));
    } catch (err) {
      console.error('Circle wallet connection failed:', err);
      setCircleError(err instanceof Error ? err.message : 'Failed to connect passkey wallet');
    } finally {
      setCircleConnecting(false);
    }
  }, [wagmiConnected, wagmiDisconnect, initCircleAccount]);

  const connectMetaMask = useCallback(() => {
    if (circleAddress) {
      setCircleAddress(undefined);
      setBundlerClient(null);
      localStorage.removeItem(STORAGE_KEY);
    }
    wagmiConnect({ connector: injected() });
  }, [circleAddress, wagmiConnect]);

  const disconnect = useCallback(() => {
    if (walletType === 'metamask') {
      wagmiDisconnect();
    } else if (walletType === 'circle') {
      setCircleAddress(undefined);
      setBundlerClient(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [walletType, wagmiDisconnect]);

  // Restore Circle session from localStorage on mount.
  useEffect(() => {
    if (restoringRef.current || !isCircleConfigured()) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || wagmiConnected) return;
    restoringRef.current = true;
    const stored: StoredCredential = JSON.parse(raw);
    (async () => {
      try {
        setCircleConnecting(true);
        const credential = await toWebAuthnCredential({
          transport: getPasskeyTransport(),
          mode: WebAuthnMode.Login,
          credentialId: stored.credentialId,
        });
        await initCircleAccount(credential);
      } catch (err) {
        console.error('Failed to restore Circle session:', err);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setCircleConnecting(false);
        restoringRef.current = false;
      }
    })();
  }, [wagmiConnected, initCircleAccount]);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        walletType,
        bundlerClient,
        connectMetaMask,
        connectCircle,
        disconnect,
        isConnecting: wagmiPending || circleConnecting,
        circleConfigured: isCircleConfigured(),
        circleError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function encodeContractCall(params: {
  address: Address;
  abi: readonly Record<string, unknown>[];
  functionName: string;
  args?: readonly unknown[];
}): { to: Hex; data: Hex; value?: bigint } {
  return {
    to: params.address as Hex,
    data: encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args as unknown[],
    }),
  };
}
