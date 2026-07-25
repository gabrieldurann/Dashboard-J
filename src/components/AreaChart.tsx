import { motion } from "framer-motion";
import { useId, useMemo, useRef, useState } from "react";
import { EASE } from "../theme/tokens";
import { PAD_BOTTOM, PAD_TOP, smoothPath, type ChartPoint } from "./chartUtils";
import { useCores } from "../theme/useCores";

export type { ChartPoint };

// Bespoke single-line area chart (PLAN.md §9 Phase 3 #9). SVG draws in a 0–100 box and stretches
// to fit (preserveAspectRatio none) — the stroke stays crisp via vector-effect, and dots/labels/
// tooltip are HTML overlays positioned by percentage, so nothing distorts. Hover shows a guide,
// the nearest point's dot and a tooltip.

export function AreaChart({
  points,
  format,
  accent,
  height = 200,
}: {
  points: ChartPoint[];
  format: (v: number) => string;
  /** defaults to the theme's green */
  accent?: string;
  height?: number;
}) {
  const cores = useCores();
  const cor = accent ?? cores.green;
  const gid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = points.length;
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) => PAD_TOP + (1 - v / maxV) * (100 - PAD_TOP - PAD_BOTTOM);

  const coords = points.map((p, i) => ({ x: xPct(i), y: yPct(p.value) }));
  const line = smoothPath(coords);
  const area = n >= 1 ? `${line} L ${coords[n - 1].x} 100 L ${coords[0].x} 100 Z` : "";

  // peaks = local maxima (a point higher than both neighbours) — get a permanent glowing dot
  const peaks = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? points[i - 1].value : -Infinity;
      const next = i < n - 1 ? points[i + 1].value : -Infinity;
      if (points[i].value > 0 && points[i].value > prev && points[i].value > next) set.add(i);
    }
    return set;
  }, [points, n]);

  const onMove = (e: React.PointerEvent) => {
    if (!wrapRef.current || n === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.34} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          {area && (
            <motion.path
              d={area}
              fill={`url(#fill-${gid})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
            />
          )}
          {/* Fade-in (not pathLength): a dash-based draw conflicts with non-scaling-stroke
              on a stretched viewBox and renders the line with gaps. */}
          <motion.path
            d={line}
            fill="none"
            stroke={cor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </svg>

        {/* hover guide */}
        {hover !== null && coords[hover] && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-lineStrong"
            style={{ left: `${coords[hover].x}%` }}
          />
        )}

        {/* permanent glowing dots on the peaks (filled with the cor so they never
            punch a hole in the line); they brighten when hovered */}
        {[...peaks].map((i) => (
          <span
            key={`peak-${i}`}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${coords[i].x}%`,
              top: `${coords[i].y}%`,
              width: hover === i ? 12 : 9,
              height: hover === i ? 12 : 9,
              transform: "translate(-50%,-50%)",
              background: cor,
              boxShadow: `0 0 ${hover === i ? 16 : 11}px ${hover === i ? 4 : 2}px ${cor}`,
              transition: "width 0.15s, height 0.15s, box-shadow 0.15s",
            }}
          />
        ))}

        {/* hover dot for non-peak points (peaks already have their glowing dot) */}
        {hover !== null && !peaks.has(hover) && coords[hover] && (
          <span
            className="pointer-events-none absolute rounded-full border-2"
            style={{
              left: `${coords[hover].x}%`,
              top: `${coords[hover].y}%`,
              width: 11,
              height: 11,
              transform: "translate(-50%,-50%)",
              background: cores.bg,
              borderColor: cor,
              boxShadow: `0 0 10px ${cor}`,
            }}
          />
        )}

        {/* tooltip — edge-aware so it never clips at the top/right (e.g. the June peak);
            a compact "pico" variant shows on peaks */}
        {hover !== null &&
          points[hover] &&
          (() => {
            const x = coords[hover].x;
            const y = coords[hover].y;
            const tx = x > 78 ? "-100%" : x < 22 ? "0%" : "-50%"; // flip near the right/left edge
            const ty = y < 28 ? "12px" : "calc(-100% - 12px)"; // drop below when near the top
            const isPeak = peaks.has(hover);
            return (
              <div
                className={`pointer-events-none absolute z-10 rounded-chip border bg-panel backdrop-blur-md ${
                  isPeak ? "border-green/50 px-2 py-1" : "border-lineStrong px-2.5 py-1.5"
                }`}
                style={{ left: `${x}%`, top: `${y}%`, transform: `translate(${tx}, ${ty})` }}
              >
                {isPeak ? (
                  <>
                    <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-green">● pico</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.1em] leading-tight text-txtFaint">
                      {points[hover].label}
                    </div>
                    <div className="font-mono text-[11px] leading-tight tabular-nums text-txt">
                      {format(points[hover].value)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint">
                      {points[hover].label}
                    </div>
                    <div className="font-mono text-sm tabular-nums text-txt">{format(points[hover].value)}</div>
                  </>
                )}
              </div>
            );
          })()}
      </div>

      {/* x-axis labels */}
      <div className="mt-2 flex justify-between">
        {points.map((p, i) => (
          <span
            key={i}
            className={`font-mono text-[10px] uppercase tracking-[0.08em] ${hover === i ? "text-txt" : "text-txtFaint"}`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
