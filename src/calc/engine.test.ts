import { describe, expect, it } from "vitest";
import {
  calcularMetricas,
  capitalParaEstoque,
  custosPorCategoria,
  freteUnitario,
  totalOperacional,
  preencherMeses,
  precoParaMargem,
  resultadoVendas,
  resumoPeriodo,
  serieMensal,
  statusCor,
  totaisPortfolio,
  vendasPorAno,
  vendasPorDia,
  vendasPorMes,
  vendasPorPais,
} from "./engine";
import type { CustoOperacional, Produto, Venda } from "./types";

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
