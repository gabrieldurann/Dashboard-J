// Calc engine — single source of truth for all profitability math.
// Faithful to TabPesquisa-PADRÃO.xlsx, with the sheet's inconsistencies cleaned (see PLAN.md §3.3).
// Pure functions only — fully unit-tested in engine.test.ts.

import {
  COMISSAO_PADRAO,
  FRETE_GRATIS_ACIMA,
  FRETE_UNIT,
  IMPOSTO_PADRAO,
  MARGEM_APROVACAO,
  MARGEM_BANDAS,
  type StatusCor,
} from "./constants";
import type { MetricasProduto, Produto, Venda } from "./types";

/** Freight per unit: free above the threshold (sheet O1), else the flat fee (sheet L2:N2). */
export function freteUnitario(
  precoVenda: number,
  freteUnit = FRETE_UNIT,
  gratisAcima = FRETE_GRATIS_ACIMA,
): number {
  return precoVenda > gratisAcima ? 0 : freteUnit;
}

/** Margin health band (idea #2): red < 12% · yellow 12–15% · green > 15%. */
export function statusCor(margem: number): StatusCor {
  if (margem < MARGEM_BANDAS.vermelho) return "vermelho";
  if (margem <= MARGEM_BANDAS.amarelo) return "amarelo";
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
export function calcularMetricas(p: Produto): MetricasProduto {
  const imposto = p.imposto ?? IMPOSTO_PADRAO;
  const comissao = p.comissao ?? COMISSAO_PADRAO;
  const embalagem = p.custoEmbalagem ?? 0;
  const preco = p.precoVenda || 0;

  const custoCaixa = p.custoUnit * p.qtdCaixa;
  const totalTaxasComissao = preco * (imposto + comissao);
  const valorLiquido = preco - totalTaxasComissao; // = preco·(1 − imposto − comissão)
  const freteUnit = freteUnitario(preco);

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

  const aprovado = p.aprovadoManual ?? margem >= MARGEM_APROVACAO;

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
    statusCor: statusCor(margem),
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
export function precoParaMargem(opts: {
  custoUnit: number;
  margemDesejada: number;
  imposto?: number;
  comissao?: number;
  custoEmbalagem?: number;
  room?: number; // ± fraction, default 0.03
}): PrecoAlvo {
  const imposto = opts.imposto ?? IMPOSTO_PADRAO;
  const comissao = opts.comissao ?? COMISSAO_PADRAO;
  const emb = opts.custoEmbalagem ?? 0;
  const m = opts.margemDesejada;
  const room = opts.room ?? 0.03;

  const denom = 1 - imposto - comissao - m;
  const solve = (frete: number) =>
    denom > 0 ? (opts.custoUnit + frete + emb) / denom : Infinity;

  const precoSemFrete = solve(0);
  // does the freight-charged solution stay within the freight band (<= 79)?
  const precoComFreteBruto = solve(FRETE_UNIT);
  const precoSugerido =
    precoComFreteBruto <= FRETE_GRATIS_ACIMA ? precoComFreteBruto : precoSemFrete;

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

/** Aggregate totals across a portfolio for the Painel Principal (idea #17). */
export function totaisPortfolio(produtos: Produto[]) {
  let receitaMensal = 0;
  let lucroMensal = 0;
  let custoMensal = 0;
  let impostoMensal = 0;
  let capitalEstoque = 0;
  const cores = { vermelho: 0, amarelo: 0, verde: 0 };

  for (const p of produtos) {
    const m = calcularMetricas(p);
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
