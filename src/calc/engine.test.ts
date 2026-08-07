import { describe, expect, it } from "vitest";
import {
  calcularMetricas,
  capitalParaEstoque,
  comprasPorFornecedor,
  custoTotalCompra,
  custosPorCategoria,
  desempenhoProdutos,
  estoqueProdutos,
  devolucoesPorMotivo,
  faixasDesempenho,
  freteUnitario,
  serieFinanceiraMensal,
  vendasPorCanal,
  gruposDuplicados,
  mesmoNome,
  normalizaNome,
  resumoCompras,
  resumoDevolucoes,
  taxaDevolucao,
  curvaABC,
  detalharVenda,
  resumoABC,
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
import type { Compra, CustoOperacional, Devolucao, Produto, Venda } from "./types";

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

describe("detalharVenda (per-order waterfall, Phase 10a)", () => {
  const prod: Produto = {
    id: "p1",
    nome: "P",
    precoVenda: 100,
    vendasMes: 10,
    custoUnit: 40,
    qtdCaixa: 10,
    imposto: 0.04,
    comissao: 0.15,
    custoEmbalagem: 1,
  };

  it("breaks one order into signed lines that reconcile to the profit", () => {
    const d = detalharVenda(venda({ produtoId: "p1", quantidade: 2, valorTotal: 200, frete: 6 }), [prod]);
    expect(d.imposto).toBeCloseTo(8, 6); // 200 × 0.04
    expect(d.comissao).toBeCloseTo(30, 6); // 200 × 0.15
    expect(d.custo).toBe(80); // 40 × 2
    expect(d.embalagem).toBe(2); // 1 × 2
    expect(d.frete).toBe(6);
    expect(d.lucro).toBeCloseTo(74, 6); // 200 − 8 − 30 − 80 − 2 − 6
    expect(d.margem).toBeCloseTo(0.37, 6);
    expect(d.statusCor).toBe("verde");

    // the rendered lines must add up to exactly the same profit
    const soma = d.linhas.reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
    expect(soma).toBeCloseTo(d.lucro, 6);
  });

  it("omits zero-valued deductions but always keeps the gross line", () => {
    const semExtras: Produto = { ...prod, custoEmbalagem: 0 };
    const d = detalharVenda(venda({ produtoId: "p1", valorTotal: 100, frete: 0 }), [semExtras]);
    expect(d.linhas.map((l) => l.chave)).toEqual(["itens", "imposto", "comissao", "custo"]);
  });

  it("falls back to the product's freight rule when the sale carries no frete", () => {
    const barato: Produto = { ...prod, precoVenda: 50 }; // below the free-freight threshold
    const d = detalharVenda(venda({ produtoId: "p1", quantidade: 2, valorTotal: 100 }), [barato]);
    expect(d.frete).toBeCloseTo(CONFIG_PADRAO.freteUnit * 2, 6);
  });

  it("reports an avulsa as gross-only, never as profit", () => {
    const d = detalharVenda(venda({ produtoId: undefined, valorTotal: 50 }), [prod]);
    expect(d.atribuido).toBe(false);
    expect(d.bruto).toBe(50);
    expect(d.lucro).toBe(0);
    expect(d.linhas).toEqual([]);
  });

  it("still details a cancelled order but flags it as not counted", () => {
    const d = detalharVenda(venda({ produtoId: "p1", valorTotal: 100, status: "cancelado" }), [prod]);
    expect(d.contabilizado).toBe(false);
    expect(d.lucro).toBeGreaterThan(0); // the maths is shown…
    expect(resultadoVendas([venda({ produtoId: "p1", valorTotal: 100, status: "cancelado" })], [prod]).lucro).toBe(0); // …but excluded from totals
  });

  it("sums to resultadoVendas across a mixed ledger", () => {
    const vendas = [
      venda({ produtoId: "p1", quantidade: 2, valorTotal: 200, frete: 6 }),
      venda({ produtoId: "p1", quantidade: 1, valorTotal: 100, frete: 3 }),
      venda({ produtoId: undefined, valorTotal: 50 }), // avulsa → gross only
      venda({ produtoId: "p1", valorTotal: 900, status: "cancelado" }), // excluded
    ];
    const total = resultadoVendas(vendas, [prod]);
    const somaDetalhes = vendas
      .filter((v) => v.status !== "cancelado")
      .map((v) => detalharVenda(v, [prod]));
    expect(somaDetalhes.reduce((s, d) => s + d.lucro, 0)).toBeCloseTo(total.lucro, 6);
    expect(somaDetalhes.reduce((s, d) => s + d.bruto, 0)).toBeCloseTo(total.bruto, 6);
  });
});

describe("curvaABC (Gestor Seller ABC classification)", () => {
  // revenue split 70 / 20 / 7 / 3. p1 alone is only 70%, so p2 is what carries the business past
  // the 80% line and belongs in A too (the crossing item is included — standard Pareto).
  const mk = (id: string, custo: number): Produto => ({
    id, nome: id.toUpperCase(), precoVenda: 100, vendasMes: 0, custoUnit: custo, qtdCaixa: 10, imposto: 0.04, comissao: 0.15,
  });
  const prods = [mk("p1", 40), mk("p2", 40), mk("p3", 40), mk("p4", 40), mk("p5", 40)];
  const vendas: Venda[] = [
    venda({ produtoId: "p1", quantidade: 7, valorTotal: 700, frete: 0 }),
    venda({ produtoId: "p2", quantidade: 2, valorTotal: 200, frete: 0 }),
    venda({ produtoId: "p3", quantidade: 1, valorTotal: 70, frete: 0 }),
    venda({ produtoId: "p4", quantidade: 1, valorTotal: 30, frete: 0 }),
    // p5 never sold → class Z
  ];

  it("ranks by revenue and cuts the classes on cumulative share", () => {
    const abc = curvaABC(vendas, prods);
    expect(abc.map((l) => l.nome)).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    expect(abc.map((l) => l.classe)).toEqual(["A", "A", "B", "C", "Z"]);
  });

  it("accumulates share to 100% across the products that sold", () => {
    const abc = curvaABC(vendas, prods);
    expect(abc[0].share).toBeCloseTo(0.7, 6);
    expect(abc[0].acumulado).toBeCloseTo(0.7, 6);
    expect(abc[1].acumulado).toBeCloseTo(0.9, 6);
    expect(abc[3].acumulado).toBeCloseTo(1, 6);
  });

  it("always makes the best seller class A, even when it alone exceeds 80%", () => {
    const abc = curvaABC([venda({ produtoId: "p1", quantidade: 1, valorTotal: 1000, frete: 0 })], prods);
    expect(abc[0].classe).toBe("A");
  });

  it("flags never-sold catalog products as Z with no revenue", () => {
    const z = curvaABC(vendas, prods).find((l) => l.nome === "P5")!;
    expect(z.classe).toBe("Z");
    expect(z.bruto).toBe(0);
    expect(z.unidades).toBe(0);
  });

  it("rolls up per class without losing revenue", () => {
    const abc = curvaABC(vendas, prods);
    const resumo = resumoABC(abc);
    expect(resumo.map((r) => r.classe)).toEqual(["A", "B", "C", "Z"]);
    expect(resumo.find((r) => r.classe === "A")!.produtos).toBe(2); // p1 + p2 carry 90%
    expect(resumo.find((r) => r.classe === "A")!.share).toBeCloseTo(0.9, 6);
    expect(resumo.find((r) => r.classe === "C")!.produtos).toBe(1);
    expect(resumo.reduce((s, r) => s + r.bruto, 0)).toBeCloseTo(1000, 6);
    expect(resumo.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6);
  });

  it("returns an empty curve when there are no sales at all", () => {
    expect(curvaABC([], []).length).toBe(0);
    expect(curvaABC([], prods).every((l) => l.classe === "Z")).toBe(true);
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

const compra = (over: Partial<Compra>): Compra => ({
  id: crypto.randomUUID(),
  produtoNome: "Produto",
  data: "2026-03-01T10:00",
  quantidade: 10,
  custoUnit: 20,
  status: "recebida",
  ...over,
});

describe("compras & derived stock (idea #3)", () => {
  const prod: Produto = { id: "p1", nome: "P", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15, estoqueInicial: 50 };

  it("custoTotalCompra adds freight and extras to the goods", () => {
    expect(custoTotalCompra(compra({ quantidade: 10, custoUnit: 20, frete: 100, outrosCustos: 50 }))).toBe(350);
    expect(custoTotalCompra(compra({ quantidade: 10, custoUnit: 20 }))).toBe(200); // both optional
  });

  it("resumoCompras separates received from still-on-the-way, ignoring cancelled", () => {
    const r = resumoCompras([
      compra({ quantidade: 100, custoUnit: 10, status: "recebida" }),
      compra({ quantidade: 40, custoUnit: 10, status: "em_transito" }),
      compra({ quantidade: 25, custoUnit: 10, status: "pedida" }),
      compra({ quantidade: 999, custoUnit: 10, status: "cancelada" }),
    ]);
    expect(r.pedidos).toBe(3); // cancelled excluded everywhere
    expect(r.unidades).toBe(165);
    expect(r.investido).toBe(1650);
    expect(r.recebidas).toBe(1);
    expect(r.pendentes).toBe(2);
    expect(r.aCaminho).toBe(65); // 40 + 25 units not yet in stock
  });

  it("comprasPorFornecedor ranks spend, shares summing to 1", () => {
    const agg = comprasPorFornecedor([
      compra({ fornecedor: "A", quantidade: 10, custoUnit: 10 }), // 100
      compra({ fornecedor: "B", quantidade: 10, custoUnit: 5 }), // 50
      compra({ fornecedor: "A", quantidade: 10, custoUnit: 20 }), // 200
      compra({ quantidade: 10, custoUnit: 1 }), // no supplier → "Sem fornecedor"
    ]);
    expect(agg[0].fornecedor).toBe("A");
    expect(agg[0].investido).toBe(300);
    expect(agg.some((a) => a.fornecedor === "Sem fornecedor")).toBe(true);
    expect(agg.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 6);
  });

  it("stock = inicial + recebidas − vendidas + devolvidas reestocadas", () => {
    const e = estoqueProdutos(
      [prod],
      [
        compra({ produtoId: "p1", quantidade: 120, status: "recebida" }),
        compra({ produtoId: "p1", quantidade: 60, status: "em_transito" }), // not in stock yet
        compra({ produtoId: "p1", quantidade: 999, status: "cancelada" }),
      ],
      [venda({ produtoId: "p1", quantidade: 30 }), venda({ produtoId: "p1", quantidade: 500, status: "cancelado" })],
      [
        devolucao({ produtoId: "p1", quantidade: 8, reestocado: true }),
        devolucao({ produtoId: "p1", quantidade: 5, reestocado: false }), // scrapped
      ],
    ).get("p1")!;
    expect(e).toMatchObject({ inicial: 50, comprado: 120, vendido: 30, devolvido: 8 });
    expect(e.atual).toBe(148); // 50 + 120 − 30 + 8
  });

  it("treats a product with no movements as its opening balance, and no balance as zero", () => {
    const mapa = estoqueProdutos([prod, { ...prod, id: "p2", estoqueInicial: undefined }], [], [], []);
    expect(mapa.get("p1")!.atual).toBe(50);
    expect(mapa.get("p2")!.atual).toBe(0);
  });

  it("ignores movements that reference an unknown product", () => {
    const e = estoqueProdutos([prod], [compra({ produtoId: "zzz", quantidade: 999 })], [], []).get("p1")!;
    expect(e.atual).toBe(50);
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
