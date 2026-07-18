/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#06080c",
        bgRaise: "#0a0e14",
        panel: "rgba(13,18,26,0.82)",
        line: "rgba(140,170,200,0.14)",
        lineStrong: "rgba(140,170,200,0.28)",
        green: "#34e3a0",
        greenSoft: "rgba(52,227,160,0.16)",
        gold: "#e8b84b",
        goldSoft: "rgba(232,184,75,0.14)",
        danger: "#ff5f6b",
        amber: "#f5a623",
        sky: "#4ea1f0",
        skySoft: "rgba(78,161,240,0.16)",
        txt: "#e8eef5",
        txtDim: "#8b97a8",
        txtFaint: "#5a6678",
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
