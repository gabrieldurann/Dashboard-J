// Calc engine — single source of truth for all profitability math.
// Faithful to TabPesquisa-PADRÃO.xlsx, with the sheet's inconsistencies cleaned (see PLAN.md §3.3).
// Pure functions only — fully unit-tested in engine.test.ts.

import {
  CONFIG_PADRAO,
  FRETE_GRATIS_ACIMA,
  FRETE_UNIT,
  type Configuracoes,
  type StatusCor,
} from "./constants";
import type {
  CategoriaCusto,
  Compra,
  CustoOperacional,
  Devolucao,
  MetricasProduto,
  MotivoDevolucao,
  Produto,
  Venda,
} from "./types";

/** Freight per unit: free above the threshold (sheet O1), else the flat fee (sheet L2:N2). */
export function freteUnitario(
  precoVenda: number,
  freteUnit = FRETE_UNIT,
  gratisAcima = FRETE_GRATIS_ACIMA,
): number {
  return precoVenda > gratisAcima ? 0 : freteUnit;
}

/** Margin health band (idea #2): red below `margemVermelho` · yellow up to `margemAmarelo` · green above. */
export function statusCor(margem: number, cfg: Configuracoes = CONFIG_PADRAO): StatusCor {
  if (margem < cfg.margemVermelho) return "vermelho";
  if (margem <= cfg.margemAmarelo) return "amarelo";
  return "verde";
}

/**
 * All derived metrics for a product.
 * Sheet mapping (cleaned):
 *   valorLiquido = D·(1 − imposto − comissão)            [sheet K, renamed]
 *   lucroUnit    = valorLiquido − custoUnit − frete − embalagem   [sheet P, unified + packaging]
 *   margem       = lucroUnit / precoVenda                 [sheet Q =P/D]
 *   lucroMensal  = lucroUnit · vendasMes                  [sheet R]
 *   lucroCaixa   = lucroUnit · qtdCaixa                   [FIX: sheet used R·H]
 *   "sem frete" block = sheet V/W/X/Y
 */
export function calcularMetricas(p: Produto, cfg: Configuracoes = CONFIG_PADRAO): MetricasProduto {
  const imposto = p.imposto ?? cfg.imposto;
  const comissao = p.comissao ?? cfg.comissao;
  const embalagem = p.custoEmbalagem ?? 0;
  const preco = p.precoVenda || 0;

  const custoCaixa = p.custoUnit * p.qtdCaixa;
  const totalTaxasComissao = preco * (imposto + comissao);
  const valorLiquido = preco - totalTaxasComissao; // = preco·(1 − imposto − comissão)
  const freteUnit = freteUnitario(preco, cfg.freteUnit, cfg.freteGratisAcima);

  // cenário com frete
  const lucroUnit = valorLiquido - p.custoUnit - freteUnit - embalagem;
  const margem = preco > 0 ? lucroUnit / preco : 0;
  const lucroMensal = lucroUnit * p.vendasMes;
  const lucroCaixa = lucroUnit * p.qtdCaixa;

  // cenário sem frete ("Sem Taxas" block)
  const lucroUnitSemFrete = valorLiquido - p.custoUnit - embalagem;
  const margemSemFrete = preco > 0 ? lucroUnitSemFrete / preco : 0;
  const lucroMensalSemFrete = lucroUnitSemFrete * p.vendasMes;
  const lucroCaixaSemFrete = lucroUnitSemFrete * p.qtdCaixa;

  // extras
  const capitalEstoque = custoCaixa; // capital travado p/ manter 1 caixa (idea #16)
  const paybackMeses = lucroMensal > 0 ? capitalEstoque / lucroMensal : null;

  const aprovado = p.aprovadoManual ?? margem >= cfg.margemAprovacao;

  return {
    custoCaixa,
    valorLiquido,
    freteUnit,
    totalTaxasComissao,
    lucroUnit,
    margem,
    lucroMensal,
    lucroCaixa,
    lucroUnitSemFrete,
    margemSemFrete,
    lucroMensalSemFrete,
    lucroCaixaSemFrete,
    capitalEstoque,
    paybackMeses,
    statusCor: statusCor(margem, cfg),
    aprovado,
  };
}

export type PrecoAlvo = {
  /** suggested price to hit the target margin, including freight if applicable */
  precoSugerido: number;
  /** price ignoring freight (free-shipping scenario) */
  precoSemFrete: number;
  /** how much freight pushes the price up while holding margin (idea #18 "+2,38") */
  impactoFrete: number;
  /** ± room band around the suggestion */
  faixaMin: number;
  faixaMax: number;
};

/**
 * Reverse-solve the price that yields a target margin (ideas #13/#18).
 * From margem = (P·(1−i−j) − custo − frete − emb) / P solved for P:
 *   P = (custo + frete + emb) / (1 − i − j − m)
 * Freight depends on whether P > 79, so we solve the no-freight price first, then add freight
 * only if the result still falls in the freight-charged band.
 */
export function precoParaMargem(
  opts: {
    custoUnit: number;
    margemDesejada: number;
    imposto?: number;
    comissao?: number;
    custoEmbalagem?: number;
    room?: number; // ± fraction, default 0.03
  },
  cfg: Configuracoes = CONFIG_PADRAO,
): PrecoAlvo {
  const imposto = opts.imposto ?? cfg.imposto;
  const comissao = opts.comissao ?? cfg.comissao;
  const emb = opts.custoEmbalagem ?? 0;
  const m = opts.margemDesejada;
  const room = opts.room ?? 0.03;

  const denom = 1 - imposto - comissao - m;
  const solve = (frete: number) =>
    denom > 0 ? (opts.custoUnit + frete + emb) / denom : Infinity;

  const precoSemFrete = solve(0);
  // does the freight-charged solution stay within the freight band?
  const precoComFreteBruto = solve(cfg.freteUnit);
  const precoSugerido =
    precoComFreteBruto <= cfg.freteGratisAcima ? precoComFreteBruto : precoSemFrete;

  const impactoFrete = precoSugerido - precoSemFrete;

  return {
    precoSugerido,
    precoSemFrete,
    impactoFrete,
    faixaMin: precoSugerido * (1 - room),
    faixaMax: precoSugerido * (1 + room),
  };
}

/** Capital needed to stock `nCaixas` boxes of a product (idea #16). */
export function capitalParaEstoque(
  custoUnit: number,
  qtdCaixa: number,
  nCaixas = 1,
): number {
  return custoUnit * qtdCaixa * nCaixas;
}

// ─── Scenario simulation (idea #11) ──────────────────────────────────────────
// "What-if" projection: vary price / cost / monthly volume and read out the whole
// monthly P&L. Never touches stored products — the page feeds it slider values.

export type CenarioInput = {
  precoVenda: number;
  custoUnit: number;
  vendasMes: number;
  qtdCaixa: number;
  imposto: number;
  comissao: number;
  custoEmbalagem?: number;
};

export type CenarioResultado = {
  // por unidade
  margem: number;
  statusCor: StatusCor;
  valorLiquido: number;
  freteUnit: number;
  lucroUnit: number;
  lucroCaixa: number;
  // mensal (por unidade × vendasMes)
  faturamentoMes: number;
  custoMes: number;
  impostoMes: number;
  comissaoMes: number;
  freteMes: number;
  embalagemMes: number;
  lucroMes: number;
  // capital
  capitalCaixa: number;
  paybackMeses: number | null;
};

/**
 * Project a scenario's full monthly result. Reuses `calcularMetricas` for the per-unit
 * figures, then scales the deductions by volume. By construction the monthly numbers
 * reconcile: faturamento − custo − imposto − comissão − frete − embalagem = lucroMes.
 */
export function simularCenario(c: CenarioInput, cfg: Configuracoes = CONFIG_PADRAO): CenarioResultado {
  const m = calcularMetricas(
    {
      id: "sim",
      nome: "",
      precoVenda: c.precoVenda,
      vendasMes: c.vendasMes,
      custoUnit: c.custoUnit,
      qtdCaixa: c.qtdCaixa,
      imposto: c.imposto,
      comissao: c.comissao,
      custoEmbalagem: c.custoEmbalagem,
      aprovadoManual: null,
    },
    cfg,
  );
  const v = c.vendasMes;
  return {
    margem: m.margem,
    statusCor: m.statusCor,
    valorLiquido: m.valorLiquido,
    freteUnit: m.freteUnit,
    lucroUnit: m.lucroUnit,
    lucroCaixa: m.lucroCaixa,
    faturamentoMes: c.precoVenda * v,
    custoMes: c.custoUnit * v,
    impostoMes: c.precoVenda * c.imposto * v,
    comissaoMes: c.precoVenda * c.comissao * v,
    freteMes: m.freteUnit * v,
    embalagemMes: (c.custoEmbalagem ?? 0) * v,
    lucroMes: m.lucroMensal,
    capitalCaixa: m.capitalEstoque,
    paybackMeses: m.paybackMeses,
  };
}

/** Aggregate totals across a portfolio for the Painel Principal (idea #17). */
export function totaisPortfolio(produtos: Produto[], cfg: Configuracoes = CONFIG_PADRAO) {
  let receitaMensal = 0;
  let lucroMensal = 0;
  let custoMensal = 0;
  let impostoMensal = 0;
  let capitalEstoque = 0;
  const cores = { vermelho: 0, amarelo: 0, verde: 0 };

  for (const p of produtos) {
    const m = calcularMetricas(p, cfg);
    receitaMensal += p.precoVenda * p.vendasMes;
    lucroMensal += m.lucroMensal;
    custoMensal += p.custoUnit * p.vendasMes;
    impostoMensal += p.precoVenda * p.imposto * p.vendasMes;
    capitalEstoque += m.capitalEstoque;
    cores[m.statusCor] += 1;
  }

  const margemMedia = receitaMensal > 0 ? lucroMensal / receitaMensal : 0;
  return {
    receitaMensal,
    lucroMensal,
    custoMensal,
    impostoMensal,
    capitalEstoque,
    margemMedia,
    cores,
    totalProdutos: produtos.length,
  };
}

// ─── Sales-ledger aggregations (PLAN.md §9 Phase 2 #7) ───────────────────────
// Pure rollups over the Vendas ledger. Cancelled sales are excluded — they are
// not realized revenue. Callers pass the raw ledger; these decide what counts.

/** Sales realized as revenue (everything except cancelled). */
const vendasRealizadas = (vendas: Venda[]) => vendas.filter((v) => v.status !== "cancelado");

type Bucket = { pedidos: number; unidades: number; valor: number };
const novoBucket = (): Bucket => ({ pedidos: 0, unidades: 0, valor: 0 });
const acumular = (b: Bucket, v: Venda) => {
  b.pedidos += 1;
  b.unidades += v.quantidade;
  b.valor += v.valorTotal;
};

export type AggPais = Bucket & { code: string; share: number };

/** Sales grouped by country, richest first, with each country's share of total revenue. */
export function vendasPorPais(vendas: Venda[]): AggPais[] {
  const map = new Map<string, Bucket>();
  for (const v of vendasRealizadas(vendas)) {
    const code = v.pais ?? "—";
    const b = map.get(code) ?? novoBucket();
    acumular(b, v);
    map.set(code, b);
  }
  const total = [...map.values()].reduce((s, b) => s + b.valor, 0);
  return [...map.entries()]
    .map(([code, b]) => ({ code, ...b, share: total > 0 ? b.valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export type AggPeriodo = Bucket & { chave: string };

/** Local-date key (avoids UTC day-shifts from toISOString on naive datetimes). */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function agruparPorChave(vendas: Venda[], chaveDe: (d: Date) => string): AggPeriodo[] {
  const map = new Map<string, Bucket>();
  for (const v of vendasRealizadas(vendas)) {
    const k = chaveDe(new Date(v.data));
    const b = map.get(k) ?? novoBucket();
    acumular(b, v);
    map.set(k, b);
  }
  return [...map.entries()]
    .map(([chave, b]) => ({ chave, ...b }))
    .sort((a, b) => a.chave.localeCompare(b.chave));
}

/** Sales grouped by day (`YYYY-MM-DD`), month (`YYYY-MM`) and year (`YYYY`), chronologically. */
export const vendasPorDia = (vendas: Venda[]) => agruparPorChave(vendas, ymd);
export const vendasPorMes = (vendas: Venda[]) => agruparPorChave(vendas, (d) => ymd(d).slice(0, 7));
export const vendasPorAno = (vendas: Venda[]) =>
  agruparPorChave(vendas, (d) => String(d.getFullYear()));

/** Monthly revenue time-series, optionally filtered to a single channel (e.g. "Amazon"). */
export function serieMensal(vendas: Venda[], canal?: string): AggPeriodo[] {
  return vendasPorMes(canal ? vendas.filter((v) => v.canal === canal) : vendas);
}

/** Fill gaps in a `YYYY-MM` series with zero months so a chart's x-axis stays continuous. */
export function preencherMeses(serie: AggPeriodo[]): AggPeriodo[] {
  if (serie.length === 0) return [];
  const idx = (k: string) => {
    const [y, m] = k.split("-").map(Number);
    return y * 12 + (m - 1);
  };
  const key = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  const porChave = new Map(serie.map((s) => [s.chave, s]));
  const out: AggPeriodo[] = [];
  for (let i = idx(serie[0].chave); i <= idx(serie[serie.length - 1].chave); i++) {
    const k = key(i);
    out.push(porChave.get(k) ?? { chave: k, pedidos: 0, unidades: 0, valor: 0 });
  }
  return out;
}

export type ResumoPeriodo = {
  atual: AggPeriodo | null;
  anterior: AggPeriodo | null;
  /** (atual − anterior) / anterior; null when there is no comparable previous period. */
  variacao: number | null;
};

/** Latest period vs. the one before it (for the Daily/Monthly/Yearly cards). */
export function resumoPeriodo(buckets: AggPeriodo[]): ResumoPeriodo {
  const atual = buckets[buckets.length - 1] ?? null;
  const anterior = buckets[buckets.length - 2] ?? null;
  const variacao =
    atual && anterior && anterior.valor !== 0 ? (atual.valor - anterior.valor) / anterior.valor : null;
  return { atual, anterior, variacao };
}

export type ResultadoVendas = {
  bruto: number; // faturamento bruto (Σ valorTotal)
  custo: number; // custo do fornecedor
  imposto: number; // imposto sobre a receita
  comissao: number; // comissão do canal
  frete: number; // frete absorvido
  lucro: number; // líquido — o que sobra no bolso
};

/**
 * Realized financials for a set of sales, joined to their catalog products (cancelled excluded).
 * Per sale: imposto & comissão are % of revenue (the product's rates), custo = custoUnit × qtd,
 * frete from the sale (or the product's freight rule), and lucro = bruto − all deductions.
 * Sales with no matching product contribute gross only (no cost breakdown available).
 */
export function resultadoVendas(
  vendas: Venda[],
  produtos: Produto[],
  cfg: Configuracoes = CONFIG_PADRAO,
): ResultadoVendas {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const r: ResultadoVendas = { bruto: 0, custo: 0, imposto: 0, comissao: 0, frete: 0, lucro: 0 };
  for (const v of vendas) {
    if (v.status === "cancelado") continue;
    r.bruto += v.valorTotal;
    const p = v.produtoId ? porId.get(v.produtoId) : undefined;
    if (!p) continue; // avulsa / sem produto → conta só no bruto
    const imposto = v.valorTotal * (p.imposto ?? cfg.imposto);
    const comissao = v.valorTotal * (p.comissao ?? cfg.comissao);
    const custo = p.custoUnit * v.quantidade;
    const frete = v.frete ?? freteUnitario(p.precoVenda, cfg.freteUnit, cfg.freteGratisAcima) * v.quantidade;
    const embalagem = (p.custoEmbalagem ?? 0) * v.quantidade;
    r.imposto += imposto;
    r.comissao += comissao;
    r.custo += custo;
    r.frete += frete;
    r.lucro += v.valorTotal - imposto - comissao - custo - frete - embalagem;
  }
  return r;
}

// ─── Per-product performance & finance series (ideas #6 Gráficos / #3 bom-médio-ruim) ───
// Realized figures straight from the ledger (not the projected vendasMes), so the Gráficos
// page shows what actually happened. Both helpers delegate the money math to
// `resultadoVendas` so there is exactly one definition of "lucro" in the app.

export type DesempenhoProduto = {
  produtoId: string;
  nome: string;
  unidades: number;
  bruto: number;
  custo: number;
  lucro: number;
  margem: number; // lucro ÷ bruto — the realized margin for this product
  statusCor: StatusCor; // health band (idea #3: bom / médio / ruim)
  share: number; // this product's share of total gross ("representatividade")
};

/**
 * Realized performance per catalog product, best-selling first. Cancelled sales are excluded
 * and avulsa sales (no `produtoId`) are skipped — they can't be attributed to a product.
 */
export function desempenhoProdutos(
  vendas: Venda[],
  produtos: Produto[],
  cfg: Configuracoes = CONFIG_PADRAO,
): DesempenhoProduto[] {
  const porProduto = new Map<string, Venda[]>();
  for (const v of vendas) {
    if (v.status === "cancelado" || !v.produtoId) continue;
    const g = porProduto.get(v.produtoId);
    if (g) g.push(v);
    else porProduto.set(v.produtoId, [v]);
  }

  const linhas = [...porProduto.entries()].map(([id, doProduto]) => {
    const r = resultadoVendas(doProduto, produtos, cfg);
    const margem = r.bruto > 0 ? r.lucro / r.bruto : 0;
    return {
      produtoId: id,
      nome: produtos.find((p) => p.id === id)?.nome ?? doProduto[0].produtoNome,
      unidades: doProduto.reduce((s, v) => s + v.quantidade, 0),
      bruto: r.bruto,
      custo: r.custo,
      lucro: r.lucro,
      margem,
      statusCor: statusCor(margem, cfg),
      share: 0,
    };
  });

  const total = linhas.reduce((s, l) => s + l.bruto, 0);
  return linhas
    .map((l) => ({ ...l, share: total > 0 ? l.bruto / total : 0 }))
    .sort((a, b) => b.bruto - a.bruto);
}

/** Products split into the three health bands (idea #3), each list keeping its incoming order. */
export function faixasDesempenho(linhas: DesempenhoProduto[]): Record<StatusCor, DesempenhoProduto[]> {
  return {
    verde: linhas.filter((l) => l.statusCor === "verde"),
    amarelo: linhas.filter((l) => l.statusCor === "amarelo"),
    vermelho: linhas.filter((l) => l.statusCor === "vermelho"),
  };
}

export type AggCanal = Bucket & { canal: string; share: number };

/** Revenue grouped by sales channel, biggest first (cancelled excluded). */
export function vendasPorCanal(vendas: Venda[]): AggCanal[] {
  const map = new Map<string, Bucket>();
  for (const v of vendasRealizadas(vendas)) {
    const canal = v.canal ?? "Sem canal";
    const b = map.get(canal) ?? novoBucket();
    acumular(b, v);
    map.set(canal, b);
  }
  const total = [...map.values()].reduce((s, b) => s + b.valor, 0);
  return [...map.entries()]
    .map(([canal, b]) => ({ canal, ...b, share: total > 0 ? b.valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export type SerieFinanceira = { chave: string; bruto: number; custo: number; lucro: number };

/** Monthly gross / cost / profit series for the multi-line finance chart (chronological). */
export function serieFinanceiraMensal(
  vendas: Venda[],
  produtos: Produto[],
  cfg: Configuracoes = CONFIG_PADRAO,
): SerieFinanceira[] {
  return vendasPorMes(vendas).map((m) => {
    const doMes = vendas.filter((v) => ymd(new Date(v.data)).slice(0, 7) === m.chave);
    const r = resultadoVendas(doMes, produtos, cfg);
    return { chave: m.chave, bruto: r.bruto, custo: r.custo, lucro: r.lucro };
  });
}

// ─── Purchases & derived stock (idea #3) ─────────────────────────────────────
// Stock is computed, never stored: the product carries only an opening balance and every
// movement lives in a ledger. That keeps it self-healing (no double-counting when a status
// is toggled) and consistent with how the rest of the app derives its numbers.

/** What a purchase actually cost: goods + freight + any extras. */
export const custoTotalCompra = (c: Compra) =>
  c.quantidade * c.custoUnit + (c.frete ?? 0) + (c.outrosCustos ?? 0);

/** Purchases that landed in stock. Cancelled and not-yet-arrived ones don't count. */
const comprasRecebidas = (compras: Compra[]) => compras.filter((c) => c.status === "recebida");

export type ResumoCompras = {
  pedidos: number; // purchase records (excluding cancelled)
  unidades: number; // units bought (excluding cancelled)
  investido: number; // R$ committed, including freight/extras
  recebidas: number; // records already in stock
  pendentes: number; // ordered or in transit — money already committed, goods not arrived
  aCaminho: number; // units still on the way
};

/** Totals across a set of purchases (cancelled ones are excluded from every figure). */
export function resumoCompras(compras: Compra[]): ResumoCompras {
  const r: ResumoCompras = { pedidos: 0, unidades: 0, investido: 0, recebidas: 0, pendentes: 0, aCaminho: 0 };
  for (const c of compras) {
    if (c.status === "cancelada") continue;
    r.pedidos += 1;
    r.unidades += c.quantidade;
    r.investido += custoTotalCompra(c);
    if (c.status === "recebida") r.recebidas += 1;
    else {
      r.pendentes += 1;
      r.aCaminho += c.quantidade;
    }
  }
  return r;
}

export type AggFornecedor = { fornecedor: string; pedidos: number; unidades: number; investido: number; share: number };

/** Purchases grouped by supplier, biggest spend first. */
export function comprasPorFornecedor(compras: Compra[]): AggFornecedor[] {
  const map = new Map<string, { pedidos: number; unidades: number; investido: number }>();
  for (const c of compras) {
    if (c.status === "cancelada") continue;
    const k = c.fornecedor?.trim() || "Sem fornecedor";
    const g = map.get(k) ?? { pedidos: 0, unidades: 0, investido: 0 };
    g.pedidos += 1;
    g.unidades += c.quantidade;
    g.investido += custoTotalCompra(c);
    map.set(k, g);
  }
  const total = [...map.values()].reduce((s, g) => s + g.investido, 0);
  return [...map.entries()]
    .map(([fornecedor, g]) => ({ fornecedor, ...g, share: total > 0 ? g.investido / total : 0 }))
    .sort((a, b) => b.investido - a.investido);
}

export type EstoqueProduto = {
  produtoId: string;
  inicial: number;
  comprado: number; // units from received purchases
  vendido: number; // units sold (cancelled sales excluded)
  devolvido: number; // units that came back and were restocked
  atual: number; // inicial + comprado − vendido + devolvido
};

/**
 * Current stock per product, derived from the opening balance and the three ledgers.
 * Returns a Map keyed by produtoId so callers can look a product up directly.
 */
export function estoqueProdutos(
  produtos: Produto[],
  compras: Compra[],
  vendas: Venda[],
  devolucoes: Devolucao[],
): Map<string, EstoqueProduto> {
  const mapa = new Map<string, EstoqueProduto>(
    produtos.map((p) => [
      p.id,
      { produtoId: p.id, inicial: p.estoqueInicial ?? 0, comprado: 0, vendido: 0, devolvido: 0, atual: 0 },
    ]),
  );

  for (const c of comprasRecebidas(compras)) {
    const e = c.produtoId && mapa.get(c.produtoId);
    if (e) e.comprado += c.quantidade;
  }
  for (const v of vendasRealizadas(vendas)) {
    const e = v.produtoId && mapa.get(v.produtoId);
    if (e) e.vendido += v.quantidade;
  }
  for (const d of devolucoes) {
    if (!d.reestocado) continue;
    const e = d.produtoId && mapa.get(d.produtoId);
    if (e) e.devolvido += d.quantidade;
  }

  for (const e of mapa.values()) e.atual = e.inicial + e.comprado - e.vendido + e.devolvido;
  return mapa;
}

// ─── Returns / refunds (idea #1) ─────────────────────────────────────────────
// Pure rollups over the Devoluções ledger. Refunds are money going back out, so they
// reduce realized profit (see the Painel's "líquido após devoluções" line).

export type ResumoDevolucoes = {
  registros: number; // number of return records
  unidades: number; // total units returned
  reembolso: number; // total R$ refunded
  reestocadas: number; // units that went back into sellable stock
};

/** Totals across a set of returns (units, refund value, restocked units). */
export function resumoDevolucoes(devolucoes: Devolucao[]): ResumoDevolucoes {
  const r: ResumoDevolucoes = { registros: 0, unidades: 0, reembolso: 0, reestocadas: 0 };
  for (const d of devolucoes) {
    r.registros += 1;
    r.unidades += d.quantidade;
    r.reembolso += d.valorReembolsado;
    if (d.reestocado) r.reestocadas += d.quantidade;
  }
  return r;
}

export type AggMotivo = {
  motivo: MotivoDevolucao;
  registros: number;
  unidades: number;
  reembolso: number;
  share: number; // fraction of total refund value
};

/** Returns grouped by reason, costliest refund first, with each reason's share of total refund. */
export function devolucoesPorMotivo(devolucoes: Devolucao[]): AggMotivo[] {
  const map = new Map<MotivoDevolucao, { registros: number; unidades: number; reembolso: number }>();
  for (const d of devolucoes) {
    const g = map.get(d.motivo) ?? { registros: 0, unidades: 0, reembolso: 0 };
    g.registros += 1;
    g.unidades += d.quantidade;
    g.reembolso += d.valorReembolsado;
    map.set(d.motivo, g);
  }
  const total = [...map.values()].reduce((s, g) => s + g.reembolso, 0);
  return [...map.entries()]
    .map(([motivo, g]) => ({ motivo, ...g, share: total > 0 ? g.reembolso / total : 0 }))
    .sort((a, b) => b.reembolso - a.reembolso);
}

/**
 * Return rate = units returned ÷ units sold (realized). Cancelled sales are excluded from the
 * denominator since they were never really sold. Returns 0 when there are no realized units.
 */
export function taxaDevolucao(devolucoes: Devolucao[], vendas: Venda[]): number {
  const unidadesDevolvidas = devolucoes.reduce((s, d) => s + d.quantidade, 0);
  const unidadesVendidas = vendasRealizadas(vendas).reduce((s, v) => s + v.quantidade, 0);
  return unidadesVendidas > 0 ? unidadesDevolvidas / unidadesVendidas : 0;
}

// ─── Duplicate detection (ideas #9/#10) ──────────────────────────────────────

/** Normalize a name for comparison: trimmed, lowercased, inner whitespace collapsed. */
export const normalizaNome = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Existing items whose name matches `nome` (case/space-insensitive). */
export function mesmoNome<T extends { nome: string }>(itens: T[], nome: string): T[] {
  const k = normalizaNome(nome);
  return itens.filter((it) => normalizaNome(it.nome) === k);
}

/** Groups of items sharing a normalized name (only groups with >1). Insertion order is kept
 *  within each group, so the LAST element is the most recently added (the "newest"). */
export function gruposDuplicados<T extends { nome: string }>(itens: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const it of itens) {
    const k = normalizaNome(it.nome);
    const g = map.get(k);
    if (g) g.push(it);
    else map.set(k, [it]);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

// ─── Operating costs (idea #13) ──────────────────────────────────────────────

/** Total recurring monthly operating cost. */
export function totalOperacional(custos: CustoOperacional[]): number {
  return custos.reduce((s, c) => s + c.valorMensal, 0);
}

export type AggCategoria = { categoria: CategoriaCusto; valor: number; share: number };

/** Operating costs grouped by category, biggest first, with each category's share of the total. */
export function custosPorCategoria(custos: CustoOperacional[]): AggCategoria[] {
  const map = new Map<CategoriaCusto, number>();
  for (const c of custos) map.set(c.categoria, (map.get(c.categoria) ?? 0) + c.valorMensal);
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([categoria, valor]) => ({ categoria, valor, share: total > 0 ? valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor);
}
