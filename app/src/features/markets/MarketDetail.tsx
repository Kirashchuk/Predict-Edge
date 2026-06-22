import { useParams, Link } from 'react-router-dom';
import { useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { type Address, formatUnits } from 'viem';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { toast } from '@/shared/ui/primitives/sonner';
import { ERC20_ABI } from '@/shared/lib/contracts/abis';
import { USDC_ADDRESS, OO_V2_ADDRESS } from '@/shared/lib/contracts/addresses';
import { formatCollateral } from '@/shared/lib/contracts/types';
import { fmtPricePct, fmtToken } from '@/shared/lib/format';
import { useWallet } from '@/features/wallet/WalletContext';
import { TradingPanel } from '@/features/trading/TradingPanel';
import { OrderBook } from '@/features/trading/OrderBook';
import { TradeHistory } from '@/features/trading/TradeHistory';
import { useAmmState } from './hooks/useAmmState';
import { useMarketState, useTokenBalances } from './hooks/useMarketData';
import { useSettlePosition } from './hooks/useMarketActions';
import { PriceChart } from './PriceChart';
import { STATIC_MARKETS } from './catalog';
import { fetchUserMarkets } from './api/markets';

export default function MarketDetail() {
  const { address } = useParams<{ address: string }>();
  const market = address as Address | undefined;
  const { address: account } = useWallet();

  // Resolve the AMM address from the static catalog or user-created markets.
  const { data: userMarkets = [] } = useQuery({ queryKey: ['user-markets'], queryFn: fetchUserMarkets });
  const known =
    STATIC_MARKETS.find((m) => m.address?.toLowerCase() === address?.toLowerCase()) ??
    userMarkets.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const amm = (known && 'ammAddress' in known ? known.ammAddress : undefined) as Address | undefined;
  const clob = (known && 'clobAddress' in known ? known.clobAddress : undefined) as Address | undefined;

  const ms = useMarketState(market);
  const state = useAmmState(market, amm);
  const balances = useTokenBalances(market, ms.longTokenAddress, ms.shortTokenAddress);
  const settlePos = useSettlePosition(market);

  const { data: arctAllowanceToOo } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: account ? [account, OO_V2_ADDRESS] : undefined,
    query: { enabled: !!account, refetchInterval: 5000 },
  });

  const yes = state.yesPrice ? Number(formatUnits(state.yesPrice, 18)) : 0.5;
  const title = ms.question ?? known?.title ?? 'Prediction market';

  if (!market || !amm) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="corner-markers border border-border bg-card p-10 text-center text-muted-foreground">
          Market not found or AMM address unavailable. Run the deploy + <code>bun run sync-env</code>.
        </div>
      </div>
    );
  }

  async function redeem() {
    if (!balances.longBalance && !balances.shortBalance) return;
    toast.message('Redeeming positions…');
    await settlePos.settle(balances.longBalance ?? 0n, balances.shortBalance ?? 0n);
    toast.success('Redeem submitted');
  }

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="corner-markers border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-3">
          <span className={`data-label ${state.resolved ? 'text-warning' : 'text-success'}`}>
            {state.resolved ? '● RESOLVED' : '● LIVE'}
          </span>
          <span className="font-mono text-data-xs text-muted-foreground">{market}</span>
        </div>
        <h1 className="font-sans text-heading-md font-bold">{title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PriceChart yes={yes} seed={market} live={!state.resolved} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="YES PRICE" value={fmtPricePct(state.yesPrice)} accent="success" />
            <Stat label="NO PRICE" value={fmtPricePct(state.noPrice)} accent="destructive" />
            <Stat label="RESERVE YES" value={fmtToken(state.reserveYes)} />
            <Stat label="RESERVE NO" value={fmtToken(state.reserveNo)} />
          </div>

          {/* Portfolio */}
          <div className="corner-markers border border-border bg-card p-4">
            <div className="data-label mb-3 text-gold">// YOUR PORTFOLIO</div>
            {account ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="USDC" value={formatCollateral(balances.arctBalance)} />
                  <Stat label="YES TOKENS" value={formatCollateral(balances.longBalance)} accent="success" />
                  <Stat label="NO TOKENS" value={formatCollateral(balances.shortBalance)} accent="destructive" />
                </div>
                {ms.receivedSettlementPrice && (balances.longBalance || balances.shortBalance) ? (
                  <Button
                    className="mt-3 w-full"
                    disabled={settlePos.isPending || settlePos.isConfirming}
                    onClick={redeem}
                  >
                    {settlePos.isPending || settlePos.isConfirming ? 'Redeeming…' : 'Redeem positions for USDC'}
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-data-sm text-muted-foreground">Connect a wallet to see your positions.</p>
            )}
          </div>

          <p className="text-data-xs text-muted-foreground">
            Fee: {state.feeBps ? `${Number(state.feeBps) / 100}%` : '—'} · Constant-product AMM · Resolution by UMA
            Optimistic Oracle V2 ·{' '}
            {ms.receivedSettlementPrice
              ? `Settled @ ${formatUnits(ms.settlementPrice ?? 0n, 18)}`
              : 'Awaiting resolution'}
          </p>

          <TradeHistory amm={amm} clob={clob} />
        </div>

        <div className="space-y-4">
          <TradingPanel
            market={market}
            amm={amm}
            clob={clob}
            longToken={ms.longTokenAddress}
            shortToken={ms.shortTokenAddress}
            priceIdentifier={ms.priceIdentifier}
            requestTimestamp={ms.requestTimestamp}
            ancillaryDataHex={ms.ancillaryDataHex}
            resolved={state.resolved}
            arctAllowanceToOo={arctAllowanceToOo as bigint | undefined}
            yesPrice={yes}
          />
          <OrderBook
            market={market}
            amm={amm}
            clob={clob}
            longToken={ms.longTokenAddress}
            shortToken={ms.shortTokenAddress}
            reserveYes={Number(formatUnits(state.reserveYes ?? 0n, 6))}
            reserveNo={Number(formatUnits(state.reserveNo ?? 0n, 6))}
            feeBps={Number(state.feeBps ?? 200n)}
            yesPrice={yes}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'success' | 'destructive' }) {
  return (
    <div className="corner-markers border border-border bg-surface p-3">
      <div className="data-label">{label}</div>
      <div
        className={
          'mt-1 font-mono text-data-lg ' +
          (accent === 'success' ? 'text-success' : accent === 'destructive' ? 'text-destructive' : 'text-foreground')
        }
      >
        {value}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to="/">
        <ArrowLeft className="h-4 w-4" /> All markets
      </Link>
    </Button>
  );
}
