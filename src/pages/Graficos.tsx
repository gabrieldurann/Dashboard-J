import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  desempenhoProdutos,
  devolucoesPorMotivo,
  faixasDesempenho,
  resultadoVendas,
  serieFinanceiraMensal,
  vendasPorCanal,
} from "../calc/engine";
import type { StatusCor } from "../calc/constants";
import { BarRanking } from "../components/BarRanking";
import { DonutChart } from "../components/DonutChart";
import { inputClass } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { MultiAreaChart } from "../components/MultiAreaChart";
import { RadialGauge } from "../components/RadialGauge";
import { Screen } from "../components/Screen";
import { money, percent } from "../i18n/format";
import { MOTIVO_LABEL } from "../i18n/labels";
import { COLORS, EASE, STATUS_COLOR } from "../theme/tokens";
import { useStore } from "../store/useStore";

// Gráficos = the visual read of the business, for a quick overview or to present. Numbers only
// appear as chart labels/centres — the dense figures live on the Painel and the record pages.

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (chave: string) => MESES[Number(chave.split("-")[1]) - 1] ?? chave;

/** Rotating palette for per-item charts (products, channels). */
const PALETA = [COLORS.green, COLORS.gold, COLORS.sky, COLORS.amber, "#b57ef0", "#4ad4d4", COLORS.danger];
const cicla = (i: number) => PALETA[i % PALETA.length];

const FAIXAS: { cor: StatusCor; titulo: string }[] = [
  { cor: "verde", titulo: "Indo bem" },
  { cor: "amarelo", titulo: "Mediano" },
  { cor: "vermelho", titulo: "Ruim" },
];

/** Card shell with a heading + optional one-line explainer, so every chart reads the same. */
function Grafico({
  titulo,
  legenda,
  className,
  delay,
  children,
}: {
  titulo: string;
  legenda?: string;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <GlowCard className={className} delay={delay}>
      <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">{titulo}</span>
      {legenda && <p className="mt-0.5 font-mono text-[11px] text-txtFaint">{legenda}</p>}
      <div className="mt-4">{children}</div>
    </GlowCard>
  );
}

export function Graficos() {
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);
  const devolucoes = useStore((s) => s.devolucoes);

  const [canal, setCanal] = useState("todos");

  const canais = useMemo(
    () => Array.from(new Set(vendas.map((v) => v.canal).filter(Boolean))) as string[],
    [vendas],
  );
  const filtradas = useMemo(
    () => (canal === "todos" ? vendas : vendas.filter((v) => v.canal === canal)),
    [vendas, canal],
  );

  const res = useMemo(() => resultadoVendas(filtradas, produtos), [filtradas, produtos]);
  const margemRealizada = res.bruto > 0 ? res.lucro / res.bruto : 0;

  // ── monthly evolution ──
  const serie = useMemo(() => serieFinanceiraMensal(filtradas, produtos), [filtradas, produtos]);
  const labels = serie.map((s) => mesCurto(s.chave));
  const series = [
    { nome: "Faturamento", cor: COLORS.gold, valores: serie.map((s) => s.bruto) },
    { nome: "Custo", cor: COLORS.danger, valores: serie.map((s) => s.custo) },
    { nome: "Lucro", cor: COLORS.green, valores: serie.map((s) => s.lucro) },
  ];

  // ── where each R$ of revenue ends up ──
  const composicao = [
    { nome: "Custo do produto", valor: res.custo, cor: COLORS.danger },
    { nome: "Comissão", valor: res.comissao, cor: COLORS.gold },
    { nome: "Imposto", valor: res.imposto, cor: COLORS.amber },
    { nome: "Frete", valor: res.frete, cor: COLORS.sky },
    { nome: "Lucro", valor: Math.max(0, res.lucro), cor: COLORS.green },
  ];

  // ── per-product performance ──
  const desempenho = useMemo(() => desempenhoProdutos(filtradas, produtos), [filtradas, produtos]);
  const faixas = useMemo(() => faixasDesempenho(desempenho), [desempenho]);
  const participacao = desempenho.map((d, i) => ({ nome: d.nome, valor: d.bruto, cor: cicla(i) }));
  const lucroPorProduto = desempenho.map((d) => ({
    nome: d.nome,
    valor: d.lucro,
    cor: STATUS_COLOR[d.statusCor],
    nota: percent(d.margem),
  }));

  // faixa distribution as a share of revenue (not just a count — a big red product matters more)
  const totalFaixas = desempenho.reduce((s, d) => s + d.bruto, 0);
  const distFaixas = FAIXAS.map((f) => {
    const lista = faixas[f.cor];
    const bruto = lista.reduce((s, l) => s + l.bruto, 0);
    return { ...f, qtd: lista.length, bruto, share: totalFaixas > 0 ? bruto / totalFaixas : 0 };
  });

  // ── channels & returns ──
  const porCanal = useMemo(() => vendasPorCanal(filtradas), [filtradas]);
  const canalFatias = porCanal.map((c, i) => ({ nome: c.canal, valor: c.valor, cor: cicla(i) }));
  const porMotivo = useMemo(() => devolucoesPorMotivo(devolucoes), [devolucoes]);
  const motivoFatias = porMotivo.map((m, i) => ({
    nome: MOTIVO_LABEL[m.motivo],
    valor: m.reembolso,
    cor: cicla(i),
  }));

  return (
    <Screen
      eyebrow="Análise"
      title="Gráficos"
      subtitle="O retrato visual do negócio — para bater o olho ou apresentar."
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
        {/* evolution over time — the headline story */}
        <Grafico
          titulo="Evolução mensal"
          legenda="Faturamento, custo e lucro mês a mês · clique na legenda para isolar"
          className="col-span-12 xl:col-span-8"
          delay={0}
        >
          {serie.length > 0 ? (
            <MultiAreaChart labels={labels} series={series} format={money} height={230} />
          ) : (
            <p className="py-16 text-center text-sm text-txtDim">Nenhuma venda no filtro atual.</p>
          )}
        </Grafico>

        <GlowCard accent="green" grid className="col-span-12 flex flex-col items-center justify-center xl:col-span-4" delay={0.05}>
          <RadialGauge value={Math.max(0, Math.min(1, margemRealizada / 0.4))} display={percent(margemRealizada)} label="Margem realizada" size={190} />
          <p className="mt-3 text-center font-mono text-[11px] text-txtFaint">
            De cada R$ 1,00 vendido, {percent(margemRealizada)} vira lucro.
          </p>
        </GlowCard>

        {/* composition */}
        <Grafico
          titulo="Para onde vai o faturamento"
          legenda="Como cada real se divide entre custos e lucro"
          className="col-span-12 lg:col-span-6"
          delay={0.1}
        >
          <DonutChart fatias={composicao} format={money} titulo="Faturamento" />
        </Grafico>

        <Grafico
          titulo="Quem carrega o faturamento"
          legenda="Participação de cada produto na receita"
          className="col-span-12 lg:col-span-6"
          delay={0.15}
        >
          <DonutChart fatias={participacao} format={money} titulo="Faturamento" />
        </Grafico>

        {/* comparison */}
        <Grafico
          titulo="Lucro por produto"
          legenda="Barras na cor da faixa · % = margem realizada"
          className="col-span-12 lg:col-span-7"
          delay={0.2}
        >
          <BarRanking itens={lucroPorProduto} format={money} />
        </Grafico>

        <Grafico
          titulo="Distribuição por faixa"
          legenda="Quanto do faturamento vem de produtos bons, medianos e ruins"
          className="col-span-12 lg:col-span-5"
          delay={0.25}
        >
          {totalFaixas > 0 ? (
            <>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-line/40">
                {distFaixas.map((f, i) => (
                  <motion.div
                    key={f.cor}
                    initial={{ width: 0 }}
                    animate={{ width: `${f.share * 100}%` }}
                    transition={{ duration: 0.65, ease: EASE, delay: 0.08 * i }}
                    style={{ background: STATUS_COLOR[f.cor] }}
                    title={`${f.titulo}: ${percent(f.share)}`}
                  />
                ))}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {distFaixas.map((f) => (
                  <li key={f.cor} className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[f.cor] }} />
                      <span className="text-sm text-txt">{f.titulo}</span>
                      <span className="font-mono text-[11px] text-txtFaint">
                        {f.qtd} {f.qtd === 1 ? "produto" : "produtos"}
                      </span>
                    </span>
                    <span className="font-mono text-sm tabular-nums" style={{ color: STATUS_COLOR[f.cor] }}>
                      {percent(f.share)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-[11px] leading-relaxed text-txtFaint">
                Faixas pela margem <span className="text-txtDim">realizada</span> das vendas — o Painel usa a
                margem <span className="text-txtDim">projetada</span> do cadastro, então podem divergir.
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-txtDim">Sem vendas no filtro atual.</p>
          )}
        </Grafico>

        {/* channels & returns */}
        <Grafico
          titulo="Faturamento por canal"
          legenda="Onde as vendas acontecem"
          className="col-span-12 lg:col-span-6"
          delay={0.3}
        >
          <DonutChart fatias={canalFatias} format={money} titulo="Faturamento" />
        </Grafico>

        <Grafico
          titulo="Devoluções por motivo"
          legenda="Valor reembolsado por causa · todas as devoluções"
          className="col-span-12 lg:col-span-6"
          delay={0.35}
        >
          {motivoFatias.length > 0 ? (
            <DonutChart fatias={motivoFatias} format={money} titulo="Reembolsado" />
          ) : (
            <p className="py-10 text-center text-sm text-txtDim">Nenhuma devolução registrada. ✓</p>
          )}
        </Grafico>
      </div>
    </Screen>
  );
}
