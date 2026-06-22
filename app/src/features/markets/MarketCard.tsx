import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { type Address, formatUnits } from 'viem';
import { useAmmState } from './hooks/useAmmState';
import { Sparkline } from './Sparkline';
import type { MarketEntry } from './catalog';

function ProbabilityBar({ yes }: { yes: number }) {
  const pct = Math.round(yes * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <span className="data-value text-success">YES {pct}%</span>
        <span className="data-value text-muted-foreground">NO {100 - pct}%</span>
      </div>
      <div className="flex h-1.5 overflow-hidden bg-muted">
        <div className="h-full bg-success" style={{ width: `${pct}%` }} />
        <div className="h-full bg-destructive/60" style={{ width: `${100 - pct}%` }} />
      </div>
    </div>
  );
}

function LiveCardBody({ market, amm, seed }: { market: Address; amm: Address; seed: string }) {
  const { yesPrice, resolved } = useAmmState(market, amm);
  const yes = yesPrice ? Number(formatUnits(yesPrice, 18)) : 0.5;
  return (
    <>
      <div className="mb-3">
        <Sparkline yes={yes} seed={seed} />
      </div>
      <ProbabilityBar yes={yes} />
      <div className="mt-3 flex items-center justify-between">
        <span className={`data-label ${resolved ? 'text-warning' : 'text-success'}`}>
          {resolved ? '● RESOLVED' : '● LIVE'}
        </span>
        <span className="data-label">ON-CHAIN · AMM</span>
      </div>
    </>
  );
}

export function MarketCard({ market }: { market: MarketEntry }) {
  const inner = (
    <div className="corner-markers hover-surface group h-full border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="data-label text-gold">{market.category.toUpperCase()}</span>
        <span className="data-label">{market.live ? 'MARKET' : 'DEMO'}</span>
      </div>
      <h3 className="mb-4 font-sans text-base font-semibold leading-snug text-foreground group-hover:text-gold">
        {market.title}
      </h3>
      {market.live && market.address && market.ammAddress ? (
        <LiveCardBody market={market.address as Address} amm={market.ammAddress as Address} seed={market.address} />
      ) : (
        <>
          <div className="mb-3">
            <Sparkline yes={market.staticYes ?? 0.5} seed={market.id} />
          </div>
          <ProbabilityBar yes={market.staticYes ?? 0.5} />
        </>
      )}
    </div>
  );

  if (market.live && market.address) {
    return (
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="rise-in">
        <Link to={`/market/${market.address}`}>{inner}</Link>
      </motion.div>
    );
  }
  return <div className="rise-in opacity-70">{inner}</div>;
}
