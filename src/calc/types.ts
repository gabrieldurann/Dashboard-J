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

export type VendaStatus = "pendente" | "enviado" | "entregue" | "cancelado";

/** An individual sale record (the sales ledger). A sale with no `produtoId` is "avulsa". */
export type Venda = {
  id: string;
  data: string; // ISO datetime (timestamp)
  produtoId?: string; // link to a catalog product (optional → venda avulsa)
  produtoNome: string; // snapshot of the product name
  codigoProduto?: string; // snapshot of the product code
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  canal?: string; // sales channel (Amazon, Mercado Livre, Shopee, Site...)
  status: VendaStatus;
  numeroPedido?: string;
  cliente?: string;
  // shipping
  enderecoEntrega?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  pais?: string; // ISO 3166-1 alpha-2 country code (see data/countries.ts) — for sales-per-country
  frete?: number;
  observacao?: string;
};

/** A one-off ("avulsa") sale recorded by hand (idea #4) — quick manual entry, kept in its own list. */
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

/** A recurring company operating cost (idea #13) — overhead that doesn't belong to any product:
 *  rent, internet, electricity, water, software, etc. Used for the true "money in pocket" profit. */
export type CategoriaCusto =
  | "aluguel"
  | "energia"
  | "agua"
  | "internet"
  | "telefone"
  | "software"
  | "salarios"
  | "contabilidade"
  | "outros";

export type CustoOperacional = {
  id: string;
  nome: string;
  categoria: CategoriaCusto;
  valorMensal: number; // recurring monthly amount (R$)
  observacao?: string;
};

/** A product research entry — the "TabPesquisa" log. Mirrors the sheet's columns. */
export type Pesquisa = {
  id: string;
  link?: string; // LINK DO ANÚNCIO REFERÊNCIA
  nome: string; // NOME DO PRODUTO
  imagem?: string; // product image (data URL or remote URL)
  dataPesquisa?: string; // DATA PESQUISA
  precoVenda: number; // VALOR VENDA
  vendasMes: number; // VENDAS/MÊS
  custoUnit: number; // CUSTO FORNECEDOR
  fornecedor?: string; // FORNECEDOR
  qtdCaixa: number; // Quantidade Caixa
  imposto: number; // IMPOSTO
  comissao: number; // COMISSÃO CATEGORIA (11–15%)
  /** manual override of the auto Aprovado/Reprovado verdict; null = auto (margem ≥ 15%) */
  aprovadoManual?: boolean | null;
  observacao?: string;
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
