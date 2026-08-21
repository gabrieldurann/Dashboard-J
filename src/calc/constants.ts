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
  /**
   * Tax rate per destination country, as ISO code → rate (0.19 = 19%).
   *
   * Optional so a browser holding an older `configuracoes` still hydrates; absent falls back to
   * `IMPOSTO_POR_PAIS`. A country present here overrides the product's own rate for sales shipped
   * there — that is the whole point, since every product carries a domestic rate and an export
   * would otherwise be taxed as if it never left.
   */
  impostosPorPais?: Record<string, number>;
};

/**
 * Default destination tax rates. Brazil keeps the sheet's 4%; the rest are each country's
 * standard VAT/GST headline rate, and the United States is 0 because sales tax there is collected
 * by the marketplace rather than borne by the seller.
 *
 * These are DEFAULTS, not truths: the real rate depends on the regime, the marketplace and the
 * product category, which is exactly why Configurações lets every one of them be edited.
 */
export const IMPOSTO_POR_PAIS: Record<string, number> = {
  BR: IMPOSTO_PADRAO,
  US: 0,
  CA: 0.05,
  MX: 0.16,
  GB: 0.2,
  PT: 0.23,
  ES: 0.21,
  FR: 0.2,
  DE: 0.19,
  IT: 0.22,
  JP: 0.1,
  AU: 0.1,
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
