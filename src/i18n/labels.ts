import type { MotivoDevolucao } from "../calc/types";

// Shared pt-BR labels for enum-ish domain values, so a term reads identically on every page.

export const MOTIVO_LABEL: Record<MotivoDevolucao, string> = {
  defeito: "Defeito",
  danificado: "Danificado no transporte",
  errado: "Produto errado",
  arrependimento: "Arrependimento",
  atraso: "Atraso na entrega",
  outros: "Outros",
};

export const MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoDevolucao[];
