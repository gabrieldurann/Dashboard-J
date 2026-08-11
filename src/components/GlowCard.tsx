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
  preencher = false,
}: {
  children: ReactNode;
  accent?: Accent;
  grid?: boolean;
  className?: string;
  delay?: number;
  /**
   * Make the content wrapper a full-height flex column. Needed because children otherwise sit
   * inside a plain `<div>`, so `flex-1` on them has nothing to grow against and a stretched
   * card (`h-full` in a grid row) ends up with its content bunched at the top.
   */
  preencher?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={`relative overflow-hidden rounded-card border border-line bg-panel p-5 backdrop-blur-sm ${glow[accent]} ${className}`}
    >
      {grid && <div className="hud-grid pointer-events-none absolute inset-0 opacity-60" />}
      <div className={`relative ${preencher ? "flex h-full flex-col" : ""}`}>{children}</div>
    </motion.div>
  );
}
