import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "../theme/tokens";

type Accent = "green" | "gold" | "none";

const glow: Record<Accent, string> = {
  green: "shadow-glowGreen",
  gold: "shadow-glowGold",
  none: "",
};

/** Translucent panel with hairline border + optional accent glow & faint grid (DESIGN.md §6). */
export function GlowCard({
  children,
  accent = "none",
  grid = false,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  accent?: Accent;
  grid?: boolean;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={`relative overflow-hidden rounded-card border border-line bg-panel p-5 backdrop-blur-sm ${glow[accent]} ${className}`}
    >
      {grid && <div className="hud-grid pointer-events-none absolute inset-0 opacity-60" />}
      <div className="relative">{children}</div>
    </motion.div>
  );
}
