// Domain types for Painel J. See PLAN.md §4.

/**
 * A storefront the business sells through — "Loja 1 — Amazon BR", "Loja 2 — Mercado Livre".
 *
 * One flat level, mirroring Gestor Seller's single "Empresa" field. Taxes, commission and the
 * health bands stay global (they live in `Configuracoes`); a loja owns only the money that moved
 * through it: vendas, compras, devoluções, custos operacionais and anúncios.
 *
 * The product CATALOGUE is deliberately shared. Stock is already derived from
 * `compras − vendas + devoluções`, so tagging those three gives per-store stock for free while the
 * same product can sell from more than one storefront without becoming two drifting records.
 */
export type Loja = {
  id: string;
  nome: string;
  /** e.g. "Amazon", "Mercado Livre" — a hint only; the sale's own `canal` is what counts. */
  canal?: string;
  observacao?: string;
};


/** A sourced product (one row of the research sheet + new fields). */
export type Produto = {
  id: string;
  codigoProduto?: string;
  asin?: string; // Amazon Standard Identification Number — key for selling/linking on Amazon
  ean?: string; // EAN/GTIN barcode — used for Amazon "match" listing & catalog lookup
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
  /**
   * Days between placing a supplier order and the stock arriving. Optional: without it the
   * stock cover still says how long the shelf lasts, it just can't say when to order.
   */
  prazoReposicaoDias?: number;
  /** Opening balance in units. Real stock is DERIVED from here plus the ledgers
   *  (see `estoqueProdutos`): inicial + compras recebidas − vendidas + devoluções reestocadas. */
  /**
   * Legacy opening balance. No longer settable in the app: an opening balance on the product is
   * company-wide, so it belongs to no storefront and stops the stores adding up to the company.
   * Opening stock is recorded as a received purchase in Compras, which carries a loja, a cost and
   * a date. Still honoured here for data that predates that.
   */
  estoqueInicial?: number;
  /** manual override of the auto Aprovado/Reprovado rule; null = use auto */
  aprovadoManual?: boolean | null;
};

export type VendaStatus = "pendente" | "enviado" | "entregue" | "cancelado";

/** An individual sale record (the sales ledger). A sale with no `produtoId` is "avulsa". */
export type Venda = {
  id: string;
  /** which storefront this sale belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
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
  /** Where this record came from. Absent = typed in by hand, which is what every older sale was. */
  origem?: OrigemDado;
  /** Which linked account imported it — lets any figure be traced back to its connection. */
  contaId?: string;
};

/** How a record entered the app. Imported records can always be traced back to their connection. */
export type OrigemDado = "manual" | "amazon";

/**
 * One order line as the Selling Partner API hands it over.
 *
 * **Deliberately does NOT carry the buyer's name or address.** That is restricted data: it needs
 * a separate authorization and, historically, passing Amazon's PII audit. A first working
 * integration will not have it, so the mock must not pretend otherwise — the "Cliente" column
 * simply stays empty on imported rows.
 *
 * `pais` is safe: it comes from the marketplace the account sells on, not from the buyer.
 */
export type PedidoAmazon = {
  /** Amazon Order ID — the identity used to avoid importing the same line twice. */
  numeroPedido: string;
  data: string; // ISO datetime (purchase date)
  sku: string; // seller SKU
  asin?: string; // Amazon's own identifier for the listing
  titulo: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  /** Shipping charged to the buyer, as reported by the API. Not the freight *you* paid. */
  frete?: number;
  /** Country of the marketplace, not of the buyer — derived, so it is not restricted data. */
  pais?: string;
  status: VendaStatus;
};

/**
 * One product's advertising figures for a period, as the **Ads API** reports them.
 * A different API from the orders above, which is why it arrives through its own connection.
 */
export type RelatorioAds = {
  /** Identity for de-duplication: one report row per campaign per period. */
  campanhaId: string;
  campanha: string;
  data: string; // ISO date — the period the figures cover
  sku: string;
  titulo: string;
  custo: number;
  faturamentoAds: number;
  unidadesAds: number;
  cliques?: number;
  impressoes?: number;
};

/** Why a customer returned the order (idea #1). Drives the "por motivo" breakdown. */
export type MotivoDevolucao =
  | "defeito" // chegou com defeito / não funciona
  | "danificado" // danificado no transporte
  | "errado" // produto errado / não corresponde ao anúncio
  | "arrependimento" // desistência / não queria mais
  | "atraso" // demorou demais para chegar
  | "outros";

/** Lifecycle of a return (idea #1). Lets us tell in-progress returns from finished ones. */
export type DevolucaoStatus =
  | "solicitada" // cliente pediu a devolução; ainda não recebida
  | "em_analise" // recebida, em processamento / inspeção
  | "aprovada" // aprovada — reembolso/reestoque pendente
  | "concluida" // finalizada (reembolsada e tratada)
  | "recusada"; // devolução recusada

/** A return / refund event (idea #1). Mirrors the Vendas ledger: each return can reference the
 *  originating sale (`vendaId`) and/or a catalog product (`produtoId`), so we can compute return
 *  rate per product, reason analysis, and the financial hit that eats into realized profit. */
export type Devolucao = {
  id: string;
  /** which storefront this belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
  vendaId?: string; // link to the originating sale (optional)
  produtoId?: string; // link to a catalog product (optional → avulsa)
  produtoNome: string; // snapshot of the product name
  codigoProduto?: string; // snapshot of the product code
  data: string; // ISO datetime the return was opened/registered
  quantidade: number; // units returned
  motivo: MotivoDevolucao;
  status: DevolucaoStatus; // where the return is in its lifecycle
  valorReembolsado: number; // refund paid back to the customer (R$)
  reestocado: boolean; // did the returned unit(s) go back into sellable stock?
  dataReestoque?: string; // ISO date the unit(s) went back into stock (only when reestocado)
  canal?: string; // snapshot of the sales channel (Amazon, Mercado Livre…)
  cliente?: string; // snapshot
  numeroPedido?: string; // snapshot
  observacao?: string;
};

/** Where a stock purchase is in its lifecycle. Only `recebida` adds units to stock. */
export type CompraStatus = "pedida" | "em_transito" | "recebida" | "cancelada";

/**
 * A stock purchase (idea #3) — what was bought from the supplier, for how much, and whether it
 * has arrived. Mirrors the Vendas/Devoluções ledgers: received purchases feed the derived stock,
 * and each purchase keeps the unit cost actually paid (the product's own custoUnit is only
 * updated on request, never silently).
 */
export type Compra = {
  id: string;
  /** which storefront this belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
  produtoId?: string; // link to a catalog product (optional → avulsa)
  produtoNome: string; // snapshot of the product name
  codigoProduto?: string; // snapshot
  data: string; // ISO datetime the order was placed
  dataRecebimento?: string; // ISO date it arrived (set when status = recebida)
  quantidade: number; // units bought
  custoUnit: number; // unit cost paid on this purchase
  frete?: number; // freight for the whole purchase
  outrosCustos?: number; // import tax, despachante, etc.
  status: CompraStatus;
  fornecedor?: string;
  numeroNota?: string; // invoice / order number
  observacao?: string;
};

/** A one-off ("avulsa") sale recorded by hand (idea #4) — quick manual entry, kept in its own list. */
export type VendaAvulsa = {
  id: string;
  /** which storefront this belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
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

/** Operational income (Gestor Seller "Receitas Operacionais") — money in that isn't a product sale. */
export type CategoriaReceita =
  | "juros" // rendimento de aplicação, juros recebidos
  | "reembolso" // reembolso de fornecedor / marketplace
  | "servicos" // serviços prestados
  | "aluguel_recebido" // sublocação, aluguel de equipamento
  | "outros_ganhos";

export type CategoriaOperacional = CategoriaCusto | CategoriaReceita;

/** Money out (despesa) or money in (receita). Absent means despesa — the original behaviour. */
export type TipoOperacional = "despesa" | "receita";

/** A company-level operating entry (idea #13) — overhead, or operational income, that belongs to no
 *  single product: rent, internet, salaries, but also interest earned or a supplier rebate. */
export type CustoOperacional = {
  id: string;
  /** which storefront this belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
  nome: string;
  categoria: CategoriaOperacional;
  /** Amount for one month (R$). Named `valorMensal` since every entry is read per month. */
  valorMensal: number;
  /** Absent = "despesa", so entries created before operational income existed still read right. */
  tipo?: TipoOperacional;
  /** Applies every month (default) vs a one-off that only hits the month of `data`.
   *  Absent = recurring, which is what every pre-existing entry was. */
  recorrente?: boolean;
  /** ISO date the one-off belongs to. Only meaningful when `recorrente` is false. */
  data?: string;
  observacao?: string;
};

/** State of a marketplace connection. Mirrors what an OAuth token's lifecycle can tell us. */
export type StatusConexao =
  | "conectada" // token válido, sincronizando
  | "expirada" // token venceu — precisa reautorizar
  | "revogada"; // acesso removido do lado do marketplace

/**
 * Amazon exposes selling data and advertising data through **two different APIs**, with separate
 * applications, separate approvals and separate OAuth. Linking "an Amazon account" is therefore
 * two authorizations, and a seller can perfectly well have one without the other.
 */
export type ServicoAmazon =
  | "sp-api" // Selling Partner API — pedidos, taxas, estoque, anúncios (listings)
  | "ads-api"; // Amazon Ads API — campanhas, investimento, ACOS

/** One authorized service on one seller account. */
export type ConexaoServico = {
  servico: ServicoAmazon;
  status: StatusConexao;
  conectadaEm: string; // ISO datetime
  ultimaSync?: string; // ISO datetime
};

/**
 * A linked Amazon Seller account (idea #15).
 *
 * ⚠️ Today every connection is **simulated** — there is no backend and no real OAuth. The shape
 * is deliberately what real authorizations would produce, so swapping the mock for the live flow
 * is a substitution rather than a rewrite: only `simulada` flips to false and the tokens land
 * server-side. Nothing in the UI reads a token, by design.
 */
export type ContaAmazon = {
  id: string;
  /** which storefront this belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
  /** User-facing name, so several stores stay tellable apart. */
  apelido: string;
  /** Amazon's Seller ID (merchant token). Shown masked. */
  sellerId: string;
  /** e.g. "Amazon.com.br" — the marketplace the account sells on. */
  marketplace: string;
  /** Amazon's region grouping for the SP-API endpoint: BR/NA/EU/FE. */
  regiao: string;
  /** One entry per authorized API. Empty is possible: an account can be added and not authorized. */
  conexoes: ConexaoServico[];
  /** true = ligação de demonstração. The real backend will write false. */
  simulada: boolean;
};

/** How a sync run ended. `parcial` = some records came in, some failed. */
export type StatusExecucao = "sucesso" | "erro" | "parcial";

/**
 * One run of one sync, kept as history.
 *
 * `ConexaoServico.ultimaSync` is a stamp — it says *when*, never *what*. This is the record that
 * lets an odd figure be traced back to the response that produced it, which is the whole point of
 * the Amazon page: without it that page would just be a filtered copy of Vendas.
 */
export type ExecucaoSync = {
  id: string;
  contaId: string;
  servico: ServicoAmazon;
  iniciadaEm: string; // ISO datetime
  concluidaEm?: string; // ISO datetime
  status: StatusExecucao;
  /** Window the records cover — a real sync re-reads a date range on every run. */
  periodoDe?: string;
  periodoAte?: string;
  /** How many records the API handed over. */
  recebidos: number;
  /** How many became a new row. */
  importados: number;
  /** Already in the ledger. Expected on a re-sync — not an error. */
  duplicados: number;
  /** Imported without a catalog match, so their cost is unknown and the margin is overstated. */
  semCorrespondencia: number;
  erro?: string;
  /**
   * The response exactly as it arrived. **Optional on purpose:** it is the heavy field, so
   * retention keeps it only on the most recent runs and older entries survive as counters alone
   * (see `aplicarRetencao`).
   */
  payload?: unknown[];
};

/**
 * One month of advertising for one product on one channel (idea #12, Amazon Ads and friends).
 *
 * Entered by hand today and imported from the Ads API once a backend exists — the shape is the
 * same either way, so nothing here has to change when that lands.
 */
export type AnuncioAds = {
  id: string;
  /** which storefront this belongs to. Absent = not assigned; shows only under "Todas". */
  lojaId?: string;
  produtoId?: string; // link to a catalog product (optional → avulso)
  produtoNome: string; // snapshot of the product name
  sku?: string;
  canal: string; // Amazon, Mercado Livre, Shopee…
  /** Month the figures refer to, ISO date. Ads are read per month, like operating costs. */
  data: string;
  /** What the campaign spent (R$) — this is the money that leaves. */
  custo: number;
  /** Revenue Amazon attributes to the ads (R$). */
  faturamentoAds: number;
  /** Units sold through the ads. */
  unidadesAds: number;
  /** Units sold without ads in the same month — the organic half of the split. */
  unidadesOrganicas?: number;
  /** Ad clicks, if known. Only used for the conversion rate. */
  cliques?: number;
  observacao?: string;
  /** Absent = typed in by hand. Set when the row came from the Ads API. */
  origem?: OrigemDado;
  /** Which linked account imported it. */
  contaId?: string;
  /** Ads API campaign this row came from — the de-duplication key on re-sync. */
  campanhaId?: string;
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
