import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  ColorType,
  createChart,
  type AreaData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { hashStr, mulberry32 } from '@/shared/lib/seeded';

const GOLD = '#e0a82e';

function buildValueHistory(seed: string, endValue: number, points = 64, stepSec = 3600): AreaData[] {
  const rnd = mulberry32(hashStr(seed));
  const now = Math.floor(Date.now() / 1000);
  const vals: number[] = new Array(points);
  vals[points - 1] = Math.max(0, endValue);

  for (let i = points - 2; i >= 0; i--) {
    const move = endValue === 0 ? 0 : (rnd() - 0.48) * Math.max(0.2, endValue * 0.04);
    vals[i] = Math.max(0, vals[i + 1] - move);
  }

  return vals.map((value, i) => ({
    time: (now - (points - 1 - i) * stepSec) as UTCTimestamp,
    value: +value.toFixed(2),
  }));
}

export function PortfolioValueChart({ value, positions }: { value: number; positions: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const builtRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 220,
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
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: GOLD,
      topColor: 'rgba(224,168,46,0.28)',
      bottomColor: 'rgba(224,168,46,0.01)',
      lineWidth: 2,
      priceLineVisible: false,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(2)} USDC`, minMove: 0.01 },
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
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (!builtRef.current) {
      series.setData(buildValueHistory('portfolio-value', value));
      chartRef.current?.timeScale().fitContent();
      builtRef.current = true;
    } else {
      series.update({ time: Math.floor(Date.now() / 1000) as UTCTimestamp, value: +value.toFixed(2) });
    }
  }, [value]);

  return (
    <div className="corner-markers border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="data-label text-gold">// PORTFOLIO VALUE</span>
        <span className="data-value text-gold">{value.toFixed(2)} USDC</span>
      </div>
      <div ref={containerRef} className="w-full" />
      <div className="mt-2 flex items-center justify-between text-[0.6rem] text-muted-foreground/60">
        <span>Live aggregate mark value</span>
        <span>{positions} active positions</span>
      </div>
    </div>
  );
}
