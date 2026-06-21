import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { type Address, formatUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Badge } from '@/shared/ui/primitives/badge';
import { useAmmState } from './hooks/useAmmState';
import type { MarketEntry } from './catalog';

function ProbabilityBar({ yes }: { yes: number }) {
  const pct = Math.round(yes * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-data-sm">
        <span className="text-success">YES {pct}%</span>
        <span className="text-muted-foreground">NO {100 - pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LiveCardBody({ market, amm }: { market: Address; amm: Address }) {
  const { yesPrice, resolved } = useAmmState(market, amm);
  const yes = yesPrice ? Number(formatUnits(yesPrice, 18)) : 0.5;
  return (
    <>
      <ProbabilityBar yes={yes} />
      <div className="mt-3 flex items-center gap-2">
        <Badge variant={resolved ? 'warning' : 'success'}>{resolved ? 'Resolved' : 'Live'}</Badge>
        <span className="text-data-xs text-muted-foreground">On-chain · AMM</span>
      </div>
    </>
  );
}

export function MarketCard({ market }: { market: MarketEntry }) {
  const inner = (
    <Card className="h-full transition-colors hover:border-primary/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{market.category}</Badge>
          {!market.live && <span className="text-data-xs text-muted-foreground">Demo</span>}
        </div>
        <CardTitle className="text-base leading-snug">{market.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {market.live && market.address && market.ammAddress ? (
          <LiveCardBody market={market.address as Address} amm={market.ammAddress as Address} />
        ) : (
          <ProbabilityBar yes={market.staticYes ?? 0.5} />
        )}
      </CardContent>
    </Card>
  );

  if (market.live && market.address) {
    return (
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
        <Link to={`/market/${market.address}`}>{inner}</Link>
      </motion.div>
    );
  }
  return <div className="opacity-80">{inner}</div>;
}
