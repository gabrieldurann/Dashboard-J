import { Coins, Globe as GlobeIcon, Landmark, LineChart, MapPin, Package, Percent, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import {
  calcularMetricas,
  preencherMeses,
  resultadoVendas,
  resumoPeriodo,
  serieMensal,
  totaisPortfolio,
  vendasPorAno,
  vendasPorDia,
  vendasPorMes,
  vendasPorPais,
} from "../calc/engine";
import { AreaChart } from "../components/AreaChart";
import { BigStat } from "../components/BigStat";
import { Globe, type GlobeMarker } from "../components/Globe";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { PeriodCard } from "../components/PeriodCard";
import { RadialGauge } from "../components/RadialGauge";
import { SalesByCountry } from "../components/SalesByCountry";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { paisByCode } from "../data/countries";
import { money, percent } from "../i18n/format";
import { useStore } from "../store/useStore";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (chave: string) => MESES[Number(chave.split("-")[1]) - 1] ?? chave;
const labelMes = (chave: string) => `${mesCurto(chave)} ${chave.split("-")[0]}`;
const labelDia = (chave: string) => {
  const [, m, d] = chave.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};

export function Painel() {
  const produtos = useStore((s) => s.produtos);
  const vendas = useStore((s) => s.vendas);
  const t = useMemo(() => totaisPortfolio(produtos), [produtos]);

  // sales-per-country (globe markers + table)
  const porPais = useMemo(() => vendasPorPais(vendas), [vendas]);
  const globeMarkers = useMemo<GlobeMarker[]>(
    () =>
      porPais
        .map((a) => {
          const p = paisByCode(a.code);
          return p
            ? { id: a.code.toLowerCase(), location: [p.lat, p.lng] as [number, number], label: `${p.flag} ${p.nome}` }
            : null;
        })
        .filter((m): m is GlobeMarker => m !== null),
    [porPais],
  );

  // Amazon sales over time (continuous months) + its month-over-month change
  const amazonSerie = useMemo(() => serieMensal(vendas, "Amazon"), [vendas]);
  const amazonPts = useMemo(
    () => preencherMeses(amazonSerie).map((m) => ({ label: mesCurto(m.chave), value: m.valor })),
    [amazonSerie],
  );
  const amazonResumo = useMemo(() => resumoPeriodo(amazonSerie), [amazonSerie]);

  // daily / monthly / yearly sales (all channels), latest period vs previous
  const diario = useMemo(() => resumoPeriodo(vendasPorDia(vendas)), [vendas]);
  const mensal = useMemo(() => resumoPeriodo(vendasPorMes(vendas)), [vendas]);
  const anual = useMemo(() => resumoPeriodo(vendasPorAno(vendas)), [vendas]);

  // realized financials for the latest month (joins ledger → products): real lucro/custo/imposto/comissão
  const mesChave = mensal.atual?.chave;
  const resMes = useMemo(
    () => resultadoVendas(mesChave ? vendas.filter((v) => v.data.slice(0, 7) === mesChave) : [], produtos),
    [vendas, produtos, mesChave],
  );

  // company-wide realized margin (blended profit ÷ gross over ALL sales) — not a per-product average
  const resTotal = useMemo(() => resultadoVendas(vendas, produtos), [vendas, produtos]);
  const margemRealizada = resTotal.bruto > 0 ? resTotal.lucro / resTotal.bruto : 0;

  // products to re-evaluate (red band), worst margin first
  const reavaliar = useMemo(
    () =>
      produtos
        .map((p) => ({ p, m: calcularMetricas(p) }))
        .filter((x) => x.m.statusCor === "vermelho")
        .sort((a, b) => a.m.margem - b.m.margem),
    [produtos],
  );

  // gauge: company realized margin scaled so 40% reads as a "full" healthy ring
  const gaugeValue = Math.max(0, Math.min(1, margemRealizada / 0.4));

  return (
    <Screen
      eyebrow="Visão Geral"
      title="Painel Principal"
      subtitle="Totais do portfólio, desempenho de vendas no tempo e alcance global."
    >
      <div className="grid grid-cols-12 gap-4">
        {/* hero: gauge + health counts */}
        <GlowCard accent="green" grid className="col-span-12 lg:col-span-5" delay={0}>
          <div className="flex items-center gap-6">
            <RadialGauge value={gaugeValue} display={percent(margemRealizada)} label="Margem realizada" size={190} />
            <div className="flex flex-1 flex-col gap-3">
              <Health label="Ótimo" count={t.cores.verde} cor="verde" />
              <Health label="Pode melhorar" count={t.cores.amarelo} cor="amarelo" />
              <Health label="Re-avaliar" count={t.cores.vermelho} cor="vermelho" />
            </div>
          </div>
        </GlowCard>

        {/* real results for the current month (from the sales ledger) */}
        <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-7">
          <MetricTile label="Lucro / mês" value={resMes.lucro} format={money} icon={Coins} accent="gold" footnote="Líquido — o que sobra no bolso após custos, impostos e comissão" delay={0.05} />
          <MetricTile label="Custo / mês" value={resMes.custo} format={money} icon={Package} footnote="Custo do fornecedor nas vendas do mês" delay={0.1} />
          <MetricTile label="Imposto / mês" value={resMes.imposto} format={money} icon={Landmark} footnote="Imposto sobre as vendas do mês" delay={0.15} />
          <MetricTile label="Comissão / mês" value={resMes.comissao} format={money} icon={Percent} footnote="Comissão dos canais nas vendas do mês" delay={0.2} />
        </div>

        {/* daily / monthly / yearly GROSS sales from the ledger (no cost deductions) */}
        <div className="col-span-12 lg:col-span-4">
          <PeriodCard label="Vendas no dia" periodo={diario} sublabel={diario.atual ? labelDia(diario.atual.chave) : undefined} hint="Bruto — sem descontos de custos" delay={0.05} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PeriodCard label="Vendas no mês" periodo={mensal} sublabel={mensal.atual ? labelMes(mensal.atual.chave) : undefined} hint="Bruto — sem descontos de custos" delay={0.1} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PeriodCard label="Vendas no ano" periodo={anual} sublabel={anual.atual?.chave} hint="Bruto — sem descontos de custos" delay={0.15} />
        </div>

        {/* sales over time (Amazon) + counters */}
        <GlowCard className="col-span-12 lg:col-span-8" delay={0.2}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                <LineChart size={15} className="text-green" strokeWidth={2} />
              </span>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Vendas no tempo · Amazon</span>
            </div>
            {amazonResumo.variacao != null && (
              <span className={`font-mono text-xs ${amazonResumo.variacao >= 0 ? "text-green" : "text-danger"}`}>
                {amazonResumo.variacao >= 0 ? "▲" : "▼"} {percent(Math.abs(amazonResumo.variacao))} vs mês anterior
              </span>
            )}
          </div>
          {amazonPts.length > 0 ? (
            <AreaChart points={amazonPts} format={money} />
          ) : (
            <p className="py-12 text-center text-sm text-txtDim">Nenhuma venda Amazon registrada.</p>
          )}
        </GlowCard>

        <GlowCard className="col-span-12 flex flex-col justify-center gap-4 lg:col-span-4" delay={0.25}>
          <Counter icon={Package} label="Total de produtos" value={produtos.length} accent="green" />
          <div className="border-t border-line" />
          <Counter icon={MapPin} label="Locais de venda · países" value={porPais.length} accent="gold" />
        </GlowCard>

        {/* global reach: globe + sales by country */}
        <GlowCard accent="green" grid className="col-span-12 lg:col-span-6" delay={0.3}>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
              <GlobeIcon size={15} className="text-green" strokeWidth={2} />
            </span>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Alcance Global</span>
          </div>
          <p className="mb-3 font-mono text-xs text-txtFaint">
            {porPais.length} {porPais.length === 1 ? "país" : "países"} com vendas · arraste para girar
          </p>
          <div className="mx-auto max-w-[340px]">
            <Globe markers={globeMarkers} />
          </div>
        </GlowCard>

        <div className="col-span-12 lg:col-span-6">
          <SalesByCountry dados={porPais} delay={0.35} />
        </div>

        {/* capital + potencial de receita + re-avaliar */}
        <MetricTile label="Capital em estoque" value={t.capitalEstoque} format={money} icon={Wallet} accent="gold" footnote="Capital travado p/ manter 1 caixa de cada produto" delay={0.4} className="col-span-12 lg:col-span-4" />

        <MetricTile label="Potencial de receita / mês" value={t.receitaMensal} format={money} icon={TrendingUp} accent="green" footnote="Projeção · preço × vendas/mês prevista (não é venda realizada)" delay={0.42} className="col-span-12 lg:col-span-4" />

        <GlowCard className="col-span-12 lg:col-span-4" delay={0.45}>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Fila de re-avaliação</span>
            <span className="font-mono text-xs text-txtFaint">margem abaixo de 11%</span>
          </div>
          {reavaliar.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">
              Nenhum produto crítico — tudo dentro da meta. <span className="text-green">✓</span>
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {reavaliar.map(({ p, m }) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <StatusDot cor={m.statusCor} />
                    <span className="text-sm text-txt">{p.nome}</span>
                  </div>
                  <span className="font-mono text-sm text-danger">{percent(m.margem)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>
      </div>
    </Screen>
  );
}

function Health({ label, count, cor }: { label: string; count: number; cor: "verde" | "amarelo" | "vermelho" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <StatusDot cor={cor} />
      <span className="flex-1 font-mono text-xs text-txtDim">{label}</span>
      <span className="font-mono text-sm tabular-nums text-txt">{count}</span>
    </div>
  );
}

function Counter({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: number; accent: "green" | "gold" }) {
  const text = accent === "gold" ? "text-gold" : "text-green";
  const bg = accent === "gold" ? "bg-goldSoft" : "bg-greenSoft";
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-chip ${bg}`}>
        <Icon size={18} className={text} strokeWidth={2} />
      </span>
      <div>
        <BigStat value={value} format={(v) => String(Math.round(v))} className="text-2xl" />
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">{label}</div>
      </div>
    </div>
  );
}
