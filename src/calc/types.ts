// Domain types for Painel J. See PLAN.md §4.

/** A sourced product (one row of the research sheet + new fields). */
export type Produto = {
  id: string;
  codigoProduto?: string;
  nome: string;
  link?: string; // link do anúncio referência (idea #5)
  imagem?: string; // data URL or remote URL (idea #6)
  dataPesquisa?: string; // ISO date
  fornecedor?: string;
  precoVenda: number; // D — valor venda
  vendasMes: number; // E — vendas/mês
  custoUnit: number; // F — custo fornecedor (por unidade)
  qtdCaixa: number; // H — quantidade por caixa
  imposto: number; // I — default 0.04
  comissao: number; // J — default 0.15
  custoEmbalagem?: number; // optional packaging/branding cost per unit (idea #7)
  estoqueAtual?: number; // current units in stock (idea #1 "manage stock")
  /** manual override of the auto Aprovado/Reprovado rule; null = use auto */
  aprovadoManual?: boolean | null;
};

/** A one-off ("avulsa") sale recorded by hand (idea #4). */
export type VendaAvulsa = {
  id: string;
  produtoId?: string;
  nome: string;
  data: string; // ISO date
  precoVendido: number;
  custo: number;
  frete: number;
  observacao?: string;
};

/** A saved pricing calculation (ideas #13/#14). Never mutates real produtos. */
export type CalculoSalvo = {
  id: string;
  nome: string;
  custoUnit: number;
  fornecedor?: string;
  imposto: number;
  comissao: number;
  custoEmbalagem: number;
  margemDesejada: number; // e.g. 0.15
  precoSugerido: number;
  criadoEm: string; // ISO datetime
};

/** Fully derived metrics for a product (computed, never stored). */
export type MetricasProduto = {
  custoCaixa: number; // custoUnit * qtdCaixa
  valorLiquido: number; // após imposto + comissão
  freteUnit: number;
  totalTaxasComissao: number; // valor de imposto + comissão em R$
  // cenário com frete
  lucroUnit: number;
  margem: number;
  lucroMensal: number;
  lucroCaixa: number;
  // cenário sem frete ("Sem Taxas" block)
  lucroUnitSemFrete: number;
  margemSemFrete: number;
  lucroMensalSemFrete: number;
  lucroCaixaSemFrete: number;
  // extras
  capitalEstoque: number; // capital travado p/ manter 1 caixa
  paybackMeses: number | null; // capital / lucroMensal
  statusCor: "vermelho" | "amarelo" | "verde";
  aprovado: boolean;
};
