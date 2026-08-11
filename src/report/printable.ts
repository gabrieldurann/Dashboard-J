// Builds clean, light-themed printable documents and opens the browser print dialog
// (→ "Salvar como PDF"). Lean approach — no PDF library (idea #20). The dark app UI stays intact;
// we render a separate light document optimised for paper.
//
// Everything printed here is REALIZED. Nothing on paper may come from the catalogue's projected
// velocity: a document someone hands to a partner or an accountant has to survive being checked
// against the bank, and a projection cannot.

import type { StatusCor } from "../calc/constants";
import type { AggCanal, AggMotivo, DesempenhoProduto, DRE, LinhaDRE } from "../calc/engine";
import { money, percent } from "../i18n/format";
import { MOTIVO_LABEL } from "../i18n/labels";

export type DadosRelatorio = {
  geradoEm: Date;
  mes: string;
  dre: DRE;
  unidades: number;
  ticketMedio: number;
  topProdutos: DesempenhoProduto[];
  noVermelho: DesempenhoProduto[];
  canais: AggCanal[];
  devolucoes: { registros: number; unidades: number; reembolso: number; taxa: number; motivos: AggMotivo[] };
  estoque: { unidades: number; capital: number };
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (mes: string) => {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} de ${ano}`;
};

const ESTILO = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #14181f; margin: 40px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #5a6678; margin: 26px 0 10px; border-bottom: 1px solid #e3e7ee; padding-bottom: 6px; }
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
  .aviso { border: 1px solid #e8c98a; background: #fdf6e7; border-radius: 10px; padding: 10px 13px; font-size: 11.5px; color: #6b5a2e; margin-bottom: 14px; }
  .dre td.desc { padding-left: 8px; }
  .dre tr.sub td { background: #f6f8fb; font-weight: 600; }
  .dre tr.fim td { background: #eef7f2; font-weight: 700; font-size: 13px; }
  .dre td.item { padding-left: 26px; color: #5a6678; }
  .foot { margin-top: 30px; font-size: 10px; color: #9aa3b2; }
  @media print { body { margin: 16mm; } @page { margin: 0; } }
`;

const documento = (titulo: string, corpo: string) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>${corpo}</body></html>`;

const cabecalho = (linha: string, geradoEm: Date) => `
  <h1 class="brand">Painel <b>J</b></h1>
  <div class="sub">${esc(linha)} · gerado em ${esc(geradoEm.toLocaleString("pt-BR"))}</div>`;

const stat = (label: string, valor: string) =>
  `<div class="stat"><span class="k">${esc(label)}</span><span class="v">${esc(valor)}</span></div>`;

/** Opens the document in a print window. Returns false if the browser blocked the popup. */
export function abrirImpressao(html: string): boolean {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
  return true;
}

// ─── DRE ─────────────────────────────────────────────────────────────────────

const sinalDRE = (l: LinhaDRE) =>
  l.tipo === "deducao" || l.tipo === "custo" || l.tipo === "despesa" ? -1 : 1;

function tabelaDRE(d: DRE, anterior: DRE | null): string {
  const linhas = d.linhas
    .map((l) => {
      // nesting, not sign, decides the shape of a row: level 0 is a headline or a subtotal,
      // level 1 is a component sitting under it
      const cabeca = l.nivel === 0;
      const classe = l.chave === "lucroLiquido" ? "fim" : cabeca ? "sub" : "";
      const antes = anterior?.linhas.find((x) => x.chave === l.chave);
      const varia = antes && antes.valor !== 0 ? (l.valor - antes.valor) / Math.abs(antes.valor) : null;
      const desc = cabeca
        ? `<td class="desc">${esc(l.label)}${l.nota ? ` <span style="font-weight:400;color:#6b7686">· ${esc(l.nota)}</span>` : ""}</td>`
        : `<td class="item">${sinalDRE(l) < 0 ? "(−)" : "(+)"} ${esc(l.label)}${l.nota ? ` <span style="color:#9aa3b2">· ${esc(l.nota)}</span>` : ""}</td>`;
      return `<tr class="${classe}">
        ${desc}
        <td class="num">${money(l.valor * sinalDRE(l))}</td>
        <td class="num">${percent(l.vertical)}</td>
        ${anterior ? `<td class="num">${varia === null ? "—" : `${varia > 0 ? "+" : ""}${percent(varia)}`}</td>` : ""}
      </tr>`;
    })
    .join("");

  return `<table class="dre">
    <thead><tr>
      <th>Descrição</th><th class="num">Valor</th><th class="num">AV</th>
      ${anterior ? `<th class="num">vs. ${esc(nomeMes(anterior.mes))}</th>` : ""}
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

const avisoSemCusto = (d: DRE) =>
  d.receitaSemCusto > 0
    ? `<div class="aviso"><b>${money(d.receitaSemCusto)}</b> de receita sem produto vinculado: esse faturamento entrou, mas nenhum custo foi deduzido por ele — o lucro bruto está superestimado nesse valor.</div>`
    : "";

const RODAPE_DRE =
  "Painel J · uso interno · dados locais. Valores realizados a partir do livro de vendas — nenhuma projeção. O frete aparece abaixo do lucro bruto por ser custo de venda, não de aquisição.";

export function dreHTML(d: DRE, anterior: DRE | null, geradoEm: Date): string {
  return documento(
    `DRE ${d.mes} — Painel J`,
    `${cabecalho(`Demonstração do resultado · ${nomeMes(d.mes)}`, geradoEm)}
     <h2>Resultado de ${esc(nomeMes(d.mes))}</h2>
     ${avisoSemCusto(d)}
     ${tabelaDRE(d, anterior)}
     <div class="foot">${RODAPE_DRE}</div>`,
  );
}

// ─── Relatório mensal ────────────────────────────────────────────────────────

function tabelaProdutos(linhas: DesempenhoProduto[], vazio: string): string {
  if (linhas.length === 0) return `<p class="empty">${esc(vazio)}</p>`;
  const rows = linhas
    .map(
      (l) => `<tr>
        <td>${esc(l.nome)}</td>
        <td class="num">${l.unidades}</td>
        <td class="num">${money(l.bruto)}</td>
        <td class="num ${l.statusCor === "verde" ? "g" : l.statusCor === "amarelo" ? "y" : "r"}">${percent(l.margem)}</td>
        <td class="num">${money(l.lucro)}</td>
      </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr><th>Produto</th><th class="num">Un.</th><th class="num">Faturamento</th><th class="num">Margem</th><th class="num">Lucro</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function relatorioHTML(d: DadosRelatorio, anterior: DRE | null): string {
  const canais =
    d.canais.length === 0
      ? `<p class="empty">Sem vendas no período.</p>`
      : `<table><thead><tr><th>Canal</th><th class="num">Pedidos</th><th class="num">Faturamento</th><th class="num">Part.</th></tr></thead><tbody>${d.canais
          .map(
            (c) => `<tr><td>${esc(c.canal)}</td><td class="num">${c.pedidos}</td><td class="num">${money(c.valor)}</td><td class="num">${percent(c.share)}</td></tr>`,
          )
          .join("")}</tbody></table>`;

  const motivos =
    d.devolucoes.motivos.length === 0
      ? `<p class="empty">Nenhuma devolução no período.</p>`
      : `<table><thead><tr><th>Motivo</th><th class="num">Registros</th><th class="num">Unidades</th><th class="num">Reembolso</th></tr></thead><tbody>${d.devolucoes.motivos
          .map(
            (m) => `<tr><td>${esc(MOTIVO_LABEL[m.motivo])}</td><td class="num">${m.registros}</td><td class="num">${m.unidades}</td><td class="num">${money(m.reembolso)}</td></tr>`,
          )
          .join("")}</tbody></table>`;

  return documento(
    `Relatório ${d.mes} — Painel J`,
    `${cabecalho(`Relatório mensal · ${nomeMes(d.mes)}`, d.geradoEm)}

     <h2>O mês em números</h2>
     ${avisoSemCusto(d.dre)}
     <div class="grid">
       ${stat("Faturamento bruto", money(d.dre.receitaBruta))}
       ${stat("Lucro líquido", money(d.dre.lucroLiquido))}
       ${stat("Margem líquida", percent(d.dre.margemLiquida))}
       ${stat("Pedidos", String(d.dre.pedidos))}
       ${stat("Unidades vendidas", String(d.unidades))}
       ${stat("Ticket médio", money(d.ticketMedio))}
       ${stat("Devoluções", money(d.devolucoes.reembolso))}
       ${stat("Taxa de devolução", percent(d.devolucoes.taxa))}
       ${stat("Capital em estoque", money(d.estoque.capital))}
     </div>

     <h2>Resultado do mês (DRE)</h2>
     ${tabelaDRE(d.dre, anterior)}

     <h2>Produtos que mais deram lucro</h2>
     ${tabelaProdutos(d.topProdutos, "Nenhuma venda atribuída a produto no período.")}

     <h2>Produtos no vermelho (margem realizada)</h2>
     ${tabelaProdutos(d.noVermelho, "Nenhum produto abaixo da faixa mínima. ✓")}

     <h2>Faturamento por canal</h2>
     ${canais}

     <h2>Devoluções por motivo</h2>
     ${motivos}

     <div class="foot">${RODAPE_DRE}</div>`,
  );
}

// ─── Projeção do catálogo ────────────────────────────────────────────────────
//
// The old Relatórios, kept deliberately as a SEPARATE document rather than mixed into the one
// above. It answers "what would a month look like if every product sold at the pace registered
// on it?" — useful for spotting the gap against reality, ruinous if mistaken for reality. Every
// label here says "projetado", and the comparison block makes the gap the point.

export type LinhaProjecao = {
  nome: string;
  precoVenda: number;
  margem: number;
  lucroMensal: number;
  statusCor: StatusCor;
};

export type DadosProjecao = {
  geradoEm: Date;
  /** the realized month the projection is being held up against */
  mes: string;
  receitaMensal: number;
  lucroMensal: number;
  custoMensal: number;
  impostoMensal: number;
  capitalEstoque: number;
  margemMedia: number;
  totalProdutos: number;
  aprovados: number;
  cores: { verde: number; amarelo: number; vermelho: number };
  melhores: LinhaProjecao[];
  reavaliar: LinhaProjecao[];
  /** the same month's realized figures, so the two can be read side by side */
  real: { receita: number; lucro: number; margem: number };
};

function tabelaProjecao(linhas: LinhaProjecao[], vazio: string): string {
  if (linhas.length === 0) return `<p class="empty">${esc(vazio)}</p>`;
  const rows = linhas
    .map(
      (l) => `<tr>
        <td>${esc(l.nome)}</td>
        <td class="num">${money(l.precoVenda)}</td>
        <td class="num ${l.statusCor === "verde" ? "g" : l.statusCor === "vermelho" ? "r" : "y"}">${percent(l.margem)}</td>
        <td class="num">${money(l.lucroMensal)}</td>
      </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr><th>Produto</th><th class="num">Preço</th><th class="num">Margem projetada</th><th class="num">Lucro projetado/mês</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

const comparativo = (d: DadosProjecao) => {
  const linha = (rotulo: string, proj: number, real: number, fmt: (n: number) => string) => {
    const dif = proj - real;
    return `<tr>
      <td>${esc(rotulo)}</td>
      <td class="num">${fmt(proj)}</td>
      <td class="num">${fmt(real)}</td>
      <td class="num ${dif > 0 ? "r" : "g"}">${dif > 0 ? "−" : "+"}${fmt(Math.abs(dif))}</td>
    </tr>`;
  };
  return `<table>
    <thead><tr><th>&nbsp;</th><th class="num">Projetado</th><th class="num">Realizado em ${esc(nomeMes(d.mes))}</th><th class="num">Diferença</th></tr></thead>
    <tbody>
      ${linha("Receita", d.receitaMensal, d.real.receita, money)}
      ${linha("Lucro", d.lucroMensal, d.real.lucro, money)}
      ${linha("Margem", d.margemMedia, d.real.margem, percent)}
    </tbody>
  </table>`;
};

export function projecaoHTML(d: DadosProjecao): string {
  return documento(
    `Projeção do catálogo — Painel J`,
    `${cabecalho("Projeção do catálogo · não é resultado realizado", d.geradoEm)}

     <div class="aviso"><b>Isto é uma projeção, não o que aconteceu.</b> Os valores abaixo supõem
     que cada produto venda exatamente a quantidade cadastrada em “vendas/mês”, com o preço e o
     custo cadastrados. Servem para comparar com o real e decidir o que ajustar — nunca para
     prestar contas. O resultado realizado está no relatório mensal e na DRE.</div>

     <h2>Projetado × realizado</h2>
     ${comparativo(d)}

     <h2>Projeção mensal do catálogo</h2>
     <div class="grid">
       ${stat("Receita projetada / mês", money(d.receitaMensal))}
       ${stat("Lucro projetado / mês", money(d.lucroMensal))}
       ${stat("Custo projetado / mês", money(d.custoMensal))}
       ${stat("Imposto projetado / mês", money(d.impostoMensal))}
       ${stat("Capital em estoque (cadastro)", money(d.capitalEstoque))}
       ${stat("Margem média projetada", percent(d.margemMedia))}
       ${stat("Produtos", String(d.totalProdutos))}
       ${stat("Aprovados", String(d.aprovados))}
       ${stat("Ótimo / Melhorar / Re-avaliar", `${d.cores.verde} / ${d.cores.amarelo} / ${d.cores.vermelho}`)}
     </div>

     <h2>Melhores margens projetadas</h2>
     ${tabelaProjecao(d.melhores, "Nenhum produto cadastrado.")}

     <h2>Para re-avaliar (margem projetada abaixo da faixa)</h2>
     ${tabelaProjecao(d.reavaliar, "Tudo dentro da meta.")}

     <div class="foot">Painel J · uso interno · dados locais. Projeção calculada a partir do cadastro de produtos (preço × vendas/mês), não do livro de vendas.</div>`,
  );
}
