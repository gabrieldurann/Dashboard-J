import { describe, expect, it } from "vitest";
import {
  calcularMetricas,
  capitalParaEstoque,
  freteUnitario,
  precoParaMargem,
  statusCor,
  totaisPortfolio,
} from "./engine";
import type { Produto } from "./types";

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
