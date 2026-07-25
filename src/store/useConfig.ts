import { useStore } from "./useStore";

/** The live business rates. Pass into engine calls so every page reflects Configurações. */
export const useConfig = () => useStore((s) => s.configuracoes);
