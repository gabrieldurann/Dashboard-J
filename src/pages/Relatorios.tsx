import { AlertTriangle, Coins, FileDown, Package, Percent, Receipt, RotateCcw, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  calcularMetricas,
  desempenhoProdutos,
  devolucoesPorMotivo,
  dre,
  estoqueProdutos,
  faixasDesempenho,
  mesesComVendas,
  resumoDevolucoes,
  taxaDevolucao,
  totaisPortfolio,
  vendasPorCanal,
} from "../calc/engine";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, percent } from "../i18n/format";
import { MOTIVO_LABEL } from "../i18n/labels";
import {
  abrirImpressao,
  nomeMes,
  projecaoHTML,
  relatorioHTML,
  type DadosProjecao,
  type DadosRelatorio,
  type LinhaProjecao,
} from "../report/printable";
import { toast } from "../store/useToast";
import { useConfig } from "../store/useConfig";
import { useStore } from "../store/useStore";

/**
 * The month's report: what actually happened, and nothing else.
 *
 * Two modes, and keeping them apart is the whole design:
 *
 * **Realizado** — everything from the ledgers, so the printed PDF can be checked against the bank.
 * **Projetado** — the catalogue's run-rate (preço × vendas/mês registered per product).
 *
 * The page originally showed the projection alone, under labels like "Lucro / mês", which
 * disagreed with the Painel's realized figure for the same month: two screens, same words,
 * different numbers. The projection is genuinely useful — it is how you see you are selling below
 * the pace you planned — but only when it is unmistakably labelled and shown against the real
 * figures. Hence a mode switch rather than one blended page, separate wording on every label, and
 * a PDF per mode that states which one it is.
 */
type Modo = "realizado" | "projetado";
export function Relatorios() {
  const cfg = useConfig();
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);
  const devolucoes = useStore((s) => s.devolucoes);
  const compras = useStore((s) => s.compras);
  const custosOperacionais = useStore((s) => s.custosOperacionais);
  const anuncios = useStore((s) => s.anunciosAds);

  const meses = useMemo(() => mesesComVendas(vendas), [vendas]);
  const [mes, setMes] = useState("");
  const mesAtivo = meses.includes(mes) ? mes : meses[0];
  const [modo, setModo] = useState<Modo>("realizado");

  /**
   * The catalogue's run-rate: what a month would look like if every product sold exactly the
   * quantity registered on it. Kept strictly apart from the realized view — mixing the two under
   * shared labels is what made the old page misleading — and only ever shown next to the real
   * figures, because the gap between them is the only reason to look at it.
   */
  const projecao = useMemo(() => {
    const totais = totaisPortfolio(produtos, cfg);
    const comMetricas = produtos.map((p) => ({ p, m: calcularMetricas(p, cfg) }));
    const linha = ({ p, m }: (typeof comMetricas)[number]) => ({
      nome: p.nome,
      precoVenda: p.precoVenda,
      margem: m.margem,
      lucroMensal: m.lucroMensal,
      // carried through so "melhores margens" can't paint a red-band product green just for
      // being the best of a bad set
      statusCor: m.statusCor,
    });
    return {
      totais,
      aprovados: comMetricas.filter((x) => x.m.aprovado).length,
      melhores: [...comMetricas].sort((a, b) => b.m.margem - a.m.margem).slice(0, 5).map(linha),
      reavaliar: comMetricas
        .filter((x) => x.m.statusCor === "vermelho")
        .sort((a, b) => a.m.margem - b.m.margem)
        .map(linha),
    };
  }, [produtos, cfg]);

  const dados = useMemo(() => {
    if (!mesAtivo) return null;
    const fontes = { vendas, produtos, devolucoes, custosOperacionais, anuncios };
    const doMes = vendas.filter((v) => v.data.slice(0, 7) === mesAtivo && v.status !== "cancelado");
    const devsDoMes = devolucoes.filter((d) => d.data.slice(0, 7) === mesAtivo);

    const statement = dre(fontes, mesAtivo, cfg);
    const anteriorChave = meses[meses.indexOf(mesAtivo) + 1];
    const anterior = anteriorChave ? dre(fontes, anteriorChave, cfg) : null;

    const porProduto = desempenhoProdutos(doMes, produtos, cfg);
    const faixas = faixasDesempenho(porProduto);
    const unidades = doMes.reduce((t, v) => t + v.quantidade, 0);
    const resumoDev = resumoDevolucoes(devsDoMes);

    // Stock is a position, not a flow: it is whatever is on the shelf now, not "in this month".
    const estoqueMap = estoqueProdutos(produtos, compras, vendas, devolucoes);
    let unidadesEstoque = 0;
    let capital = 0;
    for (const p of produtos) {
      const e = estoqueMap.get(p.id);
      if (!e) continue;
      unidadesEstoque += e.atual;
      capital += e.atual * p.custoUnit;
    }

    return {
      statement,
      anterior,
      unidades,
      ticketMedio: doMes.length > 0 ? statement.receitaBruta / doMes.length : 0,
      topProdutos: [...porProduto].sort((a, b) => b.lucro - a.lucro).slice(0, 5),
      noVermelho: faixas.vermelho,
      canais: vendasPorCanal(doMes),
      devolucoes: {
        ...resumoDev,
        taxa: taxaDevolucao(devsDoMes, doMes),
        motivos: devolucoesPorMotivo(devsDoMes),
      },
      estoque: { unidades: unidadesEstoque, capital },
    };
  }, [vendas, produtos, devolucoes, compras, custosOperacionais, anuncios, meses, mesAtivo, cfg]);

  if (!dados)
    return (
      <Screen eyebrow="Resumo" title="Relatórios">
        <GlowCard>
          <p className="py-12 text-center text-sm text-txtDim">
            Nenhuma venda registrada ainda — não há mês para relatar.
          </p>
        </GlowCard>
      </Screen>
    );

  const gerar = () => {
    const html =
      modo === "realizado"
        ? relatorioHTML(
            {
              geradoEm: new Date(),
              mes: mesAtivo,
              dre: dados.statement,
              unidades: dados.unidades,
              ticketMedio: dados.ticketMedio,
              topProdutos: dados.topProdutos,
              noVermelho: dados.noVermelho,
              canais: dados.canais,
              devolucoes: dados.devolucoes,
              estoque: dados.estoque,
            } satisfies DadosRelatorio,
            dados.anterior,
          )
        : projecaoHTML({
            geradoEm: new Date(),
            mes: mesAtivo,
            ...projecao.totais,
            aprovados: projecao.aprovados,
            melhores: projecao.melhores,
            reavaliar: projecao.reavaliar,
            real: {
              receita: dados.statement.receitaBruta,
              lucro: dados.statement.lucroLiquido,
              margem: dados.statement.margemLiquida,
            },
          } satisfies DadosProjecao);
    if (!abrirImpressao(html))
      toast.error("O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.");
  };

  const d = dados.statement;

  return (
    <Screen
      eyebrow="Resumo"
      title="Relatórios"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* two documents, never one blended page */}
          <div className="flex rounded-chip border border-line bg-panel p-1">
            {(["realizado", "projetado"] as Modo[]).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`rounded-chip px-3 py-1.5 font-mono text-xs capitalize transition-colors ${
                  modo === m ? "bg-greenSoft text-txt" : "text-txtDim hover:text-txt"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Mês</span>
            <select
              value={mesAtivo}
              onChange={(e) => setMes(e.target.value)}
              className="bg-transparent font-mono text-sm text-txt outline-none"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={gerar}
            className="flex items-center gap-2 rounded-chip border border-lineStrong bg-goldSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
          >
            <FileDown size={16} /> {modo === "realizado" ? "Gerar relatório (PDF)" : "Gerar projeção (PDF)"}
          </button>
        </div>
      }
    >
      {modo === "projetado" && (
        <Projecao
          projecao={projecao}
          real={{
            receita: d.receitaBruta,
            lucro: d.lucroLiquido,
            margem: d.margemLiquida,
            mes: mesAtivo,
          }}
        />
      )}

      {modo === "realizado" && d.receitaSemCusto > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-amber/40 bg-amberSoft px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-sm leading-relaxed text-txtDim">
            <strong className="text-amber">{money(d.receitaSemCusto)}</strong> de receita sem
            produto vinculado neste mês — entrou faturamento sem custo correspondente, então o
            lucro abaixo está melhor do que a realidade.
          </p>
        </div>
      )}

      <div className={`grid grid-cols-12 gap-4 ${modo === "realizado" ? "" : "hidden"}`}>
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Faturamento bruto" value={d.receitaBruta} format={money} icon={TrendingUp} accent="gold" />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Lucro líquido" value={d.lucroLiquido} format={money} icon={Coins} delay={0.05} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Margem líquida" value={d.margemLiquida} format={percent} icon={Percent} delay={0.1} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Pedidos" value={d.pedidos} format={(v) => String(v)} icon={Receipt} delay={0.15} />

        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Unidades vendidas" value={dados.unidades} format={(v) => String(v)} icon={Package} delay={0.2} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Ticket médio" value={dados.ticketMedio} format={money} icon={Receipt} delay={0.25} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Devoluções" value={dados.devolucoes.reembolso} format={money} icon={RotateCcw} accent="red" delay={0.3} footnote={`taxa ${percent(dados.devolucoes.taxa)}`} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Capital em estoque" value={dados.estoque.capital} format={money} icon={Wallet} accent="gold" delay={0.35} footnote={`${dados.estoque.unidades} un. em estoque`} />

        {/* condensed statement — the full one lives on the DRE page */}
        <GlowCard className="col-span-12 lg:col-span-7" delay={0.4}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Resultado do mês</span>
            <Link to="/dre" className="font-mono text-[11px] text-txtFaint transition-colors hover:text-txt">
              ver DRE completo →
            </Link>
          </div>
          <dl className="divide-y divide-line">
            {[
              ["Receita bruta", d.receitaBruta, "text-txt"],
              ["(−) Impostos, comissões e devoluções", -d.deducoes, "text-txtDim"],
              ["Receita líquida", d.receitaLiquida, "text-txt"],
              ["(−) Custo das mercadorias", -(d.cmv + d.embalagem), "text-txtDim"],
              ["Lucro bruto", d.lucroBruto, "text-txt"],
              ["(−) Frete, anúncios e operacional", -(d.frete + d.ads + d.despesasOperacionais - d.receitasOperacionais), "text-txtDim"],
            ].map(([label, valor, cor]) => (
              <div key={label as string} className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-txtDim">{label as string}</dt>
                <dd className={`font-mono text-sm tabular-nums ${cor as string}`}>{money(valor as number)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 pt-3">
              <dt className="font-display text-sm text-txt">Lucro líquido</dt>
              <dd className={`font-mono text-lg tabular-nums ${d.lucroLiquido < 0 ? "text-danger" : "text-green"}`}>
                {money(d.lucroLiquido)}
              </dd>
            </div>
          </dl>
        </GlowCard>

        {/* channels */}
        <GlowCard className="col-span-12 lg:col-span-5" delay={0.45}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Faturamento por canal</span>
          {dados.canais.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">Sem vendas no período.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {dados.canais.map((c) => (
                <li key={c.canal}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-txt">{c.canal}</span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-txtDim">
                      {money(c.valor)} <span className="text-txtFaint">· {percent(c.share)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bgRaise">
                    <div className="h-full rounded-full bg-green" style={{ width: `${c.share * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        {/* best performers, realized */}
        <GlowCard className="col-span-12 lg:col-span-6" delay={0.5}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Produtos que mais deram lucro</span>
          {dados.topProdutos.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">Nenhuma venda atribuída a produto no período.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dados.topProdutos.map((p) => (
                <li key={p.produtoId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <StatusDot cor={p.statusCor} />
                    <span className="truncate text-sm text-txt">{p.nome}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 font-mono text-sm tabular-nums">
                    <span className="text-txtFaint">{percent(p.margem)}</span>
                    <span className="text-txt">{money(p.lucro)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        {/* red band, realized */}
        <GlowCard className="col-span-12 lg:col-span-6" delay={0.55}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            No vermelho · margem realizada
          </span>
          {dados.noVermelho.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">
              Tudo dentro da meta. <span className="text-green">✓</span>
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {dados.noVermelho.map((p) => (
                <li key={p.produtoId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <StatusDot cor="vermelho" />
                    <span className="truncate text-sm text-txt">{p.nome}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 font-mono text-sm tabular-nums">
                    <span className="text-danger">{percent(p.margem)}</span>
                    <span className="text-txtDim">{money(p.lucro)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        {/* returns */}
        {dados.devolucoes.motivos.length > 0 && (
          <GlowCard className="col-span-12" delay={0.6}>
            <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
              Devoluções por motivo · {dados.devolucoes.registros}{" "}
              {dados.devolucoes.registros === 1 ? "registro" : "registros"} no mês
            </span>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dados.devolucoes.motivos.map((m) => (
                <div key={m.motivo}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-txt">{MOTIVO_LABEL[m.motivo]}</span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-danger">{money(m.reembolso)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bgRaise">
                    <div className="h-full rounded-full bg-danger" style={{ width: `${m.share * 100}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-txtFaint">
                    {m.registros} · {m.unidades} un.
                  </p>
                </div>
              ))}
            </div>
          </GlowCard>
        )}
      </div>

      {modo === "realizado" && (
        <p className="mt-4 font-mono text-[11px] leading-relaxed text-txtFaint">
          Todos os números vêm dos lançamentos reais do mês — nada aqui é projeção do cadastro. Para
          estimativas use a Calculadora ou Simulações.
        </p>
      )}
    </Screen>
  );
}

/**
 * The catalogue's run-rate, and the gap against what really happened.
 *
 * The comparison comes FIRST on purpose: on its own the projection is the number that once made
 * this page misleading, so it is never shown without the real figure beside it.
 */
function Projecao({
  projecao,
  real,
}: {
  projecao: {
    totais: ReturnType<typeof totaisPortfolio>;
    aprovados: number;
    melhores: LinhaProjecao[];
    reavaliar: LinhaProjecao[];
  };
  real: { receita: number; lucro: number; margem: number; mes: string };
}) {
  const t = projecao.totais;
  const linhas: [string, number, number, (n: number) => string][] = [
    ["Receita", t.receitaMensal, real.receita, money],
    ["Lucro", t.lucroMensal, real.lucro, money],
    ["Margem", t.margemMedia, real.margem, percent],
  ];

  return (
    <>
      <div className="grid grid-cols-12 gap-4">
        <GlowCard accent="gold" className="col-span-12">
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            Projetado × realizado · {nomeMes(real.mes)}
          </span>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["", "Projetado", "Realizado", "Diferença"].map((h, i) => (
                    <th
                      key={h || i}
                      className={`whitespace-nowrap px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint ${i > 0 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(([rotulo, proj, atual, fmt]) => {
                  const dif = proj - atual;
                  return (
                    <tr key={rotulo} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2.5 text-sm text-txt">{rotulo}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-sm tabular-nums text-txtDim">{fmt(proj)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-sm tabular-nums text-txt">{fmt(atual)}</td>
                      {/* falling short of the plan is the bad direction, whatever the sign */}
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono text-sm tabular-nums ${dif > 0 ? "text-danger" : "text-green"}`}>
                        {dif > 0 ? "−" : "+"}
                        {fmt(Math.abs(dif))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-txtFaint">
            Vermelho = o real ficou abaixo do projetado. Ou o ritmo cadastrado está otimista, ou há
            venda a recuperar.
          </p>
        </GlowCard>

        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Receita projetada / mês" value={t.receitaMensal} format={money} icon={TrendingUp} accent="gold" delay={0.05} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Lucro projetado / mês" value={t.lucroMensal} format={money} icon={Coins} delay={0.1} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Custo projetado / mês" value={t.custoMensal} format={money} icon={Package} accent="red" delay={0.15} />
        <MetricTile className="col-span-6 h-full lg:col-span-3" dense label="Margem média projetada" value={t.margemMedia} format={percent} icon={Percent} delay={0.2} />

        <GlowCard className="col-span-12 lg:col-span-6" delay={0.25}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            Melhores margens projetadas
          </span>
          {projecao.melhores.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">Nenhum produto cadastrado.</p>
          ) : (
            <ul className="divide-y divide-line">
              {projecao.melhores.map((l) => (
                <li key={l.nome} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <StatusDot cor={l.statusCor} />
                    <span className="truncate pr-3 text-sm text-txt">{l.nome}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 font-mono text-sm tabular-nums">
                    <span
                      className={
                        l.statusCor === "verde" ? "text-green" : l.statusCor === "amarelo" ? "text-amber" : "text-danger"
                      }
                    >
                      {percent(l.margem)}
                    </span>
                    <span className="text-txtDim">{money(l.lucroMensal)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        <GlowCard className="col-span-12 lg:col-span-6" delay={0.3}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            Para re-avaliar · margem projetada
          </span>
          {projecao.reavaliar.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">
              Tudo dentro da meta. <span className="text-green">✓</span>
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {projecao.reavaliar.map((l) => (
                <li key={l.nome} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <StatusDot cor="vermelho" />
                    <span className="truncate text-sm text-txt">{l.nome}</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-danger">{percent(l.margem)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-txtFaint">
        {projecao.aprovados} de {t.totalProdutos} produtos aprovados no cadastro ·{" "}
        {t.cores.verde} ótimo / {t.cores.amarelo} pode melhorar / {t.cores.vermelho} re-avaliar ·
        capital em estoque pelo cadastro {money(t.capitalEstoque)}.
      </p>
    </>
  );
}
