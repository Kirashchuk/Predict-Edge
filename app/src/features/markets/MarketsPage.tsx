import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/ui/primitives/button';
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-heading-md font-bold">Prediction Markets</h1>
          <p className="text-data-sm text-muted-foreground">
            Trade YES/NO positions on Arc Testnet. Resolution by UMA Optimistic Oracle.
          </p>
        </div>
        <CreateMarketDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={active === c ? 'default' : 'outline'}
            onClick={() => setActive(c)}
          >
            {c}
          </Button>
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
