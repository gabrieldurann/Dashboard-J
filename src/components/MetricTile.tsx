import type { LucideIcon } from "lucide-react";
import { GlowCard } from "./GlowCard";
import { BigStat } from "./BigStat";

/** Label + icon chip + big mono stat + optional footnote (DESIGN.md §6). */
export function MetricTile({
  label,
  value,
  format,
  icon: Icon,
  accent = "green",
  footnote,
  delay = 0,
  className = "",
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  icon: LucideIcon;
  accent?: "green" | "gold";
  footnote?: string;
  delay?: number;
  className?: string;
}) {
  const accentText = accent === "gold" ? "text-gold" : "text-green";
  const chipBg = accent === "gold" ? "bg-goldSoft" : "bg-greenSoft";
  return (
    <GlowCard delay={delay} className={className}>
      <div className="flex items-center gap-2">
        <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-chip ${chipBg}`}>
          <Icon size={15} className={accentText} strokeWidth={2} />
        </span>
        <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">{label}</span>
      </div>
      <div className="mt-3">
        <BigStat value={value} format={format} accent="text-txt" className="text-3xl" />
      </div>
      {footnote && <p className="mt-1.5 font-mono text-xs text-txtFaint">{footnote}</p>}
    </GlowCard>
  );
}
