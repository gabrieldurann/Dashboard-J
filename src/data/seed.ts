import { IMPOSTO_PADRAO } from "../calc/constants";
import type { Produto } from "../calc/types";

// ⚠️ SAMPLE DATA ONLY — safe to be public.
// This file ships in the repo so the build/demo isn't empty for reviewers. It intentionally
// contains NO real products, costs, suppliers or links. Real internal data must never live here:
// enter it in the running app (it persists to your browser's localStorage and never touches Git),
// or keep it in a gitignored local file. See README / .gitignore (*.local.ts, *.xlsx).
//
// The four samples below are generic gadgets chosen to span the health bands
// (🔴 < 11% · 🟡 11–15% · 🟢 > 15%) so the UI demonstrates well.

const d = IMPOSTO_PADRAO;

export const PRODUTOS_SEED: Produto[] = [
  {
    id: "demo-1",
    codigoProduto: "DEMO-001",
    nome: "Mini Projetor Portátil",
    link: "https://example.com/produto/mini-projetor",
    fornecedor: "Fornecedor Exemplo A",
    dataPesquisa: "2026-05-02",
    precoVenda: 119.9,
    vendasMes: 25,
    custoUnit: 40,
    qtdCaixa: 30,
    imposto: d,
    comissao: 0.15,
    estoqueAtual: 24,
    aprovadoManual: null,
  },
  {
    id: "demo-2",
    codigoProduto: "DEMO-002",
    nome: "Garrafa Térmica Inox 1L",
    fornecedor: "Fornecedor Exemplo B",
    dataPesquisa: "2026-05-06",
    precoVenda: 49.9,
    vendasMes: 60,
    custoUnit: 22,
    qtdCaixa: 80,
    imposto: d,
    comissao: 0.13,
    estoqueAtual: 70,
    aprovadoManual: null,
  },
  {
    id: "demo-3",
    codigoProduto: "DEMO-003",
    nome: "Organizador de Cabos (kit 5)",
    link: "https://example.com/produto/organizador-cabos",
    fornecedor: "Fornecedor Exemplo B",
    dataPesquisa: "2026-05-09",
    precoVenda: 39.9,
    vendasMes: 45,
    custoUnit: 21.5,
    qtdCaixa: 100,
    imposto: d,
    comissao: 0.15,
    estoqueAtual: 90,
    aprovadoManual: null,
  },
  {
    id: "demo-4",
    codigoProduto: "DEMO-004",
    nome: "Suporte de Copo Veicular",
    fornecedor: "Fornecedor Exemplo C",
    dataPesquisa: "2026-05-11",
    precoVenda: 29.9,
    vendasMes: 90,
    custoUnit: 16,
    qtdCaixa: 150,
    imposto: d,
    comissao: 0.15,
    estoqueAtual: 140,
    aprovadoManual: null,
  },
];
