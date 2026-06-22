import { useMemo } from 'react';
import { hashStr, mulberry32 } from '@/shared/lib/seeded';

/**
 * Tiny seeded SVG sparkline of YES probability ending at the current value.
 * Deterministic per market (seed) so it doesn't reshuffle each render.
 */
export function Sparkline({ yes, seed, points = 28 }: { yes: number; seed: string; points?: number }) {
  const { d, area, up } = useMemo(() => {
    const rnd = mulberry32(hashStr(seed));
    const vals: number[] = new Array(points);
    vals[points - 1] = yes;
    for (let i = points - 2; i >= 0; i--) {
      const drift = (rnd() - 0.5) * 0.06;
      vals[i] = Math.min(0.96, Math.max(0.04, vals[i + 1] - drift));
    }
    const w = 100;
    const h = 28;
    const pad = 2;
    const xs = (i: number) => (i / (points - 1)) * w;
    const ys = (v: number) => pad + (1 - v) * (h - pad * 2);
    const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
    const areaPath = `${line} L${w},${h} L0,${h} Z`;
    return { d: line, area: areaPath, up: vals[points - 1] >= vals[0] };
  }, [yes, seed, points]);

  const stroke = up ? 'hsl(var(--success))' : 'hsl(var(--gold))';
  const gid = `sl-${hashStr(seed)}`;
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
