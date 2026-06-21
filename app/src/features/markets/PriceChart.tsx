import { useEffect, useRef } from 'react';
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type AreaData,
} from 'lightweight-charts';
import { hashStr, mulberry32 } from '@/shared/lib/seeded';

const GOLD = '#e0a82e';

/**
 * Build a deterministic YES-probability history ending near the current value.
 * Pre-session points are simulated (seeded by the market address, so they are
 * stable across reloads) for the testnet demo; the latest point and all live
 * updates reflect the real on-chain AMM price.
 */
function buildHistory(seed: string, endYes: number, points = 72, stepSec = 1800): AreaData[] {
  const rnd = mulberry32(hashStr(seed));
  const now = Math.floor(Date.now() / 1000);
  const vals: number[] = new Array(points);
  vals[points - 1] = endYes;
  for (let i = points - 2; i >= 0; i--) {
    const drift = (rnd() - 0.5) * 0.05;
    let v = vals[i + 1] - drift;
    v = Math.min(0.95, Math.max(0.05, v));
    vals[i] = v;
  }
  return vals.map((v, i) => ({
    time: (now - (points - 1 - i) * stepSec) as UTCTimestamp,
    value: +(v * 100).toFixed(2),
  }));
}

export function PriceChart({ yes, seed, live }: { yes: number; seed: string; live?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const builtRef = useRef(false);

  // Create chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: 240,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(220,210,190,0.55)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)' },
        horzLines: { color: 'rgba(255,255,255,0.035)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      handleScale: false,
      handleScroll: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: GOLD,
      topColor: 'rgba(224,168,46,0.30)',
      bottomColor: 'rgba(224,168,46,0.01)',
      lineWidth: 2,
      priceLineVisible: false,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(1)}%`, minMove: 0.1 },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => chart.applyOptions({ width: el.clientWidth });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      builtRef.current = false;
    };
  }, [seed]);

  // Seed history once we have a price, then append live updates.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (!builtRef.current) {
      series.setData(buildHistory(seed, yes));
      chartRef.current?.timeScale().fitContent();
      builtRef.current = true;
    } else if (live) {
      series.update({ time: Math.floor(Date.now() / 1000) as UTCTimestamp, value: +(yes * 100).toFixed(2) });
    }
  }, [yes, seed, live]);

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="data-label text-gold">// YES PROBABILITY</span>
        <span className="data-value text-success">{(yes * 100).toFixed(1)}%</span>
      </div>
      <div ref={containerRef} className="w-full" />
      <div className="mt-2 text-[0.6rem] text-muted-foreground/60">
        {live ? 'Live AMM price · pre-session history simulated for demo' : 'Indicative demo series'}
      </div>
    </div>
  );
}
