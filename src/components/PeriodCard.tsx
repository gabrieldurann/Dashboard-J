import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ResumoPeriodo } from "../calc/engine";
import { money, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { BigStat } from "./BigStat";
import { GlowCard } from "./GlowCard";

// Daily / Monthly / Yearly sales card (PLAN.md §9 Phase 3 #10): current-period value +
// ▲/▼ vs the previous period + a momentum bar (current's share of current+previous).

export function PeriodCard({
  label,
  periodo,
  sublabel,
  hint,
  delay = 0,
}: {
  label: string;
  periodo: ResumoPeriodo;
  sublabel?: string;
  hint?: string;
  delay?: number;
}) {
  const valor = periodo.atual?.valor ?? 0;
  const ant = periodo.anterior?.valor ?? 0;
  const v = periodo.variacao;
  const up = v != null && v >= 0;
  const fill = valor + ant > 0 ? valor / (valor + ant) : valor > 0 ? 1 : 0;

  return (
    <GlowCard delay={delay}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">{label}</span>
        {sublabel && <span className="font-mono text-[11px] text-txtFaint">{sublabel}</span>}
      </div>
      {hint && <p className="mt-0.5 font-mono text-[10px] text-txtFaint">{hint}</p>}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {v != null &&
            (up ? (
              <ArrowUpRight size={20} className="shrink-0 text-green" strokeWidth={2.4} />
            ) : (
              <ArrowDownRight size={20} className="shrink-0 text-danger" strokeWidth={2.4} />
            ))}
          <BigStat value={valor} format={money} className="text-2xl 2xl:text-3xl" />
        </div>
        {v != null ? (
          <span className={`shrink-0 font-mono text-sm tabular-nums ${up ? "text-green" : "text-danger"}`}>
            {up ? "+" : "−"}
            {percent(Math.abs(v))}
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[11px] text-txtFaint">1º período</span>
        )}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line/40">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(fill * 100)}%` }}
          transition={{ duration: 0.7, ease: EASE, delay: delay + 0.1 }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #2bb3ff, #34e3a0)" }}
        />
      </div>

      <p className="mt-2 font-mono text-[11px] text-txtFaint">
        {periodo.anterior ? `anterior: ${money(ant)}` : "sem período anterior"}
      </p>
    </GlowCard>
  );
}
