import { motion } from "framer-motion";
import { useState } from "react";
import { EASE } from "../theme/tokens";

// Donut / pie for composition ("where does each R$ go", "who carries the revenue").
// SVG arcs via stroke-dasharray on concentric circles; the centre doubles as the readout —
// it shows the total until you hover a slice, then that slice's own figure.

export type Fatia = { nome: string; valor: number; cor: string };

const R = 42; // radius inside the 0–100 viewBox
const C = 2 * Math.PI * R;

export function DonutChart({
  fatias,
  format,
  titulo,
  size = 190,
  espessura = 15,
}: {
  fatias: Fatia[];
  format: (v: number) => string;
  /** centre caption shown when nothing is hovered */
  titulo?: string;
  size?: number;
  espessura?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const visiveis = fatias.filter((f) => f.valor > 0);
  const total = visiveis.reduce((s, f) => s + f.valor, 0);

  if (total <= 0) {
    return <p className="py-10 text-center text-sm text-txtDim">Sem dados no filtro atual.</p>;
  }

  // running offset so each arc starts where the previous ended
  let acc = 0;
  const arcos = visiveis.map((f) => {
    const share = f.valor / total;
    const arco = { ...f, share, len: share * C, offset: acc };
    acc += share * C;
    return arco;
  });

  const foco = hover != null ? arcos[hover] : null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {arcos.map((a, i) => (
            <motion.circle
              key={a.nome}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.cor}
              strokeWidth={hover === i ? espessura + 3 : espessura}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
              initial={{ opacity: 0 }}
              animate={{ opacity: hover == null || hover === i ? 1 : 0.35 }}
              transition={{ duration: 0.25, ease: EASE }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
            />
          ))}
        </svg>

        {/* centre readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-txtFaint">
            {foco ? foco.nome : (titulo ?? "Total")}
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums text-txt">
            {format(foco ? foco.valor : total)}
          </span>
          {foco && (
            <span className="font-mono text-[11px] tabular-nums" style={{ color: foco.cor }}>
              {(foco.share * 100).toFixed(1).replace(".", ",")}%
            </span>
          )}
        </div>
      </div>

      {/* legend */}
      <ul className="flex w-full min-w-0 flex-col gap-1.5">
        {arcos.map((a, i) => (
          <li
            key={a.nome}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className={`flex items-baseline justify-between gap-3 transition-opacity ${
              hover == null || hover === i ? "opacity-100" : "opacity-45"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.cor }} />
              <span className="truncate text-sm text-txt">{a.nome}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-txtDim">
              {(a.share * 100).toFixed(1).replace(".", ",")}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
