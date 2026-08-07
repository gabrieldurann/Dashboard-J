import {
  Megaphone, Building2, ChevronDown, Coins, EyeOff, Globe as GlobeIcon, Landmark, LineChart, MapPin, Package, Percent, RotateCcw, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  calcularMetricas,
  preencherMeses,
  resultadoVendas,
  resumoDevolucoes,
  resumoPeriodo,
  serieMensal,
  totaisPortfolio,
  custoAds,
  totalOperacional,
  vendasPorAno,
  vendasPorDia,
  vendasPorMes,
  vendasPorPais,
} from "../calc/engine";
import { EASE } from "../theme/tokens";
import { AreaChart } from "../components/AreaChart";
import { ExibicaoMenu } from "../components/ExibicaoMenu";
import { Ocultavel, type CardRegistrado } from "../components/Ocultavel";
import { distribuir, spanClass } from "../components/gridSpans";
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
import { useConfig } from "../store/useConfig";

// Cards the user can hide (idea: keep the Painel readable for whoever is looking at it).
// `essencial` ones survive the "Só o essencial" preset.
const CARDS: CardRegistrado[] = [
  { id: "painel.margem", label: "Margem realizada + saúde", essencial: true },
  { id: "painel.lucroLiquido", label: "Lucro líquido / mês", essencial: true },
  { id: "painel.lucroSemOp", label: "Lucro s/ operacional" },
  { id: "painel.cascata", label: "Cascata de deduções" },
  { id: "painel.vendasDia", label: "Vendas no dia", essencial: true },
  { id: "painel.vendasMes", label: "Vendas no mês", essencial: true },
  { id: "painel.vendasAno", label: "Vendas no ano", essencial: true },
  { id: "painel.amazon", label: "Vendas no tempo · Amazon" },
  { id: "painel.contadores", label: "Produtos e países", essencial: true },
  { id: "painel.globo", label: "Alcance global (globo)" },
  { id: "painel.porPais", label: "Vendas por país" },
  { id: "painel.capital", label: "Capital em estoque" },
  { id: "painel.potencial", label: "Potencial de receita" },
  { id: "painel.reavaliar", label: "Fila de re-avaliação" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (chave: string) => MESES[Number(chave.split("-")[1]) - 1] ?? chave;
const labelMes = (chave: string) => `${mesCurto(chave)} ${chave.split("-")[0]}`;
const labelDia = (chave: string) => {
  const [, m, d] = chave.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};

export function Painel() {
  const cfg = useConfig();
  const produtos = useStore((s) => s.produtos);
  const vendas = useStore((s) => s.vendas);
  const devolucoes = useStore((s) => s.devolucoes);
  const custosOperacionais = useStore((s) => s.custosOperacionais);
  const anunciosAds = useStore((s) => s.anunciosAds);
  const t = useMemo(() => totaisPortfolio(produtos, cfg), [produtos, cfg]);

  // reveal/hide the secondary metric cards (idea: keep the headline clean, expand for detail)
  const [detalhes, setDetalhes] = useState(false);

  // per-card visibility (the eye control) — a display preference, persisted per browser
  const cardsOcultos = useStore((s) => s.cardsOcultos);
  const mostrarCards = useStore((s) => s.mostrarCards);
  const todosOcultos = CARDS.every((c) => cardsOcultos.includes(c.id));
  const visivel = (id: string) => !cardsOcultos.includes(id);

  // "Money in the pocket" reads better as green on a light surface; the dark HUD keeps its gold.
  const claro = useStore((s) => s.tema) === "claro";
  const acento = claro ? "green" : "gold";

  // The profit column is one slot in the hero row; it disappears only when all of its
  // cards are hidden, and the gauge then takes the whole row.
  const blocoLucro = visivel("painel.lucroLiquido") || visivel("painel.lucroSemOp") || visivel("painel.cascata");

  // Rows re-split their 12 columns over whatever is still visible, so hiding a card never
  // leaves a hole — the neighbours grow to fill it.
  const linhaHero = distribuir([
    { id: "painel.margem", peso: 5, visivel: visivel("painel.margem") },
    { id: "lucro", peso: 7, visivel: blocoLucro },
  ]);
  const linhaPeriodos = distribuir([
    { id: "painel.vendasDia", peso: 4, visivel: visivel("painel.vendasDia") },
    { id: "painel.vendasMes", peso: 4, visivel: visivel("painel.vendasMes") },
    { id: "painel.vendasAno", peso: 4, visivel: visivel("painel.vendasAno") },
  ]);
  const linhaTempo = distribuir([
    { id: "painel.amazon", peso: 8, visivel: visivel("painel.amazon") },
    { id: "painel.contadores", peso: 4, visivel: visivel("painel.contadores") },
  ]);
  const linhaGlobal = distribuir([
    { id: "painel.globo", peso: 6, visivel: visivel("painel.globo") },
    { id: "painel.porPais", peso: 6, visivel: visivel("painel.porPais") },
  ]);
  const linhaFinal = distribuir([
    { id: "painel.capital", peso: 4, visivel: visivel("painel.capital") },
    { id: "painel.potencial", peso: 4, visivel: visivel("painel.potencial") },
    { id: "painel.reavaliar", peso: 4, visivel: visivel("painel.reavaliar") },
  ]);

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
    () => resultadoVendas(mesChave ? vendas.filter((v) => v.data.slice(0, 7) === mesChave) : [], produtos, cfg),
    [vendas, produtos, mesChave, cfg],
  );

  // returns in the current month reduce realized profit (refunds are money going back out)
  const reembolsoMes = useMemo(
    () => resumoDevolucoes(mesChave ? devolucoes.filter((r) => r.data.slice(0, 7) === mesChave) : []).reembolso,
    [devolucoes, mesChave],
  );
  // company overhead (rent, internet, …) net of operational income, for this month: the recurring
  // entries plus any one-off booked in it. Independent of the month's sales.
  const totalOp = useMemo(
    () => totalOperacional(custosOperacionais, mesChave),
    [custosOperacionais, mesChave],
  );
  // advertising spend for the same month — the last deduction before "money in pocket" (idea #14)
  const gastoAds = useMemo(() => custoAds(anunciosAds, mesChave), [anunciosAds, mesChave]);
  // two headline figures: profit before company overhead (all sale costs + returns), and the
  // true net "money in pocket" after overhead too.
  const lucroSemOperacional = resMes.lucro - reembolsoMes;
  const lucroLiquidoTotal = lucroSemOperacional - totalOp - gastoAds;

  // company-wide realized margin (blended profit ÷ gross over ALL sales) — not a per-product average
  const resTotal = useMemo(() => resultadoVendas(vendas, produtos, cfg), [vendas, produtos, cfg]);
  const margemRealizada = resTotal.bruto > 0 ? resTotal.lucro / resTotal.bruto : 0;

  // products to re-evaluate (red band), worst margin first
  const reavaliar = useMemo(
    () =>
      produtos
        .map((p) => ({ p, m: calcularMetricas(p, cfg) }))
        .filter((x) => x.m.statusCor === "vermelho")
        .sort((a, b) => a.m.margem - b.m.margem),
    [produtos, cfg],
  );

  // gauge: company realized margin scaled so 40% reads as a "full" healthy ring
  const gaugeValue = Math.max(0, Math.min(1, margemRealizada / 0.4));

  return (
    <Screen
      eyebrow="Visão Geral"
      title="Painel Principal"
      subtitle="Totais do portfólio, desempenho de vendas no tempo e alcance global."
      actions={<ExibicaoMenu cards={CARDS} />}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* hero: gauge + health counts */}
        <Ocultavel id="painel.margem" label="Margem realizada" className={`col-span-12 ${spanClass(linhaHero, "painel.margem")}`}>
          <GlowCard accent="green" grid className="h-full" delay={0}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <RadialGauge value={gaugeValue} display={percent(margemRealizada)} label="Margem realizada" size={190} />
              <div className="flex min-w-[140px] flex-1 flex-col gap-3">
                <Health label="Ótimo" count={t.cores.verde} cor="verde" />
                <Health label="Pode melhorar" count={t.cores.amarelo} cor="amarelo" />
                <Health label="Re-avaliar" count={t.cores.vermelho} cor="vermelho" />
              </div>
            </div>
          </GlowCard>
        </Ocultavel>

        {/* profit headline: true net (after EVERYTHING incl. overhead) + profit before overhead */}
        {blocoLucro && (
        <div className={`col-span-12 flex flex-col gap-4 ${spanClass(linhaHero, "lucro")}`}>
          <div className={`grid gap-4 ${visivel("painel.lucroLiquido") && visivel("painel.lucroSemOp") ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
            {/* box 1 — the "money in the pocket" number, after operational costs too */}
            <Ocultavel id="painel.lucroLiquido" label="Lucro líquido / mês">
              <GlowCard accent={lucroLiquidoTotal >= 0 ? acento : "none"} className="h-full" delay={0.05}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-chip ${claro ? "bg-greenSoft" : "bg-goldSoft"}`}>
                    <Wallet size={15} className={claro ? "text-green" : "text-gold"} strokeWidth={2} />
                  </span>
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Lucro líquido / mês</span>
                </div>
                <div className="mt-3">
                  <BigStat
                    value={lucroLiquidoTotal}
                    format={money}
                    accent={lucroLiquidoTotal >= 0 ? (claro ? "text-green" : "text-gold") : "text-danger"}
                    className="text-3xl"
                  />
                </div>
                <p className="mt-1.5 font-mono text-xs text-txtFaint">O que sobra no bolso — após custos, impostos, comissão, devoluções e custos operacionais.</p>
              </GlowCard>
            </Ocultavel>

            {/* box 2 — profit before company overhead (the previous headline) */}
            <Ocultavel id="painel.lucroSemOp" label="Lucro s/ operacional">
              <MetricTile
                label="Lucro s/ operacional"
                value={lucroSemOperacional}
                format={money}
                icon={Coins}
                accent="green"
                footnote="Após custos, impostos, comissão e devoluções — antes do overhead da empresa"
                delay={0.1}
                className="h-full"
              />
            </Ocultavel>
          </div>

          {/* deduction cascade + reveal toggle */}
          <Ocultavel id="painel.cascata" label="Cascata de deduções">
          <GlowCard delay={0.15}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs tabular-nums">
              <span className="text-txtDim">Realizado {money(resMes.lucro)}</span>
              <span className="text-txtFaint">−</span>
              <span className="text-danger">Devoluções {money(reembolsoMes)}</span>
              <span className="text-txtFaint">−</span>
              <span className="text-danger">Operacional {money(totalOp)}</span>
              <span className="text-txtFaint">−</span>
              <span className="text-danger">Ads {money(gastoAds)}</span>
              <span className="text-txtFaint">=</span>
              <span className={lucroLiquidoTotal >= 0 ? (claro ? "text-green" : "text-gold") : "text-danger"}>
                {money(lucroLiquidoTotal)}
              </span>
            </div>
            <button
              onClick={() => setDetalhes((v) => !v)}
              className="mt-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-txtDim transition-colors hover:text-txt"
            >
              {detalhes ? "Menos" : "Mais"} métricas
              <ChevronDown size={13} className={`transition-transform ${detalhes ? "rotate-180" : ""}`} />
            </button>
          </GlowCard>
          </Ocultavel>
        </div>
        )}

        {/* collapsible cost breakdown — expanding pushes the page down to reveal more cards */}
        <AnimatePresence initial={false}>
          {detalhes && (
            <motion.div
              key="detalhe"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="col-span-12 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <MetricTile dense label="Custo / mês" value={resMes.custo} format={money} icon={Package} accent="red" footnote="Custo do fornecedor" />
                <MetricTile dense label="Imposto / mês" value={resMes.imposto} format={money} icon={Landmark} accent="red" footnote="Imposto sobre vendas" />
                <MetricTile dense label="Comissão / mês" value={resMes.comissao} format={money} icon={Percent} accent="red" footnote="Comissão dos canais" />
                <MetricTile dense label="Devoluções / mês" value={reembolsoMes} format={money} icon={RotateCcw} accent="red" footnote="Reembolsos do mês" />
                <MetricTile dense label="Custos operac. / mês" value={totalOp} format={money} icon={Building2} accent="red" footnote="Overhead fixo da empresa" />
                <MetricTile dense label="Anúncios / mês" value={gastoAds} format={money} icon={Megaphone} accent="red" footnote="Tráfego pago (Ads)" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* daily / monthly / yearly GROSS sales from the ledger (no cost deductions) */}
        <Ocultavel id="painel.vendasDia" label="Vendas no dia" className={`col-span-12 ${spanClass(linhaPeriodos, "painel.vendasDia")}`}>
          <PeriodCard label="Vendas no dia" periodo={diario} sublabel={diario.atual ? labelDia(diario.atual.chave) : undefined} hint="Bruto — sem descontos de custos" delay={0.05} />
        </Ocultavel>
        <Ocultavel id="painel.vendasMes" label="Vendas no mês" className={`col-span-12 ${spanClass(linhaPeriodos, "painel.vendasMes")}`}>
          <PeriodCard label="Vendas no mês" periodo={mensal} sublabel={mensal.atual ? labelMes(mensal.atual.chave) : undefined} hint="Bruto — sem descontos de custos" delay={0.1} />
        </Ocultavel>
        <Ocultavel id="painel.vendasAno" label="Vendas no ano" className={`col-span-12 ${spanClass(linhaPeriodos, "painel.vendasAno")}`}>
          <PeriodCard label="Vendas no ano" periodo={anual} sublabel={anual.atual?.chave} hint="Bruto — sem descontos de custos" delay={0.15} />
        </Ocultavel>

        {/* sales over time (Amazon) + counters */}
        <Ocultavel id="painel.amazon" label="Vendas no tempo · Amazon" className={`col-span-12 ${spanClass(linhaTempo, "painel.amazon")}`}>
        <GlowCard className="h-full" delay={0.2}>
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
        </Ocultavel>

        <Ocultavel id="painel.contadores" label="Produtos e países" className={`col-span-12 ${spanClass(linhaTempo, "painel.contadores")}`}>
          <GlowCard className="flex h-full flex-col justify-center gap-4" delay={0.25}>
            <Counter icon={Package} label="Total de produtos" value={produtos.length} accent="green" />
            <div className="border-t border-line" />
            <Counter icon={MapPin} label="Locais de venda · países" value={porPais.length} accent="gold" />
          </GlowCard>
        </Ocultavel>

        {/* global reach: globe + sales by country */}
        <Ocultavel id="painel.globo" label="Alcance global" className={`col-span-12 ${spanClass(linhaGlobal, "painel.globo")}`}>
        <GlowCard accent="green" grid className="h-full" delay={0.3}>
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
        </Ocultavel>

        <Ocultavel id="painel.porPais" label="Vendas por país" className={`col-span-12 ${spanClass(linhaGlobal, "painel.porPais")}`}>
          <SalesByCountry dados={porPais} delay={0.35} />
        </Ocultavel>

        {/* capital + potencial de receita + re-avaliar */}
        <Ocultavel id="painel.capital" label="Capital em estoque" className={`col-span-12 ${spanClass(linhaFinal, "painel.capital")}`}>
          <MetricTile label="Capital em estoque" value={t.capitalEstoque} format={money} icon={Wallet} accent="gold" footnote="Capital travado p/ manter 1 caixa de cada produto" delay={0.4} className="h-full" />
        </Ocultavel>

        <Ocultavel id="painel.potencial" label="Potencial de receita" className={`col-span-12 ${spanClass(linhaFinal, "painel.potencial")}`}>
          <MetricTile label="Potencial de receita / mês" value={t.receitaMensal} format={money} icon={TrendingUp} accent="green" footnote="Projeção · preço × vendas/mês prevista (não é venda realizada)" delay={0.42} className="h-full" />
        </Ocultavel>

        <Ocultavel id="painel.reavaliar" label="Fila de re-avaliação" className={`col-span-12 ${spanClass(linhaFinal, "painel.reavaliar")}`}>
        <GlowCard className="h-full" delay={0.45}>
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
        </Ocultavel>

        {/* nothing left visible — never leave the user on a blank page */}
        {todosOcultos && (
          <GlowCard className="col-span-12">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <EyeOff size={22} className="text-txtFaint" />
              <p className="text-sm text-txtDim">Todos os cards estão ocultos.</p>
              <button
                onClick={() => mostrarCards(CARDS.map((c) => c.id))}
                className="rounded-chip border border-lineStrong bg-greenSoft px-4 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
              >
                Mostrar tudo
              </button>
            </div>
          </GlowCard>
        )}
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
