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

/**
 * Business rates the user can tune in Configurações (idea #9) — taxes change often, and a
 * different marketplace or country brings different terms. The constants above stay the
 * factory defaults; the store holds the live values and passes them into the engine, which
 * keeps every calculation pure and testable.
 */
export type Configuracoes = {
  /** default tax rate applied to new products/pesquisas */
  imposto: number;
  /** default channel commission for new products/pesquisas */
  comissao: number;
  /** freight charged per unit */
  freteUnit: number;
  /** orders above this price ship free */
  freteGratisAcima: number;
  /** margin below this is red */
  margemVermelho: number;
  /** margin at/below this (and >= vermelho) is yellow; above is green */
  margemAmarelo: number;
  /** a product is auto-approved at/above this margin */
  margemAprovacao: number;
};

export const CONFIG_PADRAO: Configuracoes = {
  imposto: IMPOSTO_PADRAO,
  comissao: COMISSAO_PADRAO,
  freteUnit: FRETE_UNIT,
  freteGratisAcima: FRETE_GRATIS_ACIMA,
  margemVermelho: MARGEM_BANDAS.vermelho,
  margemAmarelo: MARGEM_BANDAS.amarelo,
  margemAprovacao: MARGEM_APROVACAO,
};
