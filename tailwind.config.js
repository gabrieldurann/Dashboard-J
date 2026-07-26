/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Every colour resolves through a CSS variable so the light theme is a palette swap
      // (see index.css) rather than a second set of classes.
      colors: {
        bg: "var(--c-bg)",
        bgRaise: "var(--c-bg-raise)",
        panel: "var(--c-panel)",
        line: "var(--c-line)",
        lineStrong: "var(--c-line-strong)",
        green: "var(--c-green)",
        greenSoft: "var(--c-green-soft)",
        gold: "var(--c-gold)",
        goldSoft: "var(--c-gold-soft)",
        danger: "var(--c-danger)",
        amber: "var(--c-amber)",
        amberSoft: "var(--c-amber-soft)",
        neutroSoft: "var(--c-neutro-soft)",
        sky: "var(--c-sky)",
        skySoft: "var(--c-sky-soft)",
        txt: "var(--c-txt)",
        txtDim: "var(--c-txt-dim)",
        txtFaint: "var(--c-txt-faint)",
      },
      fontFamily: {
        display: ["var(--font-display)", "'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: { card: "14px", chip: "7px" },
      boxShadow: {
        glowGreen: "0 0 14px rgba(52,227,160,0.25)",
        glowGold: "0 0 14px rgba(232,184,75,0.22)",
      },
    },
  },
  plugins: [],
};
