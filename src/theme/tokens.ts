// Design tokens (mirror index.css + tailwind.config.js + DESIGN.md). For use in inline SVG / JS
// where Tailwind classes don't reach (gauge gradients, chart strokes, the WebGL globe).
// Values must stay in sync with the CSS variables in index.css.

export type Tema = "escuro" | "claro";

export type Paleta = {
  bg: string;
  panel: string;
  line: string;
  green: string;
  gold: string;
  danger: string;
  amber: string;
  sky: string;
  txt: string;
  txtDim: string;
  txtFaint: string;
  /** extra hues used by the multi-item chart palette */
  roxo: string;
  ciano: string;
  /** WebGL globe (can't read CSS variables) */
  globoBase: string;
  globoGlow: string;
};

const ESCURA: Paleta = {
  bg: "#06080c",
  panel: "rgba(13,18,26,0.82)",
  line: "rgba(140,170,200,0.14)",
  green: "#34e3a0",
  gold: "#e8b84b",
  danger: "#ff5f6b",
  amber: "#f5a623",
  sky: "#4ea1f0",
  txt: "#e8eef5",
  txtDim: "#8b97a8",
  txtFaint: "#5a6678",
  roxo: "#b57ef0",
  ciano: "#4ad4d4",
  globoBase: "#12202c",
  globoGlow: "#0a1a16",
};

/** Same hues darkened so they hold contrast on a bright surface. */
const CLARA: Paleta = {
  bg: "#f4f6fa",
  panel: "rgba(255,255,255,0.9)",
  line: "rgba(24,40,60,0.12)",
  green: "#0f9d6b",
  gold: "#a97b12",
  danger: "#d23c47",
  amber: "#b5841a",
  sky: "#1c78cf",
  txt: "#14181f",
  txtDim: "#55617a",
  txtFaint: "#7d879b",
  roxo: "#7d43c0",
  ciano: "#137d7d",
  globoBase: "#c8d4e2",
  globoGlow: "#e8eef5",
};

export const PALETAS: Record<Tema, Paleta> = { escuro: ESCURA, claro: CLARA };

/** Health-band colours for a palette (red / yellow / green). */
export const statusColors = (p: Paleta) => ({
  vermelho: p.danger,
  amarelo: p.amber,
  verde: p.green,
});

/** Dark defaults — kept for non-reactive callers; prefer `useCores()` in components. */
export const COLORS = ESCURA;
export const STATUS_COLOR = statusColors(ESCURA);

/** signature easing (DESIGN.md §5) */
export const EASE = [0.25, 0.8, 0.3, 1] as const;
