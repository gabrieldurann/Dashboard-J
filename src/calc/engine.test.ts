import { describe, expect, it } from "vitest";
import {
  calcularMetricas,
  capitalParaEstoque,
  custosPorCategoria,
  desempenhoProdutos,
  devolucoesPorMotivo,
  faixasDesempenho,
  freteUnitario,
  serieFinanceiraMensal,
  vendasPorCanal,
  gruposDuplicados,
  mesmoNome,
  normalizaNome,
  resumoDevolucoes,
  taxaDevolucao,
  totalOperacional,
  preencherMeses,
  precoParaMargem,
  resultadoVendas,
  resumoPeriodo,
  serieMensal,
  simularCenario,
  statusCor,
  totaisPortfolio,
  vendasPorAno,
  vendasPorDia,
  vendasPorMes,
  vendasPorPais,
} from "./engine";
import { CONFIG_PADRAO } from "./constants";
import type { CustoOperacional, Devolucao, Produto, Venda } from "./types";

const base: Produto = {
  id: "1",
  nome: "Teste",
  precoVenda: 50,
  vendasMes: 30,
  custoUnit: 20,
  qtdCaixa: 100,
  imposto: 0.04,
  comissao: 0.15,
};

describe("freteUnitario", () => {
  it("charges R$5.65 at or below R$79 (sheet rule)", () => {
    expect(freteUnitario(50)).toBe(5.65);
    expect(freteUnitario(79)).toBe(5.65);
  });
  it("is free above R$79 (SOMENTE PRODUTOS ACIMA R$79)", () => {
    expect(freteUnitario(79.01)).toBe(0);
    expect(freteUnitario(120)).toBe(0);
  });
});

describe("statusCor (idea #2 bands)", () => {
  it("red below 11%", () => expect(statusCor(0.10)).toBe("vermelho"));
  it("yellow in 11–15%", () => {
    expect(statusCor(0.11)).toBe("amarelo");
    expect(statusCor(0.15)).toBe("amarelo");
  });
  it("green above 15%", () => expect(statusCor(0.1501)).toBe("verde"));
});

describe("calcularMetricas (faithful to sheet, cleaned)", () => {
  const m = calcularMetricas(base);
  it("valorLiquido = preço·(1 − imposto − comissão)  [sheet K]", () => {
    expect(m.valorLiquido).toBeCloseTo(40.5, 5); // 50·0.81
  });
  it("lucroUnit = valorLiquido − custo − frete  [sheet P, unified]", () => {
    expect(m.lucroUnit).toBeCloseTo(14.85, 5); // 40.5 − 20 − 5.65
  });
  it("margem = lucroUnit / preço  [sheet Q =P/D]", () => {
    expect(m.margem).toBeCloseTo(0.297, 4);
    expect(m.statusCor).toBe("verde");
  });
  it("lucroMensal = lucroUnit · vendasMes  [sheet R]", () => {
    expect(m.lucroMensal).toBeCloseTo(445.5, 4);
  });
  it("lucroCaixa = lucroUnit · qtdCaixa  [FIX vs sheet R·H]", () => {
    expect(m.lucroCaixa).toBeCloseTo(1485, 4);
  });
  it("sem-frete scenario ignores freight  [sheet V/W]", () => {
    expect(m.lucroUnitSemFrete).toBeCloseTo(20.5, 5); // 40.5 − 20
    expect(m.margemSemFrete).toBeCloseTo(0.41, 5);
  });
  it("capital to stock one box = custo · qtdCaixa (idea #16)", () => {
    expect(m.capitalEstoque).toBe(2000);
  });
  it("payback = capital / lucroMensal", () => {
    expect(m.paybackMeses).toBeCloseTo(2000 / 445.5, 5);
  });
});

describe("simularCenario (what-if projection, idea #11)", () => {
  const c = simularCenario({
    precoVenda: 50,
    custoUnit: 20,
    vendasMes: 30,
    qtdCaixa: 100,
    imposto: 0.04,
    comissao: 0.15,
  });
  it("matches calcularMetricas on the per-unit figures", () => {
    expect(c.margem).toBeCloseTo(0.297, 4);
    expect(c.lucroUnit).toBeCloseTo(14.85, 5);
    expect(c.statusCor).toBe("verde");
  });
  it("scales the monthly breakdown by volume", () => {
    expect(c.faturamentoMes).toBe(1500); // 50 × 30
    expect(c.custoMes).toBe(600); // 20 × 30
    expect(c.impostoMes).toBeCloseTo(60, 6); // 50 × 0.04 × 30
    expect(c.comissaoMes).toBeCloseTo(225, 6); // 50 × 0.15 × 30
    expect(c.lucroMes).toBeCloseTo(445.5, 4);
  });
  it("reconciles: faturamento − todas deduções = lucroMes", () => {
    const soma = c.faturamentoMes - c.custoMes - c.impostoMes - c.comissaoMes - c.freteMes - c.embalagemMes;
    expect(soma).toBeCloseTo(c.lucroMes, 6);
  });
  it("zero volume yields zero monthly figures and null payback", () => {
    const z = simularCenario({ precoVenda: 50, custoUnit: 20, vendasMes: 0, qtdCaixa: 100, imposto: 0.04, comissao: 0.15 });
    expect(z.lucroMes).toBe(0);
    expect(z.faturamentoMes).toBe(0);
    expect(z.paybackMeses).toBeNull();
  });
});

describe("precoParaMargem (reverse solver, ideas #13/#18)", () => {
  const r = precoParaMargem({ custoUnit: 20, margemDesejada: 0.15 });
  it("suggested price actually yields the target margin", () => {
    const check = calcularMetricas({ ...base, precoVenda: r.precoSugerido, custoUnit: 20 });
    expect(check.margem).toBeCloseTo(0.15, 6);
  });
  it("reports the freight impact as a positive delta (the '+2,38' mechanic)", () => {
    expect(r.impactoFrete).toBeGreaterThan(0);
    expect(r.precoSugerido).toBeGreaterThan(r.precoSemFrete);
  });
  it("gives a ± room band around the suggestion", () => {
    expect(r.faixaMin).toBeLessThan(r.precoSugerido);
    expect(r.faixaMax).toBeGreaterThan(r.precoSugerido);
  });
});

describe("capitalParaEstoque", () => {
  it("scales with number of boxes (idea #16)", () => {
    expect(capitalParaEstoque(10, 100)).toBe(1000); // box of 100 @ R$10
    expect(capitalParaEstoque(10, 100, 3)).toBe(3000);
  });
});

describe("totaisPortfolio (Painel Principal, idea #17)", () => {
  const totals = totaisPortfolio([base, { ...base, id: "2", precoVenda: 100, custoUnit: 40 }]);
  it("aggregates revenue, profit and counts colors", () => {
    expect(totals.totalProdutos).toBe(2);
    expect(totals.receitaMensal).toBeCloseTo(50 * 30 + 100 * 30, 4);
    expect(totals.cores.verde).toBeGreaterThanOrEqual(1);
    expect(totals.margemMedia).toBeGreaterThan(0);
  });
});

const venda = (over: Partial<Venda>): Venda => ({
  id: crypto.randomUUID(),
  data: "2026-06-01T10:00",
  produtoNome: "Produto",
  quantidade: 1,
  valorUnitario: 100,
  valorTotal: 100,
  status: "entregue",
  ...over,
});

describe("vendasPorPais (Phase 2 aggregation)", () => {
  const vendas: Venda[] = [
    venda({ pais: "BR", valorTotal: 250, quantidade: 2 }),
    venda({ pais: "US", valorTotal: 200, quantidade: 2 }),
    venda({ pais: "US", valorTotal: 100, quantidade: 1 }),
    venda({ pais: "US", valorTotal: 999, status: "cancelado" }), // excluded
  ];
  const agg = vendasPorPais(vendas);
  it("groups by country, richest first", () => {
    expect(agg.map((a) => a.code)).toEqual(["US", "BR"]); // US 300 > BR 250
  });
  it("sums orders, units and revenue (excluding cancelled)", () => {
    const us = agg.find((a) => a.code === "US")!;
    expect(us.pedidos).toBe(2);
    expect(us.unidades).toBe(3);
    expect(us.valor).toBe(300);
  });
  it("computes each country's share of total revenue", () => {
    const total = agg.reduce((s, a) => s + a.share, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});

describe("time-bucket aggregations (Phase 2)", () => {
  const vendas: Venda[] = [
    venda({ data: "2026-05-10T09:00", valorTotal: 100 }),
    venda({ data: "2026-05-10T18:00", valorTotal: 50 }),
    venda({ data: "2026-06-02T12:00", valorTotal: 200 }),
    venda({ data: "2026-06-02T12:00", valorTotal: 999, status: "cancelado" }), // excluded
  ];
  it("groups by day with local-date keys", () => {
    const dias = vendasPorDia(vendas);
    expect(dias.map((d) => d.chave)).toEqual(["2026-05-10", "2026-06-02"]);
    expect(dias[0].valor).toBe(150);
  });
  it("groups by month chronologically", () => {
    expect(vendasPorMes(vendas).map((m) => m.chave)).toEqual(["2026-05", "2026-06"]);
  });
  it("groups by year", () => {
    expect(vendasPorAno(vendas).map((a) => a.chave)).toEqual(["2026"]);
  });
});

describe("serieMensal (channel-filtered time-series)", () => {
  const vendas: Venda[] = [
    venda({ data: "2026-05-01T10:00", canal: "Amazon", valorTotal: 100 }),
    venda({ data: "2026-05-02T10:00", canal: "Shopee", valorTotal: 80 }),
    venda({ data: "2026-06-01T10:00", canal: "Amazon", valorTotal: 200 }),
  ];
  it("filters to one channel before bucketing by month", () => {
    const s = serieMensal(vendas, "Amazon");
    expect(s.map((m) => m.chave)).toEqual(["2026-05", "2026-06"]);
    expect(s.map((m) => m.valor)).toEqual([100, 200]);
  });
});

describe("preencherMeses (continuous x-axis for charts)", () => {
  it("inserts zero-value months across gaps, including a year boundary", () => {
    const serie = serieMensal([
      venda({ data: "2025-12-01T10:00", valorTotal: 100 }),
      venda({ data: "2026-02-01T10:00", valorTotal: 300 }),
    ]);
    const cheia = preencherMeses(serie);
    expect(cheia.map((m) => m.chave)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(cheia[1].valor).toBe(0); // filled gap
  });
  it("returns [] for empty input", () => {
    expect(preencherMeses([])).toEqual([]);
  });
});

describe("resultadoVendas (realized financials, joined to products)", () => {
  const prod: Produto = {
    id: "p1",
    nome: "P",
    precoVenda: 100,
    vendasMes: 10,
    custoUnit: 40,
    qtdCaixa: 10,
    imposto: 0.04,
    comissao: 0.15,
  };
  it("breaks gross into custo / imposto / comissão / lucro", () => {
    const r = resultadoVendas([venda({ produtoId: "p1", quantidade: 2, valorTotal: 200, frete: 0 })], [prod]);
    expect(r.bruto).toBe(200);
    expect(r.custo).toBe(80); // 40 × 2
    expect(r.imposto).toBeCloseTo(8, 6); // 200 × 0.04
    expect(r.comissao).toBeCloseTo(30, 6); // 200 × 0.15
    expect(r.lucro).toBeCloseTo(82, 6); // 200 − 8 − 30 − 80
  });
  it("excludes cancelled and counts gross-only for unmatched products", () => {
    const r = resultadoVendas(
      [
        venda({ produtoId: "p1", quantidade: 1, valorTotal: 100, frete: 0 }),
        venda({ produtoId: "p1", quantidade: 1, valorTotal: 100, status: "cancelado" }),
        venda({ produtoId: "zzz", quantidade: 1, valorTotal: 50 }), // no product
      ],
      [prod],
    );
    expect(r.bruto).toBe(150); // 100 + 50 (cancelled excluded)
    expect(r.custo).toBe(40); // only the matched, non-cancelled sale
  });
});

describe("desempenhoProdutos / faixas / série financeira (Gráficos, ideas #6/#3)", () => {
  // p1 healthy (green), p2 thin margin (red) — so the band split has something in each
  const p1: Produto = { id: "p1", nome: "Verde", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 };
  const p2: Produto = { id: "p2", nome: "Vermelho", precoVenda: 100, vendasMes: 0, custoUnit: 78, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 };
  const prods = [p1, p2];
  const vendas: Venda[] = [
    venda({ produtoId: "p1", quantidade: 2, valorTotal: 200, frete: 0, data: "2026-05-10T10:00" }),
    venda({ produtoId: "p1", quantidade: 1, valorTotal: 100, frete: 0, data: "2026-06-10T10:00" }),
    venda({ produtoId: "p2", quantidade: 1, valorTotal: 100, frete: 0, data: "2026-06-11T10:00" }),
    venda({ produtoId: "p1", quantidade: 9, valorTotal: 900, status: "cancelado" }), // excluded
    venda({ produtoId: undefined, quantidade: 1, valorTotal: 50 }), // avulsa — not attributable
  ];

  it("rolls up realized figures per product, best-selling first", () => {
    const d = desempenhoProdutos(vendas, prods);
    expect(d.map((x) => x.produtoId)).toEqual(["p1", "p2"]); // 300 > 100
    const verde = d[0];
    expect(verde.unidades).toBe(3); // cancelled sale excluded
    expect(verde.bruto).toBe(300);
    expect(verde.custo).toBe(120); // 40 × 3
    expect(verde.margem).toBeCloseTo(verde.lucro / verde.bruto, 6);
  });

  it("shares sum to 1 and skip avulsa sales", () => {
    const d = desempenhoProdutos(vendas, prods);
    expect(d.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6);
    expect(d.some((x) => x.nome === "Produto")).toBe(false); // the avulsa row isn't attributed
  });

  it("splits products into bom / médio / ruim bands", () => {
    const f = faixasDesempenho(desempenhoProdutos(vendas, prods));
    expect(f.verde.map((x) => x.produtoId)).toEqual(["p1"]);
    expect(f.vermelho.map((x) => x.produtoId)).toEqual(["p2"]);
    expect(f.amarelo).toEqual([]);
  });

  it("builds a chronological monthly gross/cost/profit series", () => {
    const s = serieFinanceiraMensal(vendas, prods);
    expect(s.map((x) => x.chave)).toEqual(["2026-05", "2026-06"]);
    expect(s[0].bruto).toBe(200);
    // June = 100 (p1) + 100 (p2) + the 50 avulsa. Unlike the per-product breakdown, the finance
    // series counts avulsa revenue in the gross (it's real money) — it just has no cost split.
    expect(s[1].bruto).toBe(250);
    s.forEach((m) => expect(m.lucro).toBeLessThan(m.bruto));
  });

  it("returns nothing when there are no attributable sales", () => {
    expect(desempenhoProdutos([], prods)).toEqual([]);
    expect(serieFinanceiraMensal([], prods)).toEqual([]);
  });

  it("vendasPorCanal groups by channel, biggest first, shares summing to 1", () => {
    const agg = vendasPorCanal([
      venda({ canal: "Amazon", valorTotal: 300 }),
      venda({ canal: "Shopee", valorTotal: 100 }),
      venda({ canal: "Amazon", valorTotal: 200 }),
      venda({ valorTotal: 50 }), // no channel → "Sem canal"
      venda({ canal: "Amazon", valorTotal: 999, status: "cancelado" }), // excluded
    ]);
    expect(agg.map((a) => a.canal)).toEqual(["Amazon", "Shopee", "Sem canal"]);
    expect(agg[0].valor).toBe(500);
    expect(agg.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 6);
  });
});

describe("configurable rates (Configurações, idea #9)", () => {
  it("statusCor follows the configured bands", () => {
    const largo = { ...CONFIG_PADRAO, margemVermelho: 0.3, margemAmarelo: 0.5 };
    expect(statusCor(0.2, largo)).toBe("vermelho"); // green under the defaults
    expect(statusCor(0.4, largo)).toBe("amarelo");
    expect(statusCor(0.6, largo)).toBe("verde");
  });

  it("a different tax rate changes profit and margin", () => {
    const semImposto = { ...CONFIG_PADRAO, imposto: 0 };
    const p: Produto = { ...base, imposto: undefined as unknown as number };
    const padrao = calcularMetricas(p);
    const isento = calcularMetricas(p, semImposto);
    expect(isento.lucroUnit).toBeGreaterThan(padrao.lucroUnit);
    expect(isento.lucroUnit - padrao.lucroUnit).toBeCloseTo(50 * 0.04, 6); // the 4% back
  });

  it("freight rules are honoured (price threshold and unit cost)", () => {
    const caro = { ...CONFIG_PADRAO, freteUnit: 10, freteGratisAcima: 40 };
    expect(calcularMetricas(base, caro).freteUnit).toBe(0); // 50 > 40 → free
    expect(calcularMetricas({ ...base, precoVenda: 30 }, caro).freteUnit).toBe(10);
  });

  it("the approval floor moves the auto verdict", () => {
    const exigente = { ...CONFIG_PADRAO, margemAprovacao: 0.9 };
    expect(calcularMetricas(base).aprovado).toBe(true); // 29.7% clears the default 15%
    expect(calcularMetricas(base, exigente).aprovado).toBe(false);
  });

  it("rates flow through the ledger rollups too", () => {
    const prod: Produto = { id: "p1", nome: "P", precoVenda: 100, vendasMes: 1, custoUnit: 40, qtdCaixa: 1, imposto: 0.04, comissao: 0.15 };
    const v = [venda({ produtoId: "p1", quantidade: 1, valorTotal: 100, frete: 0 })];
    const bandaLarga = { ...CONFIG_PADRAO, margemVermelho: 0.5, margemAmarelo: 0.8 };
    expect(desempenhoProdutos(v, [prod])[0].statusCor).toBe("verde");
    expect(desempenhoProdutos(v, [prod], bandaLarga)[0].statusCor).toBe("vermelho");
  });

  it("omitting the config keeps the sheet defaults (no behaviour change)", () => {
    expect(calcularMetricas(base)).toEqual(calcularMetricas(base, CONFIG_PADRAO));
    expect(statusCor(0.12)).toBe(statusCor(0.12, CONFIG_PADRAO));
  });
});

describe("duplicate detection (ideas #9/#10)", () => {
  it("normalizes names (trim, lowercase, collapse spaces)", () => {
    expect(normalizaNome("  Mini   Projetor ")).toBe("mini projetor");
  });
  it("finds existing items with the same name, case/space-insensitive", () => {
    const itens = [{ nome: "Mini Projetor" }, { nome: "Garrafa" }];
    expect(mesmoNome(itens, "  mini   projetor")).toHaveLength(1);
    expect(mesmoNome(itens, "Outro")).toHaveLength(0);
  });
  it("groups duplicates with the newest last, ignoring uniques", () => {
    const itens = [{ id: "a", nome: "X" }, { id: "b", nome: "y" }, { id: "c", nome: " x " }];
    const g = gruposDuplicados(itens);
    expect(g).toHaveLength(1);
    expect(g[0].map((i) => i.id)).toEqual(["a", "c"]); // insertion order → c is newest
  });
});

describe("custos operacionais (idea #13)", () => {
  const custos: CustoOperacional[] = [
    { id: "1", nome: "Aluguel", categoria: "aluguel", valorMensal: 100 },
    { id: "2", nome: "Internet", categoria: "internet", valorMensal: 60 },
    { id: "3", nome: "Energia", categoria: "energia", valorMensal: 40 },
  ];
  it("totals the monthly overhead", () => {
    expect(totalOperacional(custos)).toBe(200);
  });
  it("groups by category, biggest first, with shares summing to 1", () => {
    const agg = custosPorCategoria([...custos, { id: "4", nome: "Luz extra", categoria: "energia", valorMensal: 20 }]);
    expect(agg[0].categoria).toBe("aluguel"); // 100 is largest
    expect(agg.find((a) => a.categoria === "energia")!.valor).toBe(60); // 40 + 20 merged
    expect(agg.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 6);
  });
  it("totalOperacional of nothing is 0", () => expect(totalOperacional([])).toBe(0));
});

const devolucao = (over: Partial<Devolucao>): Devolucao => ({
  id: crypto.randomUUID(),
  produtoNome: "Produto",
  data: "2026-06-01T10:00",
  quantidade: 1,
  motivo: "defeito",
  status: "concluida",
  valorReembolsado: 100,
  reestocado: false,
  ...over,
});

describe("returns / devoluções (idea #1)", () => {
  const devs: Devolucao[] = [
    devolucao({ quantidade: 5, valorReembolsado: 500, reestocado: false, motivo: "defeito" }),
    devolucao({ quantidade: 2, valorReembolsado: 200, reestocado: true, motivo: "arrependimento" }),
    devolucao({ quantidade: 3, valorReembolsado: 300, reestocado: true, motivo: "defeito" }),
  ];

  it("resumoDevolucoes totals units, refund and restocked units", () => {
    const r = resumoDevolucoes(devs);
    expect(r.registros).toBe(3);
    expect(r.unidades).toBe(10);
    expect(r.reembolso).toBe(1000);
    expect(r.reestocadas).toBe(5); // 2 + 3, the restocked ones
  });

  it("devolucoesPorMotivo groups by reason, costliest first, shares summing to 1", () => {
    const agg = devolucoesPorMotivo(devs);
    expect(agg[0].motivo).toBe("defeito"); // 500 + 300 = 800 is largest
    expect(agg.find((a) => a.motivo === "defeito")!.reembolso).toBe(800);
    expect(agg.find((a) => a.motivo === "defeito")!.unidades).toBe(8);
    expect(agg.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 6);
  });

  it("taxaDevolucao = returned units ÷ realized sold units (cancelled excluded)", () => {
    const vendas: Venda[] = [
      venda({ quantidade: 60 }),
      venda({ quantidade: 40 }),
      venda({ quantidade: 999, status: "cancelado" }), // excluded from denominator
    ];
    expect(taxaDevolucao(devs, vendas)).toBeCloseTo(10 / 100, 6); // 10 returned / 100 sold
  });

  it("taxaDevolucao is 0 when there are no realized sales", () => {
    expect(taxaDevolucao(devs, [])).toBe(0);
  });

  it("empty ledger yields zeroed totals", () => {
    const r = resumoDevolucoes([]);
    expect(r).toEqual({ registros: 0, unidades: 0, reembolso: 0, reestocadas: 0 });
    expect(devolucoesPorMotivo([])).toEqual([]);
  });
});

describe("resumoPeriodo (latest vs previous period)", () => {
  const buckets = vendasPorMes([
    venda({ data: "2026-05-01T10:00", valorTotal: 100 }),
    venda({ data: "2026-06-01T10:00", valorTotal: 150 }),
  ]);
  it("compares the last two buckets", () => {
    const r = resumoPeriodo(buckets);
    expect(r.atual?.chave).toBe("2026-06");
    expect(r.anterior?.chave).toBe("2026-05");
    expect(r.variacao).toBeCloseTo(0.5, 6); // +50%
  });
  it("has no variação when there is only one period", () => {
    const r = resumoPeriodo(vendasPorMes([venda({ data: "2026-06-01T10:00", valorTotal: 150 })]));
    expect(r.anterior).toBeNull();
    expect(r.variacao).toBeNull();
  });
});
