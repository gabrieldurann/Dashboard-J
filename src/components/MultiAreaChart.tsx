import { motion } from "framer-motion";
import { useId, useRef, useState } from "react";
import { EASE } from "../theme/tokens";
import { PAD_BOTTOM, PAD_TOP, smoothPath } from "./chartUtils";
import { useCores } from "../theme/useCores";

// Several series on one shared axis (Gráficos page, idea #6). Same drawing approach as
// <AreaChart>: SVG in a 0–100 box stretched to fit, HTML overlays for the hover guide and
// tooltip so nothing distorts. All series share one scale so they're visually comparable.

export type Serie = {
  nome: string;
  cor: string;
  valores: number[]; // one value per label, same length as `labels`
};

export function MultiAreaChart({
  labels,
  series,
  format,
  height = 220,
}: {
  labels: string[];
  series: Serie[];
  format: (v: number) => string;
  height?: number;
}) {
  const cores = useCores();
  const gid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [oculto, setOculto] = useState<Set<string>>(new Set());

  const visiveis = series.filter((s) => !oculto.has(s.nome));
  const n = labels.length;
  // one shared scale across every visible series, so the lines are comparable
  const maxV = Math.max(1, ...visiveis.flatMap((s) => s.valores));
  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) => PAD_TOP + (1 - v / maxV) * (100 - PAD_TOP - PAD_BOTTOM);

  const toggle = (nome: string) =>
    setOculto((prev) => {
      const next = new Set(prev);
      // never let the user hide the last visible series (the chart would have no scale)
      if (next.has(nome)) next.delete(nome);
      else if (visiveis.length > 1) next.add(nome);
      return next;
    });

  const onMove = (e: React.PointerEvent) => {
    if (!wrapRef.current || n === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  };

  return (
    <div>
      {/* legend — click to isolate/compare series */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {series.map((s) => {
          const off = oculto.has(s.nome);
          return (
            <button
              key={s.nome}
              onClick={() => toggle(s.nome)}
              className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-opacity ${
                off ? "opacity-35" : "opacity-100"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} />
              <span className="text-txtDim">{s.nome}</span>
            </button>
          );
        })}
      </div>

      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {visiveis.map((s, si) => (
              <linearGradient key={s.nome} id={`mfill-${gid}-${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.cor} stopOpacity={0.26} />
                <stop offset="100%" stopColor={s.cor} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {visiveis.map((s, si) => {
            const coords = s.valores.map((v, i) => ({ x: xPct(i), y: yPct(v) }));
            const line = smoothPath(coords);
            const area = coords.length ? `${line} L ${coords[coords.length - 1].x} 100 L ${coords[0].x} 100 Z` : "";
            return (
              <g key={s.nome}>
                <motion.path
                  d={area}
                  fill={`url(#mfill-${gid}-${si})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, ease: EASE, delay: si * 0.06 }}
                />
                <motion.path
                  d={line}
                  fill="none"
                  stroke={s.cor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE, delay: si * 0.06 }}
                />
              </g>
            );
          })}
        </svg>

        {/* hover guide + a dot per visible series */}
        {hover !== null && (
          <>
            <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-lineStrong" style={{ left: `${xPct(hover)}%` }} />
            {visiveis.map((s) => (
              <span
                key={s.nome}
                className="pointer-events-none absolute rounded-full border-2"
                style={{
                  left: `${xPct(hover)}%`,
                  top: `${yPct(s.valores[hover] ?? 0)}%`,
                  width: 10,
                  height: 10,
                  transform: "translate(-50%,-50%)",
                  background: cores.bg,
                  borderColor: s.cor,
                  boxShadow: `0 0 9px ${s.cor}`,
                }}
              />
            ))}
          </>
        )}

        {/* tooltip listing every visible series at the hovered period (edge-aware) */}
        {hover !== null && labels[hover] && (
          <div
            className="pointer-events-none absolute z-10 rounded-chip border border-lineStrong bg-panel px-2.5 py-1.5 backdrop-blur-md"
            style={{
              left: `${xPct(hover)}%`,
              top: 0,
              transform: `translate(${xPct(hover) > 72 ? "-100%" : xPct(hover) < 28 ? "0%" : "-50%"}, 4px)`,
            }}
          >
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint">{labels[hover]}</div>
            {visiveis.map((s) => (
              <div key={s.nome} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.cor }} />
                  <span className="font-mono text-[10px] text-txtDim">{s.nome}</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-txt">{format(s.valores[hover] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* x-axis labels */}
      <div className="mt-2 flex justify-between">
        {labels.map((l, i) => (
          <span
            key={i}
            className={`font-mono text-[10px] uppercase tracking-[0.08em] ${hover === i ? "text-txt" : "text-txtFaint"}`}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
