import { motion } from "framer-motion";
import { Globe2 } from "lucide-react";
import type { AggPais } from "../calc/engine";
import { paisFlag, paisNome } from "../data/countries";
import { money, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { GlowCard } from "./GlowCard";

// Sales by Country panel (PLAN.md §9 Phase 3 #8): ranked flag · país · vendas · valor · % do total,
// each row backed by a share bar. Fills the half beside the globe. "% do total" = our rename of
// the screenshot's "Bounce %".

export function SalesByCountry({ dados, delay = 0 }: { dados: AggPais[]; delay?: number }) {
  const maxShare = Math.max(...dados.map((d) => d.share), 0.0001);

  return (
    <GlowCard delay={delay} className="flex flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
          <Globe2 size={15} className="text-green" strokeWidth={2} />
        </span>
        <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Vendas por País</span>
      </div>
      <p className="mb-3 font-mono text-xs text-txtFaint">Receita e participação por país · maiores primeiro</p>

      {dados.length === 0 ? (
        <p className="py-8 text-center text-sm text-txtDim">Nenhuma venda com país registrado.</p>
      ) : (
        <ul className="flex max-h-[260px] flex-col gap-2.5 overflow-y-auto pr-1">
          {dados.map((d, i) => (
            <li key={d.code}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 truncate text-sm text-txt">
                  <span>{paisFlag(d.code)}</span>
                  <span className="truncate">{paisNome(d.code)}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="font-mono text-[11px] text-txtFaint">{d.pedidos} vendas</span>
                  <span className="w-20 text-right font-mono text-sm tabular-nums text-gold">{money(d.valor)}</span>
                  <span className="w-12 text-right font-mono text-xs tabular-nums text-txtDim">{percent(d.share)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.share / maxShare) * 100}%` }}
                  transition={{ duration: 0.6, ease: EASE, delay: delay + 0.05 * i }}
                  className="h-full rounded-full bg-green"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlowCard>
  );
}
