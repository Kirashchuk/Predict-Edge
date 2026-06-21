import { useReadContract, usePublicClient, useWriteContract } from 'wagmi';
import { useCallback, useState } from 'react';
import { encodeFunctionData, type Address } from 'viem';
import { OO_V2_ABI, TIMER_ABI } from '@/shared/lib/contracts/abis';
import { OO_V2_ADDRESS, TIMER_ADDRESS } from '@/shared/lib/contracts/addresses';
import { OracleState } from '@/shared/lib/contracts/types';
import { useWallet } from '@/features/wallet/WalletContext';
import { useContractWrite } from '@/features/wallet/useContractWrite';
import { LIVE_STATE_REFETCH_INTERVAL, WAGMI_POLLING_INTERVAL } from '@/features/wallet/wagmi';

const ZERO = '0x0000000000000000000000000000000000000000';

export interface OracleArgs {
  market?: Address;
  priceIdentifier?: `0x${string}`;
  requestTimestamp?: bigint;
  ancillaryDataHex?: `0x${string}`;
}

export function useOracleState({ market, priceIdentifier, requestTimestamp, ancillaryDataHex }: OracleArgs) {
  const enabled =
    !!market &&
    !!priceIdentifier &&
    requestTimestamp !== undefined &&
    !!ancillaryDataHex &&
    OO_V2_ADDRESS !== ZERO;

  const args = enabled
    ? ([market, priceIdentifier, requestTimestamp, ancillaryDataHex] as const)
    : undefined;

  const { data: stateData, refetch: refetchState } = useReadContract({
    address: OO_V2_ADDRESS,
    abi: OO_V2_ABI,
    functionName: 'getState',
    args,
    query: { enabled, refetchInterval: LIVE_STATE_REFETCH_INTERVAL, refetchIntervalInBackground: false },
  });

  const { data: requestData, refetch: refetchRequest } = useReadContract({
    address: OO_V2_ADDRESS,
    abi: OO_V2_ABI,
    functionName: 'getRequest',
    args,
    query: { enabled, refetchInterval: LIVE_STATE_REFETCH_INTERVAL, refetchIntervalInBackground: false },
  });

  const request = requestData as
    | { proposer: Address; disputer: Address; proposedPrice: bigint; expirationTime: bigint; requestSettings: { bond: bigint } }
    | undefined;

  const refetch = useCallback(() => {
    refetchState();
    refetchRequest();
  }, [refetchState, refetchRequest]);

  return {
    oracleState: stateData !== undefined ? (Number(stateData) as OracleState) : undefined,
    proposer: request?.proposer,
    disputer: request?.disputer,
    proposedPrice: request?.proposedPrice,
    expirationTime: request?.expirationTime,
    bond: request?.requestSettings?.bond,
    refetch,
  };
}

/** propose + settle batch a Timer.setCurrentTime call so testnet liveness can expire on demand. */
export function useOracleActions({ market, priceIdentifier, requestTimestamp, ancillaryDataHex }: OracleArgs) {
  const { walletType, bundlerClient } = useWallet();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const hasTimer = TIMER_ADDRESS !== ZERO;

  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [action, setAction] = useState<'propose' | 'dispute' | 'settle' | null>(null);

  const ready = !!market && !!priceIdentifier && requestTimestamp !== undefined && !!ancillaryDataHex;

  const runWithTimer = useCallback(
    async (kind: 'propose' | 'settle', fnName: 'proposePrice' | 'settle', fnArgs: readonly unknown[]) => {
      setAction(kind);
      setIsPending(true);
      setIsConfirming(false);
      setIsSuccess(false);
      setError(null);
      try {
        const nowTime = BigInt(Math.floor(Date.now() / 1000));
        if (walletType === 'circle' && bundlerClient) {
          const calls: { to: `0x${string}`; data: `0x${string}` }[] = [];
          if (hasTimer) {
            calls.push({
              to: TIMER_ADDRESS as `0x${string}`,
              data: encodeFunctionData({ abi: TIMER_ABI, functionName: 'setCurrentTime', args: [nowTime] }),
            });
          }
          calls.push({
            to: OO_V2_ADDRESS as `0x${string}`,
            data: encodeFunctionData({ abi: OO_V2_ABI, functionName: fnName, args: fnArgs as never }),
          });
          setIsConfirming(true);
          setIsPending(false);
          const opHash = await bundlerClient.sendUserOperation({ calls, paymaster: true });
          await bundlerClient.waitForUserOperationReceipt({ hash: opHash });
        } else {
          if (!publicClient) throw new Error('No public client available');
          if (hasTimer) {
            await writeContractAsync({
              address: TIMER_ADDRESS,
              abi: TIMER_ABI,
              functionName: 'setCurrentTime',
              args: [nowTime],
            } as never);
          }
          setIsConfirming(true);
          setIsPending(false);
          const txHash = await writeContractAsync({
            address: OO_V2_ADDRESS,
            abi: OO_V2_ABI,
            functionName: fnName,
            args: fnArgs,
          } as never);
          await publicClient.waitForTransactionReceipt({ hash: txHash, pollingInterval: WAGMI_POLLING_INTERVAL });
        }
        setIsConfirming(false);
        setIsSuccess(true);
      } catch (err) {
        setIsPending(false);
        setIsConfirming(false);
        setError(err instanceof Error ? err : new Error(`${kind} failed`));
      }
    },
    [walletType, bundlerClient, publicClient, writeContractAsync, hasTimer],
  );

  const propose = useCallback(
    (price: bigint) => {
      if (!ready) return;
      void runWithTimer('propose', 'proposePrice', [market!, priceIdentifier!, requestTimestamp!, ancillaryDataHex!, price]);
    },
    [ready, market, priceIdentifier, requestTimestamp, ancillaryDataHex, runWithTimer],
  );

  const settleOracle = useCallback(() => {
    if (!ready) return;
    void runWithTimer('settle', 'settle', [market!, priceIdentifier!, requestTimestamp!, ancillaryDataHex!]);
  }, [ready, market, priceIdentifier, requestTimestamp, ancillaryDataHex, runWithTimer]);

  // dispute is a plain single call (no timer needed).
  const disputeWrite = useContractWrite();
  const dispute = useCallback(() => {
    if (!ready) return;
    setAction('dispute');
    void disputeWrite.write({
      address: OO_V2_ADDRESS,
      abi: OO_V2_ABI,
      functionName: 'disputePrice',
      args: [market!, priceIdentifier!, requestTimestamp!, ancillaryDataHex!],
    });
  }, [ready, market, priceIdentifier, requestTimestamp, ancillaryDataHex, disputeWrite]);

  return {
    propose,
    dispute,
    settleOracle,
    action,
    isPending: isPending || disputeWrite.isPending,
    isConfirming: isConfirming || disputeWrite.isConfirming,
    isSuccess: isSuccess || disputeWrite.isSuccess,
    error: error || disputeWrite.error,
  };
}
