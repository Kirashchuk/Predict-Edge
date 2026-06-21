import { useParams, Link } from 'react-router-dom';
import { type Address } from 'viem';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import { fmtPricePct, fmtToken } from '@/shared/lib/format';
import { TradingPanel } from '@/features/trading/TradingPanel';
import { useAmmState } from './hooks/useAmmState';
import { STATIC_MARKETS } from './catalog';

export default function MarketDetail() {
  const { address } = useParams<{ address: string }>();
  const market = address as Address | undefined;

  const known = STATIC_MARKETS.find((m) => m.address?.toLowerCase() === address?.toLowerCase());
  const amm = known?.ammAddress as Address | undefined;
  const state = useAmmState(market, amm);

  if (!market || !amm) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Market not found or AMM address unavailable. (Deployed addresses come from the
            VITE_*_ADDRESS env — run the deploy + sync-env script.)
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant={state.resolved ? 'warning' : 'success'}>
                  {state.resolved ? 'Resolved' : 'Live'}
                </Badge>
                <span className="font-mono text-data-xs text-muted-foreground">{market}</span>
              </div>
              <CardTitle>{known?.title ?? 'Prediction market'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="YES price" value={fmtPricePct(state.yesPrice)} accent="success" />
                <Stat label="NO price" value={fmtPricePct(state.noPrice)} accent="destructive" />
                <Stat label="Reserve YES" value={fmtToken(state.reserveYes)} />
                <Stat label="Reserve NO" value={fmtToken(state.reserveNo)} />
              </div>
              <p className="text-data-xs text-muted-foreground">
                Fee: {state.feeBps ? `${Number(state.feeBps) / 100}%` : '—'} · Constant-product AMM ·
                Resolution by UMA Optimistic Oracle V2
              </p>
            </CardContent>
          </Card>
        </div>
        <div>
          <TradingPanel amm={amm} resolved={state.resolved} />
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
