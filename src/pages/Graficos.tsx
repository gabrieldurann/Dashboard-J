import { BarChart3, Coins, Landmark, Package, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  desempenhoProdutos,
  faixasDesempenho,
  resultadoVendas,
  serieFinanceiraMensal,
  type DesempenhoProduto,
} from "../calc/engine";
import type { StatusCor } from "../calc/constants";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { MultiAreaChart } from "../components/MultiAreaChart";
import { RadialGauge } from "../components/RadialGauge";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { inputClass } from "../components/Field";
import { money, percent } from "../i18n/format";
import { COLORS, EASE, STATUS_COLOR } from "../theme/tokens";
import { useStore } from "../store/useStore";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (chave: string) => MESES[Number(chave.split("-")[1]) - 1] ?? chave;

/** Health bands (idea #3) — same red/yellow/green rule used everywhere else. */
const FAIXAS: { cor: StatusCor; titulo: string; desc: string }[] = [
  { cor: "verde", titulo: "Indo bem", desc: "margem acima de 15%" },
  { cor: "amarelo", titulo: "Mediano", desc: "margem entre 11% e 15%" },
  { cor: "vermelho", titulo: "Ruim", desc: "margem abaixo de 11%" },
];

export function Graficos() {
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);

  const [canal, setCanal] = useState("todos");

  const canais = useMemo(
    () => Array.from(new Set(vendas.map((v) => v.canal).filter(Boolean))) as string[],
    [vendas],
  );
  const filtradas = useMemo(
    () => (canal === "todos" ? vendas : vendas.filter((v) => v.canal === canal)),
    [vendas, canal],
  );

  // realized totals over the filtered ledger
  const res = useMemo(() => resultadoVendas(filtradas, produtos), [filtradas, produtos]);
  const margemRealizada = res.bruto > 0 ? res.lucro / res.bruto : 0;

  // monthly gross / cost / profit series
  const serie = useMemo(() => serieFinanceiraMensal(filtradas, produtos), [filtradas, produtos]);
  const labels = serie.map((s) => mesCurto(s.chave));
  const series = [
    { nome: "Faturamento", cor: COLORS.gold, valores: serie.map((s) => s.bruto) },
    { nome: "Custo", cor: COLORS.danger, valores: serie.map((s) => s.custo) },
    { nome: "Lucro", cor: COLORS.green, valores: serie.map((s) => s.lucro) },
  ];

  // per-product realized performance + the bom/médio/ruim split
  const desempenho = useMemo(() => desempenhoProdutos(filtradas, produtos), [filtradas, produtos]);
  const faixas = useMemo(() => faixasDesempenho(desempenho), [desempenho]);
  const maxLucro = Math.max(1, ...desempenho.map((d) => Math.abs(d.lucro)));

  const gaugeValue = Math.max(0, Math.min(1, margemRealizada / 0.4));
  const vazio = desempenho.length === 0;

  return (
    <Screen
      eyebrow="Análise"
      title="Gráficos"
      subtitle="Visão visual do que já aconteceu — faturamento, lucro e o desempenho de cada produto."
      actions={
        canais.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Canal</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${inputClass} py-2`}>
              <option value="todos">Todos os canais</option>
              {canais.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      <div className="grid grid-cols-12 gap-4">
        {/* headline realized figures */}
        <MetricTile dense label="Faturamento" value={res.bruto} format={money} icon={TrendingUp} accent="gold" footnote="Bruto realizado no período" className="col-span-6 lg:col-span-3" />
        <MetricTile dense label="Lucro" value={res.lucro} format={money} icon={Coins} accent="green" footnote="Após custos, impostos, comissão e frete" delay={0.05} className="col-span-6 lg:col-span-3" />
        <MetricTile dense label="Custo" value={res.custo} format={money} icon={Package} accent="red" footnote="Custo do fornecedor" delay={0.1} className="col-span-6 lg:col-span-3" />
        <MetricTile dense label="Imposto" value={res.imposto} format={money} icon={Landmark} accent="red" footnote="Imposto sobre as vendas" delay={0.15} className="col-span-6 lg:col-span-3" />

        {/* finance over time + realized margin gauge */}
        <GlowCard className="col-span-12 xl:col-span-8" delay={0.2}>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
              <BarChart3 size={15} className="text-green" strokeWidth={2} />
            </span>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
              Faturamento · custo · lucro por mês
            </span>
          </div>
          <p className="mb-3 font-mono text-xs text-txtFaint">Clique na legenda para isolar uma série.</p>
          {serie.length > 0 ? (
            <MultiAreaChart labels={labels} series={series} format={money} />
          ) : (
            <p className="py-16 text-center text-sm text-txtDim">Nenhuma venda no filtro atual.</p>
          )}
        </GlowCard>

        <GlowCard accent="green" grid className="col-span-12 flex flex-col items-center justify-center xl:col-span-4" delay={0.25}>
          <RadialGauge value={gaugeValue} display={percent(margemRealizada)} label="Margem realizada" size={190} />
          <p className="mt-3 text-center font-mono text-xs text-txtFaint">
            Lucro ÷ faturamento de todas as vendas do filtro.
          </p>
        </GlowCard>

        {/* bom / médio / ruim split (idea #3) */}
        <div className="col-span-12 mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-lg text-txt">Desempenho por faixa</h2>
          <p className="font-mono text-xs text-txtFaint">
            Faixas pela <span className="text-txtDim">margem realizada</span> (o que as vendas de fato deram) — o
            Painel classifica pela margem <span className="text-txtDim">projetada</span> do cadastro, então os dois
            podem divergir.
          </p>
        </div>
        {FAIXAS.map((f, i) => {
          const lista = faixas[f.cor];
          const bruto = lista.reduce((s, l) => s + l.bruto, 0);
          const lucro = lista.reduce((s, l) => s + l.lucro, 0);
          return (
            <GlowCard key={f.cor} className="col-span-12 lg:col-span-4" delay={0.3 + i * 0.05}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <StatusDot cor={f.cor} />
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">{f.titulo}</span>
                </span>
                <span className="font-mono text-2xl tabular-nums" style={{ color: STATUS_COLOR[f.cor] }}>
                  {lista.length}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-txtFaint">{f.desc}</p>

              {lista.length === 0 ? (
                <p className="py-4 text-center text-sm text-txtDim">Nenhum produto nesta faixa.</p>
              ) : (
                <>
                  <div className="mt-3 flex items-baseline justify-between border-b border-line pb-2 font-mono text-xs tabular-nums">
                    <span className="text-txtFaint">faturamento {money(bruto)}</span>
                    <span className="text-txtDim">lucro {money(lucro)}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {lista.map((l) => (
                      <li key={l.produtoId} className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-txt">{l.nome}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: STATUS_COLOR[f.cor] }}>
                          {percent(l.margem)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </GlowCard>
          );
        })}

        {/* profit per product — bars colored by band */}
        <GlowCard className="col-span-12" delay={0.45}>
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Lucro por produto</span>
          {vazio ? (
            <p className="py-8 text-center text-sm text-txtDim">Nenhuma venda no filtro atual.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {desempenho.map((d, i) => (
                <li key={d.produtoId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-txt">{d.nome}</span>
                    <span className="shrink-0 font-mono text-sm tabular-nums" style={{ color: STATUS_COLOR[d.statusCor] }}>
                      {money(d.lucro)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(Math.abs(d.lucro) / maxLucro) * 100}%` }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.05 * i }}
                      className="h-full rounded-full"
                      style={{ background: STATUS_COLOR[d.statusCor] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        {/* per-product detail table */}
        <GlowCard className="col-span-12 overflow-hidden p-0" delay={0.5}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {/* Custo & Repr. drop out on narrower screens so the margin badge always fits */}
                  {[
                    { h: "Produto", cls: "" },
                    { h: "Un", cls: "" },
                    { h: "Faturamento", cls: "" },
                    { h: "Custo", cls: "hidden xl:table-cell" },
                    { h: "Lucro", cls: "" },
                    { h: "Repr.", cls: "hidden xl:table-cell" },
                    { h: "Margem", cls: "" },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`whitespace-nowrap px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vazio ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-txtDim">
                      Nenhuma venda no filtro atual.
                    </td>
                  </tr>
                ) : (
                  desempenho.map((d) => <LinhaProduto key={d.produtoId} d={d} />)
                )}
              </tbody>
            </table>
          </div>
        </GlowCard>
      </div>
    </Screen>
  );
}

function LinhaProduto({ d }: { d: DesempenhoProduto }) {
  const cor = STATUS_COLOR[d.statusCor];
  return (
    <tr className="border-b border-line/60 transition-colors hover:bg-greenSoft/20">
      <td className="max-w-[200px] truncate px-3 py-3 text-sm text-txt">{d.nome}</td>
      <td className="px-3 py-3 font-mono text-sm tabular-nums text-txtDim">{d.unidades}</td>
      <td className="whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums text-txt">{money(d.bruto)}</td>
      <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums text-danger xl:table-cell">{money(d.custo)}</td>
      <td className="whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums text-green">{money(d.lucro)}</td>
      <td className="hidden px-3 py-3 font-mono text-xs tabular-nums text-txtDim xl:table-cell">{percent(d.share)}</td>
      <td className="px-3 py-3">
        <span
          className="whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] tabular-nums"
          style={{ color: cor, borderColor: `${cor}66`, background: `${cor}1a` }}
        >
          {percent(d.margem)}
        </span>
      </td>
    </tr>
  );
}
