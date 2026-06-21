import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MarketCard } from './MarketCard';
import { CreateMarketDialog } from './CreateMarketDialog';
import { STATIC_MARKETS, CATEGORIES, type MarketCategory, type MarketEntry } from './catalog';
import { fetchUserMarkets } from './api/markets';

export default function MarketsPage() {
  const [active, setActive] = useState<MarketCategory | 'All'>('All');

  const { data: userMarkets = [] } = useQuery({
    queryKey: ['user-markets'],
    queryFn: fetchUserMarkets,
  });

  const all: MarketEntry[] = useMemo(() => {
    const mapped: MarketEntry[] = userMarkets.map((m) => ({
      id: m.id,
      title: m.title,
      category: (m.category as MarketCategory) ?? 'Crypto',
      address: m.address,
      ammAddress: m.ammAddress,
      live: true,
    }));
    return [...mapped, ...STATIC_MARKETS];
  }, [userMarkets]);

  const visible = active === 'All' ? all : all.filter((m) => m.category === active);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <span className="data-label text-gold">// PREDICTION MARKETS</span>
          <h1 className="font-sans text-heading-lg font-bold">Forged in the Markets</h1>
          <p className="data-value text-muted-foreground">
            Trade YES/NO positions on Arc Testnet. Trustless resolution by UMA Optimistic Oracle V2.
          </p>
        </div>
        <CreateMarketDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={
              'btn-brutal ' +
              (active === c
                ? 'border-gold bg-gold/15 text-gold'
                : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground')
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}
