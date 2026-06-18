import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { EASE } from "../theme/tokens";

/** Mono hero number with count-up (DESIGN.md §6). `format` turns the raw value into display text. */
export function BigStat({
  value,
  format,
  accent = "text-txt",
  className = "",
}: {
  value: number;
  format: (v: number) => string;
  accent?: string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.5, ease: EASE });
    return controls.stop;
  }, [value, mv]);
  return (
    <motion.span className={`font-mono font-semibold tabular-nums ${accent} ${className}`}>
      {text}
    </motion.span>
  );
}
