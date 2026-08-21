import { describe, expect, it } from "vitest";
import {
  acos,
  aplicarRetencao,
  capitalEmEstoque,
  daLoja,
  taxaImpostoDaVenda,
  produtosDaLoja,
  TODAS_LOJAS,
  calcularMetricas,
  custoAds,
  dre,
  mesesComVendas,
  type FontesDRE,
  pendenciasImportacao,
  resumoImportacao,
  vincularImportados,
  desempenhoAds,
  importarAnuncios,
  importarPedidos,
  resumoAds,
  tacos,
  capitalParaEstoque,
  comprasPorFornecedor,
  custoTotalCompra,
  custosPorCategoria,
  desempenhoProdutos,
  estoqueProdutos,
  devolucoesPorMotivo,
  coberturaEstoque,
  devolucoesPorProduto,
  maisVendidos,
  variacaoSemanalPorProduto,
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
  resumoOperacional,
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
  vendasPorSemana,
  vendasPorMes,
  vendasPorPais,
} from "./engine";
import { CONFIG_PADRAO } from "./constants";
import { ANUNCIOS_ADS_SEED, CONTAS_AMAZON_SEED, PRODUTOS_SEED, VENDAS_SEED } from "../data/seed";
import { pedidosDaConta, relatoriosAdsDaConta } from "../data/amazonMock";
import type { AnuncioAds, Compra, ContaAmazon, CustoOperacional, Devolucao, ExecucaoSync, PedidoAmazon, Produto, RelatorioAds, Venda } from "./types";

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

  describe("vendasPorSemana", () => {
    // 2026-06-15 is a Monday.
    it("keys a week on its Monday", () => {
      expect(vendasPorSemana([venda({ data: "2026-06-17T10:00" })]).map((s) => s.chave)).toEqual(["2026-06-15"]);
    });

    it("puts Monday and the following Sunday in the same bucket", () => {
      const s = vendasPorSemana([
        venda({ data: "2026-06-15T10:00", valorTotal: 100 }),
        venda({ data: "2026-06-21T23:00", valorTotal: 50 }),
      ]);
      expect(s).toHaveLength(1);
      expect(s[0].valor).toBe(150);
    });

    it("starts a new bucket on the next Monday", () => {
      const s = vendasPorSemana([
        venda({ data: "2026-06-21T10:00" }), // Sunday
        venda({ data: "2026-06-22T10:00" }), // Monday
      ]);
      expect(s.map((x) => x.chave)).toEqual(["2026-06-15", "2026-06-22"]);
    });

    // The reason the key is a date and not a week number: these still sort and group correctly.
    it("handles a week that straddles two months", () => {
      const s = vendasPorSemana([
        venda({ data: "2026-06-30T10:00", valorTotal: 10 }), // Tuesday
        venda({ data: "2026-07-01T10:00", valorTotal: 20 }), // Wednesday, same week
      ]);
      expect(s).toHaveLength(1);
      expect(s[0].chave).toBe("2026-06-29");
      expect(s[0].valor).toBe(30);
    });

    it("excludes cancelled sales like the other buckets", () => {
      expect(vendasPorSemana(vendas).reduce((t, s) => t + s.valor, 0)).toBe(350);
    });
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

describe("importarPedidos (marketplace order import, idea #15)", () => {
  const conta: ContaAmazon = {
    id: "c1",
    apelido: "Loja",
    sellerId: "A1",
    marketplace: "Amazon.com.br",
    regiao: "BR",
    conexoes: [{ servico: "sp-api", status: "conectada", conectadaEm: "2026-06-01T00:00" }],
    simulada: true,
  };
  const prod: Produto = {
    id: "p1",
    codigoProduto: "SKU-1",
    nome: "Projetor",
    precoVenda: 100,
    vendasMes: 0,
    custoUnit: 40,
    qtdCaixa: 10,
    imposto: 0.04,
    comissao: 0.15,
  };
  const pedido = (over: Partial<PedidoAmazon>): PedidoAmazon => ({
    numeroPedido: "701-0001",
    data: "2026-06-20T10:00",
    sku: "SKU-1",
    titulo: "Projetor",
    quantidade: 1,
    valorUnitario: 100,
    valorTotal: 100,
    pais: "BR",
    status: "entregue",
    ...over,
  });

  it("matches the product by SKU and stamps where the sale came from", () => {
    const [v] = importarPedidos([pedido({})], [], [prod], conta);
    expect(v.produtoId).toBe("p1");
    expect(v.produtoNome).toBe("Projetor");
    expect(v.origem).toBe("amazon");
    expect(v.contaId).toBe("c1");
    expect(v.canal).toBe("Amazon");
  });

  it("still imports an unknown SKU, as an avulsa — the revenue is real either way", () => {
    const [v] = importarPedidos([pedido({ sku: "SKU-DESCONHECIDO", titulo: "Outro" })], [], [prod], conta);
    expect(v.produtoId).toBeUndefined();
    expect(v.produtoNome).toBe("Outro");
    expect(v.valorTotal).toBe(100);
  });

  it("is idempotent: re-syncing the same window imports nothing twice", () => {
    const primeira = importarPedidos([pedido({})], [], [prod], conta);
    const segunda = importarPedidos([pedido({})], primeira, [prod], conta);
    expect(primeira).toHaveLength(1);
    expect(segunda).toHaveLength(0);
  });

  it("treats each SKU of a multi-item order as its own sale", () => {
    const novas = importarPedidos(
      [pedido({}), pedido({ sku: "SKU-2", titulo: "Garrafa" })],
      [],
      [prod],
      conta,
    );
    expect(novas).toHaveLength(2);
    // …and re-importing that order adds neither back
    expect(importarPedidos([pedido({}), pedido({ sku: "SKU-2", titulo: "Garrafa" })], novas, [prod], conta)).toHaveLength(0);
  });

  it("drops duplicates inside a single payload", () => {
    expect(importarPedidos([pedido({}), pedido({})], [], [prod], conta)).toHaveLength(1);
  });

  it("only skips what actually matches — a different order with the same SKU still imports", () => {
    const primeira = importarPedidos([pedido({})], [], [prod], conta);
    const outra = importarPedidos([pedido({ numeroPedido: "701-0002" })], primeira, [prod], conta);
    expect(outra).toHaveLength(1);
  });

  it("does not collide with hand-typed sales that carry the same order number", () => {
    const manual = venda({ numeroPedido: "701-0001", codigoProduto: "SKU-1" });
    expect(importarPedidos([pedido({})], [manual], [prod], conta)).toHaveLength(0);
  });

  it("never carries buyer data — that is restricted and a first integration will not have it", () => {
    const [v] = importarPedidos([pedido({})], [], [prod], conta);
    expect(v.cliente).toBeUndefined();
    expect(v.cidade).toBeUndefined();
    expect(v.uf).toBeUndefined();
    expect(v.pais).toBeDefined(); // marketplace-derived, so it is fine
  });

  describe("importarAnuncios (Ads API — a separate authorization)", () => {
    const rel = (over: Partial<RelatorioAds>): RelatorioAds => ({
      campanhaId: "CAMP-1",
      campanha: "SP · Auto",
      data: "2026-06-30",
      sku: "SKU-1",
      titulo: "Projetor",
      custo: 100,
      faturamentoAds: 400,
      unidadesAds: 4,
      cliques: 200,
      ...over,
    });

    it("matches by SKU and stamps the account it came from", () => {
      const [a] = importarAnuncios([rel({})], [], [prod], conta);
      expect(a.produtoId).toBe("p1");
      expect(a.origem).toBe("amazon");
      expect(a.contaId).toBe("c1");
      expect(a.campanhaId).toBe("CAMP-1");
    });

    it("leaves organic units unset — the Ads API cannot know them", () => {
      const [a] = importarAnuncios([rel({})], [], [prod], conta);
      expect(a.unidadesOrganicas).toBeUndefined();
    });

    it("is idempotent per campaign per month", () => {
      const primeira = importarAnuncios([rel({})], [], [prod], conta);
      expect(importarAnuncios([rel({})], primeira, [prod], conta)).toHaveLength(0);
      // a later month of the same campaign is genuinely new
      expect(importarAnuncios([rel({ data: "2026-07-31" })], primeira, [prod], conta)).toHaveLength(1);
    });

    it("does not touch hand-entered ad rows, which carry no campanhaId", () => {
      const manual: AnuncioAds = {
        id: "m1",
        produtoNome: "Projetor",
        sku: "SKU-1",
        canal: "Amazon",
        data: "2026-06-30",
        custo: 50,
        faturamentoAds: 100,
        unidadesAds: 1,
      };
      expect(importarAnuncios([rel({})], [manual], [prod], conta)).toHaveLength(1);
    });
  });
});

describe("maisVendidos (best sellers of a period)", () => {
  const p1: Produto = { ...base, id: "p1", nome: "Projetor", custoUnit: 40, imposto: 0.04, comissao: 0.15 };
  const p2: Produto = { ...base, id: "p2", nome: "Garrafa", custoUnit: 10, imposto: 0.04, comissao: 0.15 };

  it("ranks by revenue and reports orders and average price", () => {
    const r = maisVendidos(
      [
        venda({ produtoId: "p1", quantidade: 2, valorTotal: 200, canal: "Amazon", frete: 0 }),
        venda({ produtoId: "p1", quantidade: 1, valorTotal: 100, canal: "Amazon", frete: 0 }),
        venda({ produtoId: "p2", quantidade: 1, valorTotal: 50, canal: "Shopee", frete: 0 }),
      ],
      [p1, p2],
    );
    expect(r.map((x) => x.nome)).toEqual(["Projetor", "Garrafa"]);
    expect(r[0].pedidos).toBe(2);
    expect(r[0].unidades).toBe(3);
    expect(r[0].precoMedio).toBeCloseTo(100, 10);
  });

  it("names the channel, and flags when a product sells on more than one", () => {
    const r = maisVendidos(
      [
        venda({ produtoId: "p1", valorTotal: 300, canal: "Amazon", frete: 0 }),
        venda({ produtoId: "p1", valorTotal: 100, canal: "Shopee", frete: 0 }),
        venda({ produtoId: "p2", valorTotal: 50, canal: "Shopee", frete: 0 }),
      ],
      [p1, p2],
    );
    expect(r[0].canal).toBe("Amazon +1"); // Amazon brought the most
    expect(r[1].canal).toBe("Shopee");
  });

  it("honours the limit", () => {
    const muitas = Array.from({ length: 20 }, (_, i) =>
      venda({ produtoId: "p1", valorTotal: 10, canal: "Amazon", frete: 0, id: String(i) }),
    );
    expect(maisVendidos(muitas, [p1], CONFIG_PADRAO, 15).length).toBeLessThanOrEqual(15);
  });

  it("leaves out cancelled sales", () => {
    const r = maisVendidos(
      [
        venda({ produtoId: "p1", valorTotal: 100, canal: "Amazon", frete: 0 }),
        venda({ produtoId: "p1", valorTotal: 900, canal: "Amazon", status: "cancelado" }),
      ],
      [p1],
    );
    expect(r[0].bruto).toBe(100);
    expect(r[0].pedidos).toBe(1);
  });
});

describe("variacaoSemanalPorProduto", () => {
  // 2026-06-15 and 2026-06-22 are consecutive Mondays.
  it("compares each product's revenue across the last two weeks in the ledger", () => {
    const r = variacaoSemanalPorProduto([
      venda({ produtoId: "p1", data: "2026-06-16T10:00", valorTotal: 100 }),
      venda({ produtoId: "p1", data: "2026-06-23T10:00", valorTotal: 150 }),
    ]);
    expect(r.get("p1")).toBeCloseTo(0.5, 10);
  });

  it("reports null when the product did not sell the week before", () => {
    const r = variacaoSemanalPorProduto([
      venda({ produtoId: "p1", data: "2026-06-16T10:00", valorTotal: 100 }),
      venda({ produtoId: "p2", data: "2026-06-23T10:00", valorTotal: 150 }),
    ]);
    expect(r.get("p2")).toBeNull();
  });

  it("shows a drop as a negative", () => {
    const r = variacaoSemanalPorProduto([
      venda({ produtoId: "p1", data: "2026-06-16T10:00", valorTotal: 200 }),
      venda({ produtoId: "p1", data: "2026-06-23T10:00", valorTotal: 50 }),
    ]);
    expect(r.get("p1")).toBeCloseTo(-0.75, 10);
  });

  it("is empty when there is only one week of data to compare", () => {
    const r = variacaoSemanalPorProduto([venda({ produtoId: "p1", data: "2026-06-16T10:00", valorTotal: 100 })]);
    expect(r.get("p1")).toBeNull();
  });
});

describe("coberturaEstoque (how long the shelf lasts)", () => {
  const prod: Produto = { ...base, id: "p1", nome: "Projetor", estoqueInicial: 60 };
  // 30 units over the window → 1/day. Dates sit inside one window ending at the latest sale.
  const trinta = [
    venda({ produtoId: "p1", data: "2026-06-10T10:00", quantidade: 15 }),
    venda({ produtoId: "p1", data: "2026-06-20T10:00", quantidade: 15 }),
  ];

  it("turns the recent sales rate into days of stock left", () => {
    const c = coberturaEstoque([prod], [], trinta, [])!.get("p1")!;
    expect(c.estoque).toBe(30); // 60 opening − 30 sold
    expect(c.vendidas).toBe(30);
    expect(c.vendaDiaria).toBeCloseTo(1, 10);
    expect(c.diasRestantes).toBeCloseTo(30, 10);
  });

  it("says nothing rather than guessing when a product is not selling", () => {
    const c = coberturaEstoque([prod], [], [], [])!.get("p1")!;
    expect(c.diasRestantes).toBeNull();
    expect(c.diasParaPedir).toBeNull();
    expect(c.pedirAgora).toBe(false);
  });

  it("subtracts the lead time to say when to ORDER, not when to run out", () => {
    const comPrazo: Produto = { ...prod, prazoReposicaoDias: 20 };
    const c = coberturaEstoque([comPrazo], [], trinta, [])!.get("p1")!;
    expect(c.diasRestantes).toBeCloseTo(30, 10);
    expect(c.diasParaPedir).toBeCloseTo(10, 10); // 30 days of cover, 20 to restock
    expect(c.pedirAgora).toBe(false);
  });

  it("flags a product whose stock runs out before a reorder could land", () => {
    const apertado: Produto = { ...prod, prazoReposicaoDias: 45 };
    const c = coberturaEstoque([apertado], [], trinta, [])!.get("p1")!;
    expect(c.diasParaPedir).toBeLessThan(0);
    expect(c.pedirAgora).toBe(true);
  });

  // Anchoring to the wall clock would report "not selling" for every product in a demo, or any
  // time the ledger is a few weeks behind — precisely when someone is looking at this.
  it("measures the window from the last sale in the ledger, not from today", () => {
    const antigas = [venda({ produtoId: "p1", data: "2020-01-10T10:00", quantidade: 30 })];
    const c = coberturaEstoque([prod], [], antigas, [])!.get("p1")!;
    expect(c.vendidas).toBe(30);
    expect(c.diasRestantes).toBeCloseTo(30, 10);
  });

  it("counts restocked returns and received purchases through the derived stock", () => {
    const c = coberturaEstoque(
      [prod],
      [],
      trinta,
      [devolucao({ produtoId: "p1", quantidade: 5, reestocado: true })],
    )!.get("p1")!;
    expect(c.estoque).toBe(35); // 60 − 30 sold + 5 back on the shelf
  });
});

describe("devolucoesPorProduto (refunds set against what the product earned)", () => {
  const prod: Produto = { ...base, id: "p1", nome: "Projetor", precoVenda: 100, custoUnit: 40, imposto: 0.04, comissao: 0.15 };
  const vendas = [
    venda({ produtoId: "p1", produtoNome: "Projetor", quantidade: 10, valorTotal: 1000, frete: 0 }),
  ];

  it("groups refunds per product, costliest first", () => {
    const r = devolucoesPorProduto(
      [
        devolucao({ produtoId: "p1", produtoNome: "Projetor", valorReembolsado: 100, quantidade: 1 }),
        devolucao({ produtoId: "p2", produtoNome: "Outro", valorReembolsado: 500, quantidade: 2 }),
      ],
      vendas,
      [prod],
    );
    expect(r.map((x) => x.nome)).toEqual(["Outro", "Projetor"]);
    expect(r[1].registros).toBe(1);
  });

  it("adds up several returns of the same product", () => {
    const r = devolucoesPorProduto(
      [
        devolucao({ produtoId: "p1", produtoNome: "Projetor", valorReembolsado: 100, quantidade: 1 }),
        devolucao({ produtoId: "p1", produtoNome: "Projetor", valorReembolsado: 200, quantidade: 3 }),
      ],
      vendas,
      [prod],
    );
    expect(r).toHaveLength(1);
    expect(r[0].registros).toBe(2);
    expect(r[0].unidades).toBe(4);
    expect(r[0].reembolso).toBe(300);
  });

  it("computes the return rate against units actually sold", () => {
    const r = devolucoesPorProduto(
      [devolucao({ produtoId: "p1", produtoNome: "Projetor", quantidade: 2, valorReembolsado: 200 })],
      vendas,
      [prod],
    );
    expect(r[0].taxa).toBeCloseTo(0.2, 10); // 2 returned of 10 sold
  });

  // The reason this function exists: margin alone can hide a product that loses money on returns.
  it("shows the margin before and after refunds, which is the whole point", () => {
    const r = devolucoesPorProduto(
      [devolucao({ produtoId: "p1", produtoNome: "Projetor", quantidade: 3, valorReembolsado: 300 })],
      vendas,
      [prod],
    );
    // 1000 gross − 40 tax − 150 commission − 400 cost = 410 profit, 41%
    expect(r[0].lucro).toBeCloseTo(410, 10);
    expect(r[0].margem).toBeCloseTo(0.41, 10);
    // …and after R$300 of refunds it is only 110, or 11%
    expect(r[0].lucroLiquido).toBeCloseTo(110, 10);
    expect(r[0].margemLiquida).toBeCloseTo(0.11, 10);
  });

  it("can turn a profitable-looking product negative", () => {
    const r = devolucoesPorProduto(
      [devolucao({ produtoId: "p1", produtoNome: "Projetor", quantidade: 6, valorReembolsado: 600 })],
      vendas,
      [prod],
    );
    expect(r[0].margem).toBeGreaterThan(0);
    expect(r[0].lucroLiquido).toBeLessThan(0);
  });

  it("keeps returns of products the catalog never had, grouped by name", () => {
    const r = devolucoesPorProduto(
      [
        devolucao({ produtoNome: "Cabo USB-C", valorReembolsado: 50 }),
        devolucao({ produtoNome: "cabo  usb-c", valorReembolsado: 30 }),
      ],
      vendas,
      [prod],
    );
    expect(r).toHaveLength(1);
    expect(r[0].reembolso).toBe(80);
    expect(r[0].produtoId).toBeUndefined();
    expect(r[0].taxa).toBe(0); // nothing sold under it that we can attribute
  });

  it("is empty when nothing came back", () => {
    expect(devolucoesPorProduto([], vendas, [prod])).toEqual([]);
  });
});

describe("DRE (demonstração do resultado)", () => {
  const prod: Produto = { ...base, id: "p1", nome: "Projetor", precoVenda: 100, custoUnit: 40, imposto: 0.04, comissao: 0.15 };
  const fontes = (over: Partial<FontesDRE> = {}): FontesDRE => ({
    vendas: [venda({ produtoId: "p1", data: "2026-06-10T10:00", quantidade: 1, valorTotal: 100, frete: 5 })],
    produtos: [prod],
    devolucoes: [],
    custosOperacionais: [],
    anuncios: [],
    ...over,
  });

  it("lays the statement out from gross revenue down to net profit", () => {
    const d = dre(fontes(), "2026-06");
    expect(d.receitaBruta).toBe(100);
    expect(d.impostos).toBe(4);
    expect(d.comissoes).toBe(15);
    expect(d.receitaLiquida).toBe(81); // 100 − 4 − 15
    expect(d.cmv).toBe(40);
    expect(d.lucroBruto).toBe(41); // 81 − 40
    expect(d.frete).toBe(5);
    expect(d.lucroLiquido).toBe(36); // 41 − 5
  });

  // The property that matters: a statement that disagreed with the dashboard would make both
  // untrustworthy, which is exactly the trap the old projected Relatórios page fell into.
  it("lands on the same net profit the Painel computes, the same way", () => {
    const f = fontes({
      devolucoes: [devolucao({ data: "2026-06-15T10:00", valorReembolsado: 12 })],
      custosOperacionais: [
        { id: "o1", nome: "Aluguel", categoria: "aluguel", valorMensal: 20 },
        { id: "o2", nome: "Juros", categoria: "juros", valorMensal: 5, tipo: "receita" },
      ],
      anuncios: [{ id: "a1", produtoNome: "Projetor", canal: "Amazon", data: "2026-06-30", custo: 7, faturamentoAds: 0, unidadesAds: 0 }],
    });
    const d = dre(f, "2026-06");

    const doMes = f.vendas.filter((v) => v.data.slice(0, 7) === "2026-06");
    const comoOPainel =
      resultadoVendas(doMes, f.produtos).lucro -
      resumoDevolucoes(f.devolucoes).reembolso -
      totalOperacional(f.custosOperacionais, "2026-06") -
      custoAds(f.anuncios, "2026-06");

    expect(d.lucroLiquido).toBeCloseTo(comoOPainel, 10);
  });

  it("reconciles line by line — the deductions really do add up to the bottom line", () => {
    const d = dre(fontes({
      custosOperacionais: [{ id: "o1", nome: "Aluguel", categoria: "aluguel", valorMensal: 20 }],
      anuncios: [{ id: "a1", produtoNome: "P", canal: "Amazon", data: "2026-06-30", custo: 7, faturamentoAds: 0, unidadesAds: 0 }],
    }), "2026-06");
    const somado =
      d.receitaBruta - d.impostos - d.comissoes - d.devolucoes - d.cmv - d.embalagem -
      d.custoSemCadastro - d.frete - d.ads - d.despesasOperacionais + d.receitasOperacionais;
    expect(somado).toBeCloseTo(d.lucroLiquido, 10);
  });

  it("counts packaging, which used to fall out of the totals silently", () => {
    const comEmbalagem: Produto = { ...prod, custoEmbalagem: 3 };
    const d = dre(fontes({ produtos: [comEmbalagem] }), "2026-06");
    expect(d.embalagem).toBe(3);
    expect(d.lucroBruto).toBe(38); // 81 − 40 − 3
    // and it still reconciles, which is the whole reason the field was added
    expect(d.receitaBruta - d.impostos - d.comissoes - d.cmv - d.embalagem - d.frete).toBeCloseTo(d.lucroLiquido, 10);
  });

  it("ignores other months entirely", () => {
    const d = dre(fontes({
      vendas: [
        venda({ produtoId: "p1", data: "2026-06-10T10:00", valorTotal: 100, frete: 0 }),
        venda({ produtoId: "p1", data: "2026-05-10T10:00", valorTotal: 999, frete: 0 }),
      ],
    }), "2026-06");
    expect(d.receitaBruta).toBe(100);
  });

  it("leaves cancelled orders out", () => {
    const d = dre(fontes({
      vendas: [
        venda({ produtoId: "p1", data: "2026-06-10T10:00", valorTotal: 100, frete: 0 }),
        venda({ produtoId: "p1", data: "2026-06-11T10:00", valorTotal: 500, status: "cancelado" }),
      ],
    }), "2026-06");
    expect(d.receitaBruta).toBe(100);
    expect(d.pedidos).toBe(1);
  });

  // An unattributed sale is the case that broke the first version of this: its revenue landed in
  // gross with nothing deducted against it, so the statement claimed R$249 of profit the Painel
  // did not — the exact "two screens, two numbers" failure the DRE exists to end.
  describe("sales with no product behind them", () => {
    const semProduto = () =>
      fontes({ vendas: [venda({ data: "2026-06-10T10:00", valorTotal: 100, produtoNome: "Desconhecido" })] });

    it("keeps the revenue on the gross line — the money really did arrive", () => {
      expect(dre(semProduto(), "2026-06").receitaBruta).toBe(100);
    });

    it("books it as cost so the result is zero, not pure profit", () => {
      const d = dre(semProduto(), "2026-06");
      expect(d.custoSemCadastro).toBe(100);
      expect(d.cmv).toBe(0); // no real cost is known
      expect(d.lucroBruto).toBe(0);
      expect(d.lucroLiquido).toBe(0);
    });

    it("still reconciles with the Painel, which is why it is booked that way", () => {
      const f = semProduto();
      const doMes = f.vendas.filter((v) => v.data.slice(0, 7) === "2026-06");
      expect(dre(f, "2026-06").lucroLiquido).toBeCloseTo(resultadoVendas(doMes, f.produtos).lucro, 10);
    });

    it("surfaces the amount so it can be fixed rather than hidden", () => {
      expect(dre(semProduto(), "2026-06").receitaSemCusto).toBe(100);
    });

    it("reconciles when attributed and unattributed sales are mixed", () => {
      const f = fontes({
        vendas: [
          venda({ produtoId: "p1", data: "2026-06-10T10:00", valorTotal: 100, frete: 5 }),
          venda({ data: "2026-06-11T10:00", valorTotal: 249, produtoNome: "Cabo" }),
        ],
      });
      const doMes = f.vendas.filter((v) => v.data.slice(0, 7) === "2026-06");
      const d = dre(f, "2026-06");
      expect(d.receitaBruta).toBe(349);
      expect(d.lucroLiquido).toBeCloseTo(resultadoVendas(doMes, f.produtos).lucro, 10);
    });
  });

  it("lets operational income lift the result, rather than only costs dragging it", () => {
    const d = dre(fontes({
      custosOperacionais: [{ id: "o1", nome: "Reembolso de frete", categoria: "reembolso", valorMensal: 30, tipo: "receita" }],
    }), "2026-06");
    expect(d.receitasOperacionais).toBe(30);
    expect(d.lucroLiquido).toBe(66); // 36 + 30
  });

  it("reads every line as a share of gross revenue", () => {
    const d = dre(fontes(), "2026-06");
    expect(d.linhas.find((l) => l.chave === "impostos")!.vertical).toBeCloseTo(0.04, 10);
    expect(d.linhas.find((l) => l.chave === "lucroLiquido")!.vertical).toBeCloseTo(0.36, 10);
  });

  it("drops zero lines but never a subtotal — an empty month is still a statement", () => {
    const d = dre(fontes({ vendas: [] }), "2026-06");
    expect(d.receitaBruta).toBe(0);
    expect(d.lucroLiquido).toBe(0);
    expect(d.margemLiquida).toBe(0); // not NaN
    expect(d.linhas.map((l) => l.chave)).toContain("lucroLiquido");
    expect(d.linhas.map((l) => l.chave)).not.toContain("frete");
  });

  it("mesesComVendas lists the ledger's months, newest first, ignoring cancelled", () => {
    const vendas = [
      venda({ data: "2026-05-02T10:00" }),
      venda({ data: "2026-06-02T10:00" }),
      venda({ data: "2026-06-20T10:00" }),
      venda({ data: "2026-07-01T10:00", status: "cancelado" }),
    ];
    expect(mesesComVendas(vendas)).toEqual(["2026-06", "2026-05"]);
  });
});

describe("sync history & import provenance (Amazon page)", () => {
  const exec = (over: Partial<ExecucaoSync>): ExecucaoSync => ({
    id: crypto.randomUUID(),
    contaId: "c1",
    servico: "sp-api",
    iniciadaEm: "2026-06-01T10:00:00.000Z",
    status: "sucesso",
    recebidos: 5,
    importados: 5,
    duplicados: 0,
    semCorrespondencia: 0,
    payload: [{ a: 1 }],
    ...over,
  });
  /** n runs of one account, oldest first, one minute apart. */
  const serie = (n: number, contaId = "c1") =>
    Array.from({ length: n }, (_, i) =>
      exec({ contaId, iniciadaEm: `2026-06-01T10:${String(i).padStart(2, "0")}:00.000Z` }),
    );

  describe("aplicarRetencao", () => {
    it("keeps everything while under both limits", () => {
      const r = aplicarRetencao(serie(3));
      expect(r).toHaveLength(3);
      expect(r.every((e) => e.payload)).toBe(true);
    });

    it("returns newest first, whatever order it was handed", () => {
      const r = aplicarRetencao(serie(4));
      expect(r.map((e) => e.iniciadaEm)).toEqual([
        "2026-06-01T10:03:00.000Z",
        "2026-06-01T10:02:00.000Z",
        "2026-06-01T10:01:00.000Z",
        "2026-06-01T10:00:00.000Z",
      ]);
    });

    it("drops the payload from older runs but keeps their counters", () => {
      const r = aplicarRetencao(serie(14), 10, 50);
      expect(r).toHaveLength(14);
      expect(r.filter((e) => e.payload)).toHaveLength(10);
      // the ones that lost it are still readable as a record
      expect(r[13].recebidos).toBe(5);
      expect(r[13].payload).toBeUndefined();
    });

    it("forgets runs past the hard limit entirely", () => {
      expect(aplicarRetencao(serie(60), 10, 50)).toHaveLength(50);
    });

    it("counts limits per account — a busy account cannot evict a quiet one", () => {
      const r = aplicarRetencao([...serie(12, "c1"), ...serie(3, "c2")], 10, 50);
      expect(r.filter((e) => e.contaId === "c2")).toHaveLength(3);
      expect(r.filter((e) => e.contaId === "c2" && e.payload)).toHaveLength(3);
      expect(r.filter((e) => e.contaId === "c1" && e.payload)).toHaveLength(10);
    });
  });

  describe("resumoImportacao", () => {
    const imp = (over: Partial<Venda>) =>
      venda({ origem: "amazon", contaId: "c1", valorTotal: 100, ...over });

    it("counts only what came from the connection", () => {
      const r = resumoImportacao([imp({}), venda({ valorTotal: 999 })], [], "c1");
      expect(r.pedidos).toBe(1);
      expect(r.faturamento).toBe(100);
    });

    it("separates accounts", () => {
      const r = resumoImportacao([imp({}), imp({ contaId: "c2" })], [], "c1");
      expect(r.pedidos).toBe(1);
    });

    it("leaves cancelled orders out of the imported revenue", () => {
      const r = resumoImportacao([imp({}), imp({ status: "cancelado", valorTotal: 500 })], [], "c1");
      expect(r.faturamento).toBe(100);
    });

    it("sums imported campaigns separately from orders", () => {
      const ad: AnuncioAds = {
        id: "a1", produtoNome: "X", canal: "Amazon", data: "2026-06-30",
        custo: 80, faturamentoAds: 300, unidadesAds: 3, origem: "amazon", contaId: "c1",
      };
      const r = resumoImportacao([imp({})], [ad, { ...ad, id: "a2", origem: undefined, custo: 999 }], "c1");
      expect(r.campanhas).toBe(1);
      expect(r.investimento).toBe(80);
    });
  });

  describe("pendenciasImportacao", () => {
    const comCusto: Produto = { ...base, id: "p1", codigoProduto: "SKU-1", custoUnit: 40 };
    const semCusto: Produto = { ...base, id: "p2", codigoProduto: "SKU-2", custoUnit: 0 };
    const imp = (over: Partial<Venda>) =>
      venda({ origem: "amazon", contaId: "c1", quantidade: 2, valorTotal: 200, ...over });

    it("flags an imported SKU the catalog has never seen", () => {
      const r = pendenciasImportacao([imp({ codigoProduto: "SKU-9", produtoNome: "Cabo" })], [], [comCusto], "c1");
      expect(r).toHaveLength(1);
      expect(r[0].motivo).toBe("sem_produto");
      expect(r[0].titulo).toBe("Cabo");
      expect(r[0].produtoId).toBeUndefined();
    });

    it("flags a matched product that has no cost registered — same overstated margin", () => {
      const r = pendenciasImportacao([imp({ codigoProduto: "SKU-2", produtoId: "p2" })], [], [semCusto], "c1");
      expect(r[0].motivo).toBe("sem_custo");
      expect(r[0].produtoId).toBe("p2");
    });

    it("says nothing about a properly costed import", () => {
      expect(pendenciasImportacao([imp({ codigoProduto: "SKU-1", produtoId: "p1" })], [], [comCusto], "c1")).toEqual([]);
    });

    it("ignores hand-entered rows — an uncosted product of your own is not this page's business", () => {
      const manual = venda({ codigoProduto: "SKU-9", produtoNome: "Cabo" });
      expect(pendenciasImportacao([manual], [], [comCusto], "c1")).toEqual([]);
    });

    it("groups repeats of one SKU and adds up the money at stake", () => {
      const r = pendenciasImportacao(
        [imp({ codigoProduto: "SKU-9" }), imp({ codigoProduto: "SKU-9", valorTotal: 50, quantidade: 1 })],
        [],
        [comCusto],
        "c1",
      );
      expect(r).toHaveLength(1);
      expect(r[0].pedidos).toBe(2);
      expect(r[0].unidades).toBe(3);
      expect(r[0].valor).toBe(250);
    });

    it("ranks by the money riding on it, because that is the order worth fixing", () => {
      const r = pendenciasImportacao(
        [imp({ codigoProduto: "SKU-8", valorTotal: 90 }), imp({ codigoProduto: "SKU-9", valorTotal: 900 })],
        [],
        [comCusto],
        "c1",
      );
      expect(r.map((p) => p.sku)).toEqual(["SKU-9", "SKU-8"]);
    });

    it("stops flagging the SKU once it is linked to a costed product", () => {
      const antes = pendenciasImportacao([imp({ codigoProduto: "SKU-1" })], [], [comCusto], "c1");
      expect(antes).toHaveLength(1); // arrived as an avulsa: no produtoId yet
      const { vendas } = vincularImportados("SKU-1", comCusto, [imp({ codigoProduto: "SKU-1" })], [], "c1");
      expect(pendenciasImportacao(vendas, [], [comCusto], "c1")).toEqual([]);
    });

    it("counts an unknown SKU that arrived through Ads too, on the same line", () => {
      const ad: AnuncioAds = {
        id: "a1", produtoNome: "Cabo", sku: "SKU-9", canal: "Amazon", data: "2026-06-30",
        custo: 10, faturamentoAds: 0, unidadesAds: 0, origem: "amazon", contaId: "c1",
      };
      const r = pendenciasImportacao([imp({ codigoProduto: "SKU-9" })], [ad], [comCusto], "c1");
      expect(r).toHaveLength(1);
      expect(r[0].pedidos).toBe(1);
      expect(r[0].anuncios).toBe(1);
    });
  });
});

describe("vincularImportados (matching an imported SKU by hand)", () => {
  const produto: Produto = { ...base, id: "p1", nome: "Cabo USB-C", codigoProduto: "SKU-1", custoUnit: 9 };
  const imp = (over: Partial<Venda>) =>
    venda({ origem: "amazon", contaId: "c1", codigoProduto: "SKU-9", produtoNome: "Cabo", ...over });

  it("points matching imported sales at the product", () => {
    const r = vincularImportados("SKU-9", produto, [imp({})], [], "c1");
    expect(r.vendas[0].produtoId).toBe("p1");
    expect(r.vendas[0].produtoNome).toBe("Cabo USB-C");
    expect(r.alteradas).toBe(1);
  });

  it("leaves a hand-typed sale with the same code completely alone", () => {
    const manual = venda({ codigoProduto: "SKU-9", produtoNome: "Meu registro" });
    const r = vincularImportados("SKU-9", produto, [manual], [], "c1");
    expect(r.vendas[0]).toBe(manual); // same object — untouched
    expect(r.alteradas).toBe(0);
  });

  it("does not reach into another account's imports", () => {
    const r = vincularImportados("SKU-9", produto, [imp({ contaId: "c2" })], [], "c1");
    expect(r.alteradas).toBe(0);
  });

  it("ignores a different SKU", () => {
    const r = vincularImportados("SKU-9", produto, [imp({ codigoProduto: "SKU-8" })], [], "c1");
    expect(r.alteradas).toBe(0);
  });

  it("relinks imported ad rows on the same SKU, and counts them together", () => {
    const ad: AnuncioAds = {
      id: "a1", produtoNome: "Cabo", sku: "SKU-9", canal: "Amazon", data: "2026-06-30",
      custo: 10, faturamentoAds: 40, unidadesAds: 1, origem: "amazon", contaId: "c1",
    };
    const r = vincularImportados("SKU-9", produto, [imp({})], [ad], "c1");
    expect(r.anuncios[0].produtoId).toBe("p1");
    expect(r.alteradas).toBe(2);
  });

  it("matches the code case-insensitively, as the importer does", () => {
    const r = vincularImportados("sku-9", produto, [imp({ codigoProduto: "SKU-9" })], [], "c1");
    expect(r.alteradas).toBe(1);
  });
});

// Guards the demo data itself, not the engine. The seeded June campaigns and the Ads mock
// describe the SAME three campaigns, so if their ids ever drift apart a sync re-imports spend
// that was already in the ledger — which is exactly what once turned the Painel's profit
// negative. The importer was never wrong; the data was.
describe("demo seed ⇄ marketplace mock agree on identity", () => {
  const conta = CONTAS_AMAZON_SEED[0];

  it("re-syncing Ads on a fresh install imports nothing — the seed already holds those campaigns", () => {
    expect(importarAnuncios(relatoriosAdsDaConta(conta), ANUNCIOS_ADS_SEED, PRODUTOS_SEED, conta)).toHaveLength(0);
  });

  it("June's advertising spend stays at the seeded total after a sync", () => {
    const novos = importarAnuncios(relatoriosAdsDaConta(conta), ANUNCIOS_ADS_SEED, PRODUTOS_SEED, conta);
    expect(custoAds([...novos, ...ANUNCIOS_ADS_SEED], "2026-06")).toBe(custoAds(ANUNCIOS_ADS_SEED, "2026-06"));
  });

  it("orders are the opposite case: the seed's are hand-typed, so a first sync genuinely imports", () => {
    const novas = importarPedidos(pedidosDaConta(conta), VENDAS_SEED, PRODUTOS_SEED, conta);
    expect(novas.length).toBe(pedidosDaConta(conta).length);
    // …and only once — the second sync is a no-op, which is the property that matters
    expect(importarPedidos(pedidosDaConta(conta), [...novas, ...VENDAS_SEED], PRODUTOS_SEED, conta)).toHaveLength(0);
  });

  it("syncing BOTH services from a clean install settles, rather than growing on every run", () => {
    const vendas1 = importarPedidos(pedidosDaConta(conta), VENDAS_SEED, PRODUTOS_SEED, conta);
    const ads1 = importarAnuncios(relatoriosAdsDaConta(conta), ANUNCIOS_ADS_SEED, PRODUTOS_SEED, conta);
    const vendas = [...vendas1, ...VENDAS_SEED];
    const anuncios = [...ads1, ...ANUNCIOS_ADS_SEED];
    expect(importarPedidos(pedidosDaConta(conta), vendas, PRODUTOS_SEED, conta)).toHaveLength(0);
    expect(importarAnuncios(relatoriosAdsDaConta(conta), anuncios, PRODUTOS_SEED, conta)).toHaveLength(0);
  });
});

describe("Amazon Ads: ACOS / TACOS / desempenho (idea #12, Phase 11a)", () => {
  const anuncio = (over: Partial<AnuncioAds>): AnuncioAds => ({
    id: crypto.randomUUID(),
    produtoNome: "Produto",
    canal: "Amazon",
    data: "2026-06-01",
    custo: 100,
    faturamentoAds: 400,
    unidadesAds: 10,
    ...over,
  });

  it("ACOS is spend over the revenue the ads produced", () => {
    expect(acos(100, 400)).toBeCloseTo(0.25, 6);
  });
  it("TACOS is spend over ALL revenue, so it is never above ACOS", () => {
    expect(tacos(100, 1000)).toBeCloseTo(0.1, 6);
    expect(tacos(100, 1000)!).toBeLessThan(acos(100, 400)!);
  });
  it("both are null rather than Infinity when there is no revenue", () => {
    expect(acos(100, 0)).toBeNull();
    expect(tacos(100, 0)).toBeNull();
  });

  it("values organic units at the ads' own average price to reach total revenue", () => {
    // 10 ad units for 400 → 40 each; 30 organic units → 1200; total 1600
    const r = resumoAds([anuncio({ unidadesOrganicas: 30 })]);
    expect(r.faturamentoTotal).toBeCloseTo(1600, 6);
    expect(r.acos).toBeCloseTo(0.25, 6); // 100 / 400
    expect(r.tacos).toBeCloseTo(0.0625, 6); // 100 / 1600
  });

  it("reports the ads-vs-organic split and the click conversion", () => {
    const r = resumoAds([anuncio({ unidadesOrganicas: 30, cliques: 200 })]);
    expect(r.parcelaAds).toBeCloseTo(0.25, 6); // 10 of 40 units
    expect(r.conversao).toBeCloseTo(0.05, 6); // 10 units / 200 clicks
  });

  it("leaves conversion null when clicks were not recorded", () => {
    expect(resumoAds([anuncio({})]).conversao).toBeNull();
  });

  it("prices each entry's organic units at its own average, never a blended one", () => {
    // a cheap product and an expensive one: a single blended price would misvalue both
    const r = resumoAds([
      anuncio({ faturamentoAds: 1000, unidadesAds: 10, unidadesOrganicas: 10, custo: 0 }), // 100 each → 1000 organic
      anuncio({ faturamentoAds: 100, unidadesAds: 10, unidadesOrganicas: 10, custo: 0 }), // 10 each → 100 organic
    ]);
    expect(r.faturamentoTotal).toBeCloseTo(2200, 6); // 1000+1000 + 100+100
    // a blended average (1100/20 = 55) would have produced 1100 + 20×55 = 2200 here by luck,
    // so check an asymmetric split where the two differ
    const assimetrico = resumoAds([
      anuncio({ faturamentoAds: 1000, unidadesAds: 10, unidadesOrganicas: 0, custo: 0 }),
      anuncio({ faturamentoAds: 100, unidadesAds: 10, unidadesOrganicas: 20, custo: 0 }),
    ]);
    expect(assimetrico.faturamentoTotal).toBeCloseTo(1300, 6); // 1000 + (100 + 20×10)
  });

  it("sums several months of one product", () => {
    const r = resumoAds([
      anuncio({ custo: 100, faturamentoAds: 400, unidadesAds: 10, data: "2026-05-01" }),
      anuncio({ custo: 50, faturamentoAds: 100, unidadesAds: 2, data: "2026-06-01" }),
    ]);
    expect(r.custo).toBe(150);
    expect(r.faturamentoAds).toBe(500);
    expect(r.acos).toBeCloseTo(0.3, 6);
  });

  it("groups per product, biggest spender first, and keeps avulsos apart by name", () => {
    const linhas = desempenhoAds([
      anuncio({ produtoId: "p1", produtoNome: "Projetor", custo: 50 }),
      anuncio({ produtoId: "p1", produtoNome: "Projetor", custo: 70, sku: "SKU-1" }),
      anuncio({ produtoId: "p2", produtoNome: "Garrafa", custo: 200 }),
      anuncio({ produtoNome: "Item solto", custo: 10 }),
    ]);
    expect(linhas.map((l) => l.nome)).toEqual(["Garrafa", "Projetor", "Item solto"]);
    expect(linhas.find((l) => l.nome === "Projetor")!.custo).toBe(120);
    expect(linhas.find((l) => l.nome === "Projetor")!.sku).toBe("SKU-1");
  });

  it("scopes spend to a month for the Painel's cascade", () => {
    const lista = [
      anuncio({ custo: 100, data: "2026-06-11" }),
      anuncio({ custo: 40, data: "2026-05-11" }),
    ];
    expect(custoAds(lista, "2026-06")).toBe(100);
    expect(custoAds(lista)).toBe(140); // no month = everything
    expect(custoAds([], "2026-06")).toBe(0);
  });
});

describe("receitas operacionais + recorrência (Phase 10b)", () => {
  const custos: CustoOperacional[] = [
    { id: "1", nome: "Aluguel", categoria: "aluguel", valorMensal: 100 }, // legacy: no tipo, no recorrente
    { id: "2", nome: "Internet", categoria: "internet", valorMensal: 60, tipo: "despesa", recorrente: true },
    { id: "3", nome: "Contador extra", categoria: "contabilidade", valorMensal: 500, tipo: "despesa", recorrente: false, data: "2026-06-14" },
    { id: "4", nome: "Rendimento", categoria: "juros", valorMensal: 30, tipo: "receita", recorrente: true },
    { id: "5", nome: "Reembolso Amazon", categoria: "reembolso", valorMensal: 200, tipo: "receita", recorrente: false, data: "2026-06-20" },
  ];

  it("treats an entry with no tipo as a despesa (pre-10b data keeps its meaning)", () => {
    expect(resumoOperacional([custos[0]]).despesas).toBe(100);
    expect(resumoOperacional([custos[0]]).receitas).toBe(0);
  });

  it("without a month, reports the recurring run-rate only", () => {
    const r = resumoOperacional(custos);
    expect(r.despesas).toBe(160); // 100 + 60, the one-off 500 excluded
    expect(r.receitas).toBe(30); // the one-off 200 excluded
    expect(r.liquido).toBe(130);
  });

  it("adds a month's one-offs on top of the recurring entries", () => {
    const r = resumoOperacional(custos, "2026-06");
    expect(r.despesas).toBe(660); // 160 + 500
    expect(r.receitas).toBe(230); // 30 + 200
    expect(r.liquido).toBe(430);
  });

  it("ignores one-offs from other months", () => {
    expect(resumoOperacional(custos, "2026-07")).toEqual(resumoOperacional(custos));
  });

  it("lets operational income exceed overhead, giving a negative net", () => {
    const r = resumoOperacional([
      { id: "a", nome: "Internet", categoria: "internet", valorMensal: 60 },
      { id: "b", nome: "Rendimento", categoria: "juros", valorMensal: 250, tipo: "receita" },
    ]);
    expect(r.liquido).toBe(-190);
    expect(totalOperacional([
      { id: "a", nome: "Internet", categoria: "internet", valorMensal: 60 },
      { id: "b", nome: "Rendimento", categoria: "juros", valorMensal: 250, tipo: "receita" },
    ])).toBe(-190);
  });

  it("keeps despesas and receitas in separate category rankings", () => {
    const desp = custosPorCategoria(custos, "despesa", "2026-06");
    const rec = custosPorCategoria(custos, "receita", "2026-06");
    expect(desp.map((a) => a.categoria)).toEqual(["contabilidade", "aluguel", "internet"]);
    expect(rec.map((a) => a.categoria)).toEqual(["reembolso", "juros"]);
    // each ranking's shares are of its own tipo, so both sum to 1
    expect(desp.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 6);
    expect(rec.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 6);
  });

  it("defaults custosPorCategoria to despesas, so old callers are unaffected", () => {
    expect(custosPorCategoria(custos).map((a) => a.categoria)).toEqual(["aluguel", "internet"]);
  });
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

describe("daLoja (scoping every figure to one storefront)", () => {
  const itens = [
    { id: "a", lojaId: "loja-1" },
    { id: "b", lojaId: "loja-2" },
    { id: "c", lojaId: "loja-1" },
    { id: "d" }, // never assigned to a storefront
  ];

  it("returns everything under TODAS, untouched", () => {
    expect(daLoja(itens, TODAS_LOJAS)).toHaveLength(4);
  });

  it("keeps only the selected store's records", () => {
    expect(daLoja(itens, "loja-1").map((i) => i.id)).toEqual(["a", "c"]);
    expect(daLoja(itens, "loja-2").map((i) => i.id)).toEqual(["b"]);
  });

  /**
   * The property that stops a store's numbers quietly absorbing unassigned money: an untagged row
   * shows under "Todas" and nowhere else. Without this, selecting a store would inflate it by
   * whatever was never assigned.
   */
  it("never folds untagged records into a specific store", () => {
    expect(daLoja(itens, "loja-1").some((i) => i.lojaId === undefined)).toBe(false);
    expect(daLoja(itens, "loja-2").some((i) => i.lojaId === undefined)).toBe(false);
    expect(daLoja(itens, TODAS_LOJAS).some((i) => i.lojaId === undefined)).toBe(true);
  });

  it("gives an unknown store id nothing rather than everything", () => {
    expect(daLoja(itens, "loja-que-nao-existe")).toEqual([]);
  });
});

describe("produtosDaLoja (the catalogue a storefront actually trades)", () => {
  const produtos: Produto[] = [
    { id: "p1", nome: "Vendido", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
    { id: "p2", nome: "Comprado", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
    { id: "p3", nome: "Devolvido", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
    { id: "p4", nome: "Nunca movimentado", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
    { id: "p5", nome: "Só em compra cancelada", precoVenda: 100, vendasMes: 0, custoUnit: 40, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
  ];

  const vendas = [venda({ produtoId: "p1" })];
  const compras = [
    { id: "c1", produtoId: "p2", produtoNome: "Comprado", data: "2026-06-01T10:00", quantidade: 10, custoUnit: 5, status: "recebida" as const },
    { id: "c2", produtoId: "p5", produtoNome: "Cancelado", data: "2026-06-01T10:00", quantidade: 10, custoUnit: 5, status: "cancelada" as const },
  ];
  const devolucoes = [devolucao({ produtoId: "p3" })];

  it("keeps what the store sold, bought or had returned", () => {
    const r = produtosDaLoja(produtos, vendas, compras, devolucoes).map((p) => p.id);
    expect(r).toEqual(["p1", "p2", "p3"]);
  });

  /** A product nobody touched is not this store's problem — that is the point of scoping. */
  it("drops products with no movement at all", () => {
    expect(produtosDaLoja(produtos, vendas, compras, devolucoes).some((p) => p.id === "p4")).toBe(false);
  });

  /** A cancelled purchase never moved anything, so it cannot make a product belong to a store. */
  it("ignores cancelled purchases", () => {
    expect(produtosDaLoja(produtos, vendas, compras, devolucoes).some((p) => p.id === "p5")).toBe(false);
  });

  it("returns nothing when the store moved nothing", () => {
    expect(produtosDaLoja(produtos, [], [], [])).toEqual([]);
  });
});

describe("capitalEmEstoque (the parts must add up to the whole)", () => {
  const produtos: Produto[] = [
    { id: "p1", nome: "A", precoVenda: 100, vendasMes: 0, custoUnit: 10, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
    { id: "p2", nome: "B", precoVenda: 100, vendasMes: 0, custoUnit: 5, qtdCaixa: 10, imposto: 0.04, comissao: 0.15 },
  ];
  // p1 is stocked by BOTH storefronts — the case a per-product projection cannot add up
  const compras = [
    { id: "c1", lojaId: "l1", produtoId: "p1", produtoNome: "A", data: "2026-01-02T09:00", quantidade: 10, custoUnit: 10, status: "recebida" as const },
    { id: "c2", lojaId: "l2", produtoId: "p1", produtoNome: "A", data: "2026-01-02T09:00", quantidade: 4, custoUnit: 10, status: "recebida" as const },
    { id: "c3", lojaId: "l2", produtoId: "p2", produtoNome: "B", data: "2026-01-02T09:00", quantidade: 6, custoUnit: 5, status: "recebida" as const },
  ];

  const capital = (lojaId: string) =>
    capitalEmEstoque(produtos, daLoja(compras, lojaId), [], [], false);

  it("values the shelf at cost", () => {
    // l1: 10 un × R$10 = 100
    expect(capital("l1")).toBeCloseTo(100, 6);
    // l2: 4 × 10 + 6 × 5 = 70
    expect(capital("l2")).toBeCloseTo(70, 6);
  });

  /**
   * The whole point of the metric: a storefront total is a real slice of the company total, so
   * the slices sum to it. This is what the per-product projection could never do.
   */
  it("sums across storefronts to the company figure", () => {
    expect(capital("l1") + capital("l2")).toBeCloseTo(capital(TODAS_LOJAS), 6);
    expect(capital(TODAS_LOJAS)).toBeCloseTo(170, 6);
  });

  it("treats an oversold shelf as zero rather than negative money", () => {
    const vendas = [venda({ produtoId: "p1", quantidade: 999 })];
    expect(capitalEmEstoque(produtos, compras, vendas, [], false)).toBeCloseTo(30, 6); // only p2 left
  });
});

describe("taxaImpostoDaVenda (a sale is taxed where it landed)", () => {
  const produto: Produto = {
    id: "p1", nome: "P", precoVenda: 100, vendasMes: 0, custoUnit: 40,
    qtdCaixa: 10, imposto: 0.04, comissao: 0.15,
  };
  const cfg = { ...CONFIG_PADRAO, impostosPorPais: { BR: 0.04, DE: 0.19, US: 0 } };

  it("uses the destination country's rate", () => {
    expect(taxaImpostoDaVenda(venda({ pais: "DE" }), produto, cfg).taxa).toBeCloseTo(0.19, 6);
    expect(taxaImpostoDaVenda(venda({ pais: "DE" }), produto, cfg).pais).toBe("DE");
  });

  /**
   * The property the whole feature turns on: every product carries a domestic rate, so unless the
   * country wins an export is taxed as though it never left.
   */
  it("lets the country override the product's own rate", () => {
    const domestico = taxaImpostoDaVenda(venda({ pais: "BR" }), produto, cfg).taxa;
    const exportado = taxaImpostoDaVenda(venda({ pais: "DE" }), produto, cfg).taxa;
    expect(domestico).toBeCloseTo(produto.imposto, 6);
    expect(exportado).not.toBeCloseTo(produto.imposto, 6);
  });

  it("honours a configured zero rather than treating it as unset", () => {
    expect(taxaImpostoDaVenda(venda({ pais: "US" }), produto, cfg).taxa).toBe(0);
  });

  it("falls back to the product, then the global default", () => {
    expect(taxaImpostoDaVenda(venda({ pais: "JP" }), produto, cfg).taxa).toBeCloseTo(0.04, 6);
    expect(taxaImpostoDaVenda(venda({}), produto, cfg).taxa).toBeCloseTo(0.04, 6);
    expect(taxaImpostoDaVenda(venda({}), undefined, cfg).taxa).toBeCloseTo(cfg.imposto, 6);
  });

  it("carries through to the sale's waterfall", () => {
    const alemanha = detalharVenda(venda({ pais: "DE", valorTotal: 1000, quantidade: 1, produtoId: "p1" }), [produto], cfg);
    const brasil = detalharVenda(venda({ pais: "BR", valorTotal: 1000, quantidade: 1, produtoId: "p1" }), [produto], cfg);
    expect(alemanha.imposto).toBeCloseTo(190, 6);
    expect(brasil.imposto).toBeCloseTo(40, 6);
    expect(alemanha.lucro).toBeLessThan(brasil.lucro);
    // the line says which country's rate was applied, so an unexpected figure explains itself
    expect(alemanha.linhas.find((l) => l.chave === "imposto")?.nota).toContain("DE");
  });
});
