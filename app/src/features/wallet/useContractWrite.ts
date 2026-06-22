import { useState, useCallback } from 'react';
import { usePublicClient, useWriteContract, useAccount, useSwitchChain } from 'wagmi';
import { type Abi, type Address, type Hex, encodeFunctionData } from 'viem';
import { useWallet } from '@/features/wallet/WalletContext';
import { WAGMI_POLLING_INTERVAL, arcTestnet } from '@/features/wallet/wagmi';

/** Ensure the injected wallet is on Arc Testnet, switching/adding it if not.
 *  Critical: without this, wagmi sends the tx on whatever chain MetaMask is on
 *  (e.g. Ethereum mainnet), spending real funds on the wrong network. */
export async function ensureArcChain(
  connectedChainId: number | undefined,
  switchChainAsync: (a: { chainId: number }) => Promise<unknown>,
) {
  if (connectedChainId === arcTestnet.id) return;
  try {
    await switchChainAsync({ chainId: arcTestnet.id });
  } catch {
    throw new Error('Wrong network. Switch your wallet to Arc Testnet (chain 5042002) and retry.');
  }
}

interface ContractWriteParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Unified write hook for both wallet types: a Circle passkey smart account
 * (UserOperation via the bundler, gas sponsored by the paymaster) or an
 * injected EVM wallet (MetaMask) via wagmi.
 */
export function useContractWrite() {
  const { walletType, bundlerClient } = useWallet();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [hash, setHash] = useState<Hex | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const write = useCallback(
    async (params: ContractWriteParams) => {
      setIsPending(true);
      setIsConfirming(false);
      setIsSuccess(false);
      setError(null);
      setHash(undefined);

      if (walletType === 'circle' && bundlerClient) {
        try {
          const data = encodeFunctionData({
            abi: params.abi,
            functionName: params.functionName,
            args: params.args as unknown[],
          });
          const userOpHash = await bundlerClient.sendUserOperation({
            calls: [{ to: params.address as Hex, data }],
            paymaster: true,
          });
          setIsPending(false);
          setIsConfirming(true);
          const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
          setHash(receipt.transactionHash);
          setIsConfirming(false);
          setIsSuccess(true);
        } catch (err) {
          setIsPending(false);
          setIsConfirming(false);
          setError(err instanceof Error ? err : new Error('Transaction failed'));
        }
      } else {
        try {
          if (!publicClient) throw new Error('No public client available');
          // Force Arc Testnet before sending — never let a tx hit mainnet.
          await ensureArcChain(connectedChainId, switchChainAsync);
          const txHash = await writeContractAsync({
            address: params.address,
            abi: params.abi,
            functionName: params.functionName,
            args: params.args as unknown[],
            chainId: arcTestnet.id,
          } as unknown as Parameters<typeof writeContractAsync>[0]);
          setHash(txHash);
          setIsPending(false);
          setIsConfirming(true);
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            pollingInterval: WAGMI_POLLING_INTERVAL,
          });
          setHash(receipt.transactionHash);
          setIsConfirming(false);
          setIsSuccess(true);
        } catch (err) {
          setIsPending(false);
          setIsConfirming(false);
          setError(err instanceof Error ? err : new Error('Transaction failed'));
        }
      }
    },
    [walletType, bundlerClient, publicClient, writeContractAsync, connectedChainId, switchChainAsync],
  );

  return { write, isPending, isConfirming, isSuccess, error, hash };
}
