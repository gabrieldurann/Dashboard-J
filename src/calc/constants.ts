// Constants pulled directly from TabPesquisa-PADRÃO.xlsx (sheet "MODELO ATUALIZADO").
// Do NOT guess these — they come from the real sheet (idea #11). Centralised so they can be
// tuned in one place if the seller's tax/freight terms change.

/** Default tax rate (IMPOSTO) — sheet col I = 0.04 (4%). */
export const IMPOSTO_PADRAO = 0.04;

/** Default category commission (COMISSÃO CATEGORIA, range 11–15%) — sheet col J = 0.15. */
export const COMISSAO_PADRAO = 0.15;

/** Freight charged per unit (FRETE) — sheet L2:N2 = R$5.65. */
export const FRETE_UNIT = 5.65;

/** Free shipping for products above this price — sheet O1 "SOMENTE PRODUTOS ACIMA R$79". */
export const FRETE_GRATIS_ACIMA = 79;

/** Margin health bands (idea #2). Red < 11% · Yellow 11–15% · Green > 15%. */
export const MARGEM_BANDAS = {
  /** below this = red (re-avaliar) */
  vermelho: 0.11,
  /** at/above vermelho and at/below this = yellow (pode melhorar); above = green (ótimo) */
  amarelo: 0.15,
} as const;

/** Auto approval floor — a product is "Aprovado" when margin >= this (idea #2 minimum). */
export const MARGEM_APROVACAO = 0.15;

export type StatusCor = "vermelho" | "amarelo" | "verde";
