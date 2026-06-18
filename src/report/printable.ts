// Builds a clean, light-themed printable report and opens the browser print dialog
// (→ "Salvar como PDF"). Lean approach — no PDF library (idea #20). The dark app UI stays intact;
// we render a separate light document optimised for paper.

import { totaisPortfolio } from "../calc/engine";
import { money, percent } from "../i18n/format";

type Linha = { nome: string; precoVenda: number; margem: number; lucroMensal: number };

export type DadosRelatorio = {
  geradoEm: Date;
  totais: ReturnType<typeof totaisPortfolio>;
  aprovados: number;
  melhores: Linha[];
  reavaliar: Linha[];
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function statRow(label: string, value: string) {
  return `<div class="stat"><span class="k">${label}</span><span class="v">${value}</span></div>`;
}

function tabela(linhas: Linha[], corMargem: boolean) {
  if (linhas.length === 0) return `<p class="empty">Nenhum item.</p>`;
  const rows = linhas
    .map(
      (l) => `<tr>
        <td>${esc(l.nome)}</td>
        <td class="num">${money(l.precoVenda)}</td>
        <td class="num ${corMargem ? (l.margem > 0.15 ? "g" : l.margem < 0.11 ? "r" : "y") : ""}">${percent(l.margem)}</td>
        <td class="num">${money(l.lucroMensal)}</td>
      </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr><th>Produto</th><th class="num">Preço</th><th class="num">Margem</th><th class="num">Lucro/mês</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function gerarRelatorioHTML(d: DadosRelatorio): string {
  const t = d.totais;
  const data = d.geradoEm.toLocaleString("pt-BR");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório Painel J — ${esc(data)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #14181f; margin: 40px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #5a6678; margin: 28px 0 10px; border-bottom: 1px solid #e3e7ee; padding-bottom: 6px; }
  .brand { color: #1aa06b; } .brand b { color: #c79a2e; }
  .sub { color: #6b7686; font-size: 12px; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stat { border: 1px solid #e3e7ee; border-radius: 10px; padding: 12px 14px; }
  .stat .k { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6b7686; }
  .stat .v { display: block; font-size: 18px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef1f6; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6b7686; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .g { color: #1aa06b; } .y { color: #b5841a; } .r { color: #d23c47; }
  .empty { color: #9aa3b2; font-size: 12px; }
  .foot { margin-top: 32px; font-size: 10px; color: #9aa3b2; }
  @media print { body { margin: 18mm; } @page { margin: 0; } }
</style></head><body>
  <h1 class="brand">Painel <b>J</b></h1>
  <div class="sub">Relatório de estoque & vendas · gerado em ${esc(data)}</div>

  <h2>Resumo geral (mensal)</h2>
  <div class="grid">
    ${statRow("Receita / mês", money(t.receitaMensal))}
    ${statRow("Lucro / mês", money(t.lucroMensal))}
    ${statRow("Custo / mês", money(t.custoMensal))}
    ${statRow("Imposto / mês", money(t.impostoMensal))}
    ${statRow("Capital em estoque", money(t.capitalEstoque))}
    ${statRow("Margem média", percent(t.margemMedia))}
    ${statRow("Produtos", String(t.totalProdutos))}
    ${statRow("Aprovados (≥15%)", String(d.aprovados))}
    ${statRow("Ótimo / Melhorar / Re-avaliar", `${t.cores.verde} / ${t.cores.amarelo} / ${t.cores.vermelho}`)}
  </div>

  <h2>Melhores margens</h2>
  ${tabela(d.melhores, true)}

  <h2>Para re-avaliar (margem abaixo de 11%)</h2>
  ${tabela(d.reavaliar, true)}

  <div class="foot">Painel J · uso interno · dados locais. Margem = lucro ÷ preço de venda, já com imposto, comissão e frete.</div>
</body></html>`;
}
