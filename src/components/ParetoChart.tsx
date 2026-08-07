import { motion } from "framer-motion";
import { useState } from "react";
import { money, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";

export type ParetoItem = {
  id: string;
  nome: string;
  valor: number;
  /** Cumulative share of the total, 0–1, in the order the items are given. */
  acumulado: number;
  classe: string;
  cor: string;
};

/**
 * Pareto view of the ABC curve: a bar per product (revenue, coloured by class) with the
 * cumulative-share curve laid over it and guides at the class cut-offs. Reads left-to-right as
 * "these few carry most of it" — the whole point of the classification.
 */
export function ParetoChart({
  itens,
  cortes = [],
}: {
  itens: ParetoItem[];
  /** Horizontal guides, e.g. [{ share: 0.8, label: "80% · A" }]. */
  cortes?: { share: number; label: string }[];
}) {
  const [ativo, setAtivo] = useState<string | null>(null);

  const comValor = itens.filter((i) => i.valor > 0);
  if (comValor.length === 0) {
    return <p className="py-8 text-center text-sm text-txtDim">Sem vendas no período para classificar.</p>;
  }

  const max = Math.max(...comValor.map((i) => i.valor));
  const n = comValor.length;
  const centro = (i: number) => ((i + 0.5) / n) * 100;
  const linha = comValor.map((i, idx) => `${centro(idx)},${100 - i.acumulado * 100}`).join(" ");
  const emFoco = comValor.find((i) => i.id === ativo);

  return (
    <div>
      <div className="relative h-[210px]">
        {/* cumulative curve + class cut-offs, stretched over the bars */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {cortes.map((c) => (
            <line
              key={c.share}
              x1="0"
              x2="100"
              y1={100 - c.share * 100}
              y2={100 - c.share * 100}
              stroke="var(--c-line-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <motion.polyline
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            points={linha}
            fill="none"
            stroke="var(--c-txt-dim)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {cortes.map((c) => (
          <span
            key={c.share}
            className="pointer-events-none absolute right-0 -translate-y-full pr-0.5 font-mono text-[10px] text-txtFaint"
            style={{ top: `${100 - c.share * 100}%` }}
          >
            {c.label}
          </span>
        ))}

        {/* bars */}
        <div className="flex h-full items-end gap-1.5">
          {comValor.map((i, idx) => (
            <div
              key={i.id}
              className="flex h-full flex-1 cursor-default flex-col justify-end"
              onPointerEnter={() => setAtivo(i.id)}
              onPointerLeave={() => setAtivo(null)}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(i.valor / max) * 100}%` }}
                transition={{ duration: 0.55, ease: EASE, delay: 0.05 * idx }}
                className="w-full rounded-t-[3px]"
                style={{
                  background: i.cor,
                  opacity: ativo && ativo !== i.id ? 0.35 : 0.85,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* x labels */}
      <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
        {comValor.map((i) => (
          <div key={i.id} className="min-w-0 flex-1 text-center">
            <span className="block truncate font-mono text-[10px] text-txtFaint" title={i.nome}>
              {i.nome}
            </span>
            <span className="font-mono text-[10px]" style={{ color: i.cor }}>
              {i.classe}
            </span>
          </div>
        ))}
      </div>

      {/* readout: the total until you hover a bar, then that product */}
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
          {emFoco ? emFoco.nome : `${n} produto${n > 1 ? "s" : ""} com venda`}
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums text-txt">
          {emFoco ? (
            <>
              {money(emFoco.valor)}
              <span className="ml-2 text-txtDim">acum. {percent(emFoco.acumulado)}</span>
            </>
          ) : (
            money(comValor.reduce((s, i) => s + i.valor, 0))
          )}
        </span>
      </div>
    </div>
  );
}
