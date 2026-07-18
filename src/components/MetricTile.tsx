import type { LucideIcon } from "lucide-react";
import { GlowCard } from "./GlowCard";
import { BigStat } from "./BigStat";

/** Label + icon chip + big mono stat + optional footnote (DESIGN.md §6).
 *  `dense` shrinks the value (text-xl) so tiles stay legible in tight multi-column grids. */
export function MetricTile({
  label,
  value,
  format,
  icon: Icon,
  accent = "green",
  footnote,
  delay = 0,
  className = "",
  dense = false,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  icon: LucideIcon;
  accent?: "green" | "gold" | "red";
  footnote?: string;
  delay?: number;
  className?: string;
  dense?: boolean;
}) {
  const accentText = accent === "gold" ? "text-gold" : accent === "red" ? "text-danger" : "text-green";
  const chipBg = accent === "gold" ? "bg-goldSoft" : accent === "red" ? "bg-danger/12" : "bg-greenSoft";
  return (
    <GlowCard delay={delay} className={className}>
      <div className="flex items-center gap-2">
        <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-chip ${chipBg}`}>
          <Icon size={15} className={accentText} strokeWidth={2} />
        </span>
        <span className="min-w-0 truncate font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">{label}</span>
      </div>
      <div className="mt-3">
        <BigStat value={value} format={format} accent="text-txt" className={dense ? "text-xl" : "text-3xl"} />
      </div>
      {footnote && <p className="mt-1.5 font-mono text-xs text-txtFaint">{footnote}</p>}
    </GlowCard>
  );
}
