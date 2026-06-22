import { Coins, Globe as GlobeIcon, Landmark, Package, TrendingUp, Wallet } from "lucide-react";
import { useMemo } from "react";
import { calcularMetricas, totaisPortfolio, vendasPorPais } from "../calc/engine";
import { BigStat } from "../components/BigStat";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { RadialGauge } from "../components/RadialGauge";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, percent } from "../i18n/format";
import { useStore } from "../store/useStore";
import { Globe, type GlobeMarker } from "../components/Globe";
import { paisByCode } from "../data/countries";

export function Painel() {
  const produtos = useStore((s) => s.produtos);
  const vendas = useStore((s) => s.vendas);
  const t = useMemo(() => totaisPortfolio(produtos), [produtos]);

  // globe markers from real sales-per-country (PLAN.md §9 Phase 2 #7)
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

  // products to re-evaluate (red band), worst margin first
  const reavaliar = useMemo(
    () =>
      produtos
        .map((p) => ({ p, m: calcularMetricas(p) }))
        .filter((x) => x.m.statusCor === "vermelho")
        .sort((a, b) => a.m.margem - b.m.margem),
    [produtos],
  );

  // gauge: average margin scaled so 30% reads as a "full" healthy ring
  const gaugeValue = Math.max(0, Math.min(1, t.margemMedia / 0.3));

  return (
    <Screen
      eyebrow="Visão Geral"
      title="Painel Principal"
      subtitle="Totais consolidados do portfólio — vendas, lucro, custo e impostos por mês."
    >
      <div className="grid grid-cols-12 gap-4">
        {/* hero: gauge + counts */}
        <GlowCard accent="green" grid className="col-span-12 lg:col-span-5" delay={0}>
          <div className="flex items-center gap-6">
            <RadialGauge
              value={gaugeValue}
              display={percent(t.margemMedia)}
              label="Margem média"
              size={190}
            />
            <div className="flex flex-col gap-3">
              <Health label="Ótimo" count={t.cores.verde} cor="verde" />
              <Health label="Pode melhorar" count={t.cores.amarelo} cor="amarelo" />
              <Health label="Re-avaliar" count={t.cores.vermelho} cor="vermelho" />
              <div className="mt-1 border-t border-line pt-2">
                <span className="eyebrow">Produtos</span>
                <div>
                  <BigStat value={t.totalProdutos} format={(v) => String(Math.round(v))} className="text-2xl" />
                </div>
              </div>
            </div>
          </div>
        </GlowCard>

        {/* totals grid */}
        <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-7">
          <MetricTile
            label="Receita / mês"
            value={t.receitaMensal}
            format={money}
            icon={TrendingUp}
            accent="gold"
            footnote="Soma de preço × vendas/mês"
            delay={0.05}
          />
          <MetricTile
            label="Lucro / mês"
            value={t.lucroMensal}
            format={money}
            icon={Coins}
            accent="green"
            footnote="Já com taxas, comissão e frete"
            delay={0.1}
          />
          <MetricTile
            label="Custo / mês"
            value={t.custoMensal}
            format={money}
            icon={Package}
            footnote="Custo fornecedor × vendas/mês"
            delay={0.15}
          />
          <MetricTile
            label="Imposto / mês"
            value={t.impostoMensal}
            format={money}
            icon={Landmark}
            footnote="Estimativa pela alíquota da planilha"
            delay={0.2}
          />
        </div>

        {/* capital tied up */}
        <MetricTile
          label="Capital em estoque"
          value={t.capitalEstoque}
          format={money}
          icon={Wallet}
          accent="gold"
          footnote="Capital travado p/ manter 1 caixa de cada produto"
          delay={0.25}
          className="col-span-12 lg:col-span-4"
        />

        {/* re-avaliar queue */}
        <GlowCard className="col-span-12 lg:col-span-8" delay={0.3}>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
              Fila de re-avaliação
            </span>
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

        {/* global reach — sales per country (data wires in next step) */}
        <GlowCard accent="green" grid className="col-span-12 lg:col-span-6" delay={0.35}>
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
