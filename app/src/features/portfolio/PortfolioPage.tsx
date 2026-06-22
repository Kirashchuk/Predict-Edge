import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { type Address, formatUnits } from 'viem';
import { Wallet } from 'lucide-react';
import { formatCollateral } from '@/shared/lib/contracts/types';
import { useWallet } from '@/features/wallet/WalletContext';
import { useMarketState, useTokenBalances } from '@/features/markets/hooks/useMarketData';
import { useAmmState } from '@/features/markets/hooks/useAmmState';
import { STATIC_MARKETS } from '@/features/markets/catalog';
import { fetchUserMarkets } from '@/features/markets/api/markets';
import { PortfolioValueChart } from './PortfolioValueChart';

interface LiveMarket {
  address: Address;
  ammAddress: Address;
  title: string;
}

export default function PortfolioPage() {
  const { address, isConnected } = useWallet();
  const [marketValues, setMarketValues] = useState<Record<string, number>>({});

  const { data: userMarkets = [] } = useQuery({ queryKey: ['user-markets'], queryFn: fetchUserMarkets });

  const markets: LiveMarket[] = useMemo(() => {
    const fromStatic = STATIC_MARKETS.filter((m) => m.live && m.address && m.ammAddress).map((m) => ({
      address: m.address as Address,
      ammAddress: m.ammAddress as Address,
      title: m.title,
    }));
    const fromUser = userMarkets.map((m) => ({
      address: m.address as Address,
      ammAddress: m.ammAddress as Address,
      title: m.title,
    }));
    // de-dupe by address
    const seen = new Set<string>();
    return [...fromStatic, ...fromUser].filter((m) => {
      const k = m.address.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [userMarkets]);

  const reportValue = useCallback((marketAddress: Address, value: number) => {
    const key = marketAddress.toLowerCase();
    setMarketValues((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const totalValue = markets.reduce((sum, market) => sum + (marketValues[market.address.toLowerCase()] ?? 0), 0);
  const activePositions = Object.values(marketValues).filter((value) => value > 0).length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <span className="data-label text-gold">// PORTFOLIO</span>
        <h1 className="mt-2 font-sans text-heading-lg font-bold">Your Positions</h1>
        <p className="data-value text-muted-foreground">Holdings across all live markets on Arc Testnet.</p>
      </div>

      {!isConnected ? (
        <div className="corner-markers flex flex-col items-center gap-3 border border-border bg-card p-10 text-center">
          <Wallet className="h-8 w-8 text-gold" />
          <p className="text-muted-foreground">Connect a wallet to view your portfolio.</p>
        </div>
      ) : (
        <>
          <PortfolioValueChart value={totalValue} positions={activePositions} />
          <div className="corner-markers border border-border bg-card">
            <div className="grid grid-cols-12 gap-2 border-b border-border px-4 py-2">
              <span className="data-label col-span-5">MARKET</span>
              <span className="data-label col-span-2 text-right">YES</span>
              <span className="data-label col-span-2 text-right">NO</span>
              <span className="data-label col-span-3 text-right">EST. VALUE</span>
            </div>
            {markets.map((m) => (
              <PortfolioRow key={m.address} market={m} account={address!} onValue={reportValue} />
            ))}
            {markets.length === 0 && (
              <div className="px-4 py-8 text-center text-data-sm text-muted-foreground">No live markets yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PortfolioRow({
  market,
  account,
  onValue,
}: {
  market: LiveMarket;
  account: Address;
  onValue: (marketAddress: Address, value: number) => void;
}) {
  void account;
  const ms = useMarketState(market.address);
  const balances = useTokenBalances(market.address, ms.longTokenAddress, ms.shortTokenAddress);
  const state = useAmmState(market.address, market.ammAddress);

  const longN = balances.longBalance ? Number(formatUnits(balances.longBalance, 6)) : 0;
  const shortN = balances.shortBalance ? Number(formatUnits(balances.shortBalance, 6)) : 0;
  const yesFrac = state.yesPrice ? Number(formatUnits(state.yesPrice, 18)) : 0.5;
  const value = longN * yesFrac + shortN * (1 - yesFrac);

  const empty = longN === 0 && shortN === 0;

  useEffect(() => {
    onValue(market.address, value);
    return () => onValue(market.address, 0);
  }, [market.address, onValue, value]);

  return (
    <Link
      to={`/market/${market.address}`}
      className={`grid grid-cols-12 items-center gap-2 px-4 py-3 transition-colors hover:bg-surface ${empty ? 'opacity-50' : ''}`}
    >
      <span className="col-span-5 truncate font-sans text-sm">{ms.question ?? market.title}</span>
      <span className="col-span-2 text-right font-mono text-data-sm text-success">{formatCollateral(balances.longBalance)}</span>
      <span className="col-span-2 text-right font-mono text-data-sm text-destructive">{formatCollateral(balances.shortBalance)}</span>
      <span className="col-span-3 text-right font-mono text-data-sm text-gold">{value.toFixed(2)} USDC</span>
    </Link>
  );
}
