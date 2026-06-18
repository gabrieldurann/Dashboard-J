// Design tokens (mirror tailwind.config.js + DESIGN.md). For use in inline SVG / JS where
// Tailwind classes don't reach (gauge gradients, chart strokes).
export const COLORS = {
  bg: "#06080c",
  panel: "rgba(13,18,26,0.82)",
  line: "rgba(140,170,200,0.14)",
  green: "#34e3a0",
  gold: "#e8b84b",
  danger: "#ff5f6b",
  amber: "#f5a623",
  txt: "#e8eef5",
  txtDim: "#8b97a8",
  txtFaint: "#5a6678",
} as const;

export const STATUS_COLOR = {
  vermelho: "#ff5f6b",
  amarelo: "#f5a623",
  verde: "#34e3a0",
} as const;

/** signature easing (DESIGN.md §5) */
export const EASE = [0.25, 0.8, 0.3, 1] as const;
