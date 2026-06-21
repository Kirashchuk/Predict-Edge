import { useCallback, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { type Abi, type Address, type Hex } from 'viem';
import { WAGMI_POLLING_INTERVAL } from './wagmi';

interface ContractWriteParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Unified write hook. The Templars stack uses an injected EVM wallet
 * (MetaMask / @metamask/connect-evm) — the Circle passkey path from the
 * original Next.js app was dropped in the migration (see ADR-002).
 */
export function useContractWrite() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

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
      try {
        if (!publicClient) throw new Error('No public client available');
        // chain/account are resolved from the connected wallet at call time.
        const txHash = await writeContractAsync({
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
          args: params.args as unknown[],
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
    },
    [publicClient, writeContractAsync],
  );

  return { write, isPending, isConfirming, isSuccess, error, hash };
}
