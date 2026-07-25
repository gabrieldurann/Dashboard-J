import { useEffect } from "react";
import { PALETAS, statusColors } from "./tokens";
import { useStore } from "../store/useStore";

/** The active palette, for inline SVG/JS colours. Re-renders the caller on a theme change. */
export const useCores = () => PALETAS[useStore((s) => s.tema)];

/** Health-band colours (red / yellow / green) for the active theme. */
export const useStatusCores = () => statusColors(useCores());

/**
 * Mirrors the chosen theme onto <html data-theme>, which is what swaps the CSS variables.
 * Mounted once at the app root.
 */
export function useAplicarTema() {
  const tema = useStore((s) => s.tema);
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);
}
