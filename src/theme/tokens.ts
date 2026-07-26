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
  /** far end of the margin-gauge sweep (gold reads too yellow on a light surface) */
  gaugeFim: string;
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
  gaugeFim: "#e8b84b",
  txt: "#e8eef5",
  txtDim: "#8b97a8",
  txtFaint: "#5a6678",
  roxo: "#b57ef0",
  ciano: "#4ad4d4",
  globoBase: "#12202c",
  globoGlow: "#0a1a16",
};

/**
 * Same hues on a bright surface. They keep full chroma and only give up lightness — desaturating
 * them turns gold into brown and the whole page reads dead. Must match index.css.
 */
const CLARA: Paleta = {
  bg: "#f2f5f9",
  panel: "rgba(255,255,255,0.92)",
  line: "rgba(20,35,55,0.13)",
  green: "#00b37c",
  gold: "#dd9b00",
  danger: "#f01f3d",
  amber: "#f58300",
  sky: "#0d7ff0",
  gaugeFim: "#0d7ff0",
  txt: "#10151d",
  txtDim: "#4d5a70",
  txtFaint: "#79849a",
  roxo: "#8a2be2",
  ciano: "#00adad",
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
