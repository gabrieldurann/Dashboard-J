import { motion } from "framer-motion";
import { COLORS, EASE } from "../theme/tokens";

/** Hero radial gauge — green→gold fill ring with center value/label (DESIGN.md §6). */
export function RadialGauge({
  /** 0..1 fill */
  value,
  display,
  label,
  size = 200,
}: {
  value: number;
  display: string;
  label: string;
  size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const offset = c * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.green} />
            <stop offset="100%" stopColor={COLORS.gold} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.line} strokeWidth={stroke} />
        {/* blurred underlay for glow */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gaugeFill)"
          strokeWidth={stroke + 6}
          strokeLinecap="round"
          strokeDasharray={c}
          opacity={0.25}
          style={{ filter: "blur(6px)" }}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: EASE }}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gaugeFill)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold tabular-nums text-txt">{display}</span>
        <span className="eyebrow mt-1" style={{ color: COLORS.gold }}>
          {label}
        </span>
      </div>
    </div>
  );
}
