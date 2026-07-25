import { motion } from "framer-motion";
import { EASE } from "../theme/tokens";

// Horizontal ranking bars — the quickest read for "who is biggest / who is worst".
// Bars are scaled against the largest absolute value so proportions are honest, and each row
// can carry a short trailing note (e.g. the margin %) without turning into a table.

export type BarraItem = {
  nome: string;
  valor: number;
  cor: string;
  /** small right-aligned annotation, e.g. "47,6%" */
  nota?: string;
};

export function BarRanking({
  itens,
  format,
  vazio = "Sem dados no filtro atual.",
}: {
  itens: BarraItem[];
  format: (v: number) => string;
  vazio?: string;
}) {
  if (itens.length === 0) return <p className="py-8 text-center text-sm text-txtDim">{vazio}</p>;
  const max = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));

  return (
    <ul className="flex flex-col gap-3.5">
      {itens.map((it, i) => (
        <li key={it.nome}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-txt">{it.nome}</span>
            <span className="flex shrink-0 items-baseline gap-2.5">
              {it.nota && <span className="font-mono text-[11px] tabular-nums text-txtFaint">{it.nota}</span>}
              <span className="font-mono text-sm tabular-nums" style={{ color: it.cor }}>
                {format(it.valor)}
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(it.valor) / max) * 100}%` }}
              transition={{ duration: 0.65, ease: EASE, delay: 0.05 * i }}
              className="h-full rounded-full"
              style={{ background: it.cor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
