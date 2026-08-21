import {
  Megaphone, Building2, ChevronDown, Coins, EyeOff, Globe as GlobeIcon, Landmark, LineChart, MapPin, Package, Percent, RotateCcw, Wallet, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  calcularMetricas,
  capitalEmEstoque,
  dre,
  maisVendidos,
  mesesComVendas,
  preencherMeses,
  produtosDaLoja,
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
  vendasPorSemana,
  variacaoSemanalPorProduto,
} from "../calc/engine";
import type { MaisVendido } from "../calc/engine";
import type { Venda } from "../calc/types";
import { EASE } from "../theme/tokens";
import { AreaChart } from "../components/AreaChart";
import { AvisoSkuSemCusto } from "../components/AvisoSkuSemCusto";
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
import { labelDia, labelMes, labelSemana, mesCurto, money, percent } from "../i18n/format";
import { useStore } from "../store/useStore";
import { useEscopo } from "../store/useEscopo";
import { useConfig } from "../store/useConfig";

// Cards the user can hide (idea: keep the Painel readable for whoever is looking at it).
// `essencial` ones survive the "Só o essencial" preset.
const CARDS: CardRegistrado[] = [
  { id: "painel.margem", label: "Margem realizada + saúde", essencial: true },
  { id: "painel.lucroLiquido", label: "Lucro líquido / mês", essencial: true },
  { id: "painel.vendas", label: "Vendas no período", essencial: true },
  { id: "painel.lucroSemOp", label: "Lucro s/ operacional" },
  { id: "painel.amazon", label: "Vendas no tempo · Amazon" },
  { id: "painel.contadores", label: "Produtos e países", essencial: true },
  { id: "painel.globo", label: "Alcance global (globo)" },
  { id: "painel.porPais", label: "Vendas por país" },
  { id: "painel.capital", label: "Capital em estoque" },
  { id: "painel.reavaliar", label: "Fila de re-avaliação" },
];

/**
 * The one period card's options. `label` is the card title, `rotulo` the selector chip, and
 * `curto` names the timeframe on its own — the best-sellers panel sits below the card rather
 * than inside it, so it has to say which period it belongs to.
 */
const PERIODOS = [
  { id: "dia", rotulo: "Dia", label: "Vendas no dia", curto: "no dia" },
  { id: "semana", rotulo: "Semana", label: "Vendas na semana", curto: "na semana" },
  { id: "mes", rotulo: "Mês", label: "Vendas no mês", curto: "no mês" },
  { id: "ano", rotulo: "Ano", label: "Vendas no ano", curto: "no ano" },
] as const;
type PeriodoId = (typeof PERIODOS)[number]["id"];

export function Painel() {
  const cfg = useConfig();
  const produtos = useStore((s) => s.produtos);
  // scoped to the selected storefront — see useEscopo
  const escopo = useEscopo();
  const vendas = escopo.vendas;
  const devolucoes = escopo.devolucoes;
  const custosOperacionais = escopo.custosOperacionais;
  const anunciosAds = escopo.anunciosAds;

  /**
   * The catalogue this view is about.
   *
   * Capital em estoque, the product counters and the re-avaliação queue are all product-level, and
   * the catalogue is shared across storefronts — so they are scoped by narrowing the PRODUCT SET
   * rather than by redefining the metrics. Each keeps its exact meaning; "Todas" keeps the whole
   * catalogue (including items with no movement yet, which is precisely what the re-avaliação
   * queue exists to flag), and a storefront keeps what it actually trades.
   */
  const produtosEscopo = useMemo(
    () =>
      escopo.todas
        ? produtos
        : produtosDaLoja(produtos, vendas, escopo.compras, devolucoes),
    [escopo.todas, produtos, vendas, escopo.compras, devolucoes],
  );
  const t = useMemo(() => totaisPortfolio(produtosEscopo, cfg), [produtosEscopo, cfg]);

  /**
   * Money actually sitting in stock, at cost.
   *
   * A real sum rather than the per-product projection `totaisPortfolio` carries: every unit is in
   * exactly one storefront, so the stores add up to the company. The opening balance no longer
   * needs special handling here — it is booked as purchases in the ledger like everything else —
   * but the flag stays wired for any product that still carries one.
   */
  const capitalEstoque = useMemo(
    () => capitalEmEstoque(produtosEscopo, escopo.compras, vendas, devolucoes, escopo.todas),
    [produtosEscopo, escopo.compras, vendas, devolucoes, escopo.todas],
  );

  // reveal/hide the deduction cascade + the secondary metric cards
  const [detalhes, setDetalhes] = useState(false);
  // which timeframe the single sales card is showing — the day is what gets checked daily
  const [periodo, setPeriodo] = useState<PeriodoId>("dia");
  // the best-sellers list folded into that card
  const [maisVendidosAberto, setMaisVendidosAberto] = useState(false);

  // per-card visibility (the eye control) — a display preference, persisted per browser
  const cardsOcultos = useStore((s) => s.cardsOcultos);
  const mostrarCards = useStore((s) => s.mostrarCards);
  const todosOcultos = CARDS.every((c) => cardsOcultos.includes(c.id));
  const visivel = (id: string) => !cardsOcultos.includes(id);

  // "Money in the pocket" reads better as green on a light surface; the dark HUD keeps its gold.
  const claro = useStore((s) => s.tema) === "claro";
  const acento = claro ? "green" : "gold";

  // Rows re-split their 12 columns over whatever is still visible, so hiding a card never
  // leaves a hole — the neighbours grow to fill it.
  const linhaHero = distribuir([
    { id: "painel.margem", peso: 5, visivel: visivel("painel.margem") },
    { id: "painel.lucroLiquido", peso: 7, visivel: visivel("painel.lucroLiquido") },
  ]);
  const linhaVendas = distribuir([
    { id: "painel.vendas", peso: 6, visivel: visivel("painel.vendas") },
    { id: "painel.lucroSemOp", peso: 6, visivel: visivel("painel.lucroSemOp") },
  ]);
  const linhaTempo = distribuir([
    { id: "painel.amazon", peso: 8, visivel: visivel("painel.amazon") },
    { id: "painel.capital", peso: 4, visivel: visivel("painel.capital") },
  ]);
  const linhaGlobal = distribuir([
    { id: "painel.globo", peso: 6, visivel: visivel("painel.globo") },
    { id: "painel.porPais", peso: 6, visivel: visivel("painel.porPais") },
  ]);
  const linhaFinal = distribuir([
    { id: "painel.reavaliar", peso: 8, visivel: visivel("painel.reavaliar") },
    { id: "painel.contadores", peso: 4, visivel: visivel("painel.contadores") },
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

  // sales by timeframe (all channels), latest period vs previous. All four are computed because
  // the month is the Painel's own reference period regardless of what the card is showing.
  const mensal = useMemo(() => resumoPeriodo(vendasPorMes(vendas)), [vendas]);
  const porPeriodo = useMemo(
    () => ({
      dia: resumoPeriodo(vendasPorDia(vendas)),
      semana: resumoPeriodo(vendasPorSemana(vendas)),
      mes: mensal,
      ano: resumoPeriodo(vendasPorAno(vendas)),
    }),
    [vendas, mensal],
  );
  const periodoAtivo = porPeriodo[periodo];
  const rotuloPeriodo = (chave: string) =>
    periodo === "dia" ? labelDia(chave) : periodo === "semana" ? labelSemana(chave) : periodo === "mes" ? labelMes(chave) : chave;

  /** Does this sale fall in the period the card is currently showing? */
  const noPeriodo = (v: Venda, chave: string) => {
    const d = new Date(v.data);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (periodo === "dia") return dia === chave;
    if (periodo === "mes") return dia.slice(0, 7) === chave;
    if (periodo === "ano") return dia.slice(0, 4) === chave;
    // week: the key IS the Monday, so compare against the same window the aggregation used
    const seg = new Date(chave);
    const fim = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 7);
    return d >= seg && d < fim;
  };

  // best sellers of whatever period is on screen, plus each one's week-over-week move
  const topVendidos = useMemo(() => {
    const chave = periodoAtivo.atual?.chave;
    if (!chave) return [];
    return maisVendidos(vendas.filter((v) => noPeriodo(v, chave)), produtos, cfg, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendas, produtos, cfg, periodo, periodoAtivo.atual?.chave]);
  const variacaoSemanal = useMemo(() => variacaoSemanalPorProduto(vendas), [vendas]);
  // the rollup carries no product code, so the panel borrows it from the catalog for the
  // name/código pair each row shows
  const codigos = useMemo(
    () => new Map(produtos.map((p) => [p.id, p.codigoProduto])),
    [produtos],
  );

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

  /**
   * Company overhead that this view is NOT carrying.
   *
   * Rent, accounting and internet belong to the company, not to a storefront — pro-rating them
   * across stores would be an allocation rather than something that happened. So a scoped bottom
   * line legitimately excludes them, and saying so is the difference between an honest figure and
   * a store that merely looks more profitable than it is.
   */
  const custosTodasLojas = useStore((st) => st.custosOperacionais);
  const overheadNaoAtribuido = useMemo(
    () => (escopo.todas ? 0 : totalOperacional(custosTodasLojas, mesChave) - totalOp),
    [escopo.todas, custosTodasLojas, mesChave, totalOp],
  );

  // Last month's bottom line, for the comparison on the profit card. Taken from `dre` rather than
  // recomputed here so the Painel and the DRE page can never drift apart on what "líquido" means.
  const lucroMesAnterior = useMemo(() => {
    if (!mesChave) return null;
    const meses = mesesComVendas(vendas);
    const anterior = meses[meses.indexOf(mesChave) + 1];
    if (!anterior) return null;
    return dre({ vendas, produtos, devolucoes, custosOperacionais, anuncios: anunciosAds }, anterior, cfg)
      .lucroLiquido;
  }, [vendas, produtos, devolucoes, custosOperacionais, anunciosAds, mesChave, cfg]);
  // two headline figures: profit before company overhead (all sale costs + returns), and the
  // true net "money in pocket" after overhead too.
  const lucroSemOperacional = resMes.lucro - reembolsoMes;
  const lucroLiquidoTotal = lucroSemOperacional - totalOp - gastoAds;
  // what share of the month's revenue actually survived to the bottom line
  const margemLiquidaMes = resMes.bruto > 0 ? lucroLiquidoTotal / resMes.bruto : 0;
  // …and the same share before the company's own overhead is taken out
  const margemSemOperacional = resMes.bruto > 0 ? lucroSemOperacional / resMes.bruto : 0;
  const variacaoLucro =
    lucroMesAnterior !== null && lucroMesAnterior !== 0
      ? (lucroLiquidoTotal - lucroMesAnterior) / Math.abs(lucroMesAnterior)
      : null;
  // week over week on REVENUE — the weekly buckets already carry it
  const variacaoSemanaReceita = porPeriodo.semana.variacao;

  // company-wide realized margin (blended profit ÷ gross over ALL sales) — not a per-product average
  const resTotal = useMemo(() => resultadoVendas(vendas, produtos, cfg), [vendas, produtos, cfg]);
  const margemRealizada = resTotal.bruto > 0 ? resTotal.lucro / resTotal.bruto : 0;

  // products to re-evaluate (red band), worst margin first
  const reavaliar = useMemo(
    () =>
      produtosEscopo
        .map((p) => ({ p, m: calcularMetricas(p, cfg) }))
        .filter((x) => x.m.statusCor === "vermelho")
        .sort((a, b) => a.m.margem - b.m.margem),
    [produtosEscopo, cfg],
  );

  // gauge: company realized margin scaled so 40% reads as a "full" healthy ring
  const gaugeValue = Math.max(0, Math.min(1, margemRealizada / 0.4));

  return (
    <Screen
      eyebrow="Visão Geral"
      title="Painel Principal"
      actions={<ExibicaoMenu cards={CARDS} />}
    >
      {/* temporary (see AvisoSkuSemCusto) — delete this line and the file to remove it */}
      <AvisoSkuSemCusto />

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

        {/*
          Profit headline. The deduction cascade and the cost tiles both live inside "Mais
          métricas", so the card itself is only ever the label, the number and the toggle.
        */}
        <Ocultavel id="painel.lucroLiquido" label="Lucro líquido / mês" className={`col-span-12 ${spanClass(linhaHero, "painel.lucroLiquido")}`}>
          <GlowCard accent={lucroLiquidoTotal >= 0 ? acento : "none"} className="h-full" preencher delay={0.05}>
            <div className="flex items-center gap-2">
              <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-chip ${claro ? "bg-greenSoft" : "bg-goldSoft"}`}>
                <Wallet size={15} className={claro ? "text-green" : "text-gold"} strokeWidth={2} />
              </span>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Lucro líquido / mês</span>
            </div>

            <div className="flex flex-1 items-center">
              <BigStat
                value={lucroLiquidoTotal}
                format={money}
                accent={lucroLiquidoTotal >= 0 ? (claro ? "text-green" : "text-gold") : "text-danger"}
                className="text-4xl 2xl:text-5xl"
              />
            </div>

            {/* what the number came out of, how much survived, and whether it is moving. The two
                comparisons name their subject: the monthly one is profit, the weekly one is
                revenue — a weekly profit would need the month's overhead pro-rated, which would
                be an allocation rather than something that happened that week. */}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
              <Resumo rotulo="Faturamento do mês" valor={money(resMes.bruto)} />
              <Resumo rotulo="Margem líquida" valor={percent(margemLiquidaMes)} />
              <Resumo
                rotulo="Lucro vs. mês ant."
                valor={variacaoLucro === null ? "—" : `${variacaoLucro >= 0 ? "+" : "−"}${percent(Math.abs(variacaoLucro))}`}
                cor={variacaoLucro === null ? undefined : variacaoLucro >= 0 ? "text-green" : "text-danger"}
              />
              <Resumo
                rotulo="Receita vs. sem. ant."
                valor={
                  variacaoSemanaReceita === null
                    ? "—"
                    : `${variacaoSemanaReceita >= 0 ? "+" : "−"}${percent(Math.abs(variacaoSemanaReceita))}`
                }
                cor={
                  variacaoSemanaReceita === null
                    ? undefined
                    : variacaoSemanaReceita >= 0
                      ? "text-green"
                      : "text-danger"
                }
              />
            </div>

            <button
              onClick={() => setDetalhes((v) => !v)}
              className="mt-3 flex items-center gap-1.5 self-start font-mono text-[11px] uppercase tracking-[0.1em] text-txtDim transition-colors hover:text-txt"
            >
              {detalhes ? "Menos" : "Mais"} métricas
              <ChevronDown size={13} className={`transition-transform ${detalhes ? "rotate-180" : ""}`} />
            </button>
          </GlowCard>
        </Ocultavel>

        {/* everything behind the toggle: how the headline was reached, then the costs behind it */}
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
              <GlowCard className="mb-4">
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
                {overheadNaoAtribuido > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-txtFaint">
                    Fora desta conta: {money(overheadNaoAtribuido)} de custos operacionais da empresa, que não
                    pertencem a uma loja específica.
                  </p>
                )}
              </GlowCard>
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

        {/* one sales card; the dropdown picks the timeframe. Shares the row with the profit
            before overhead, so both get half the width instead of the sales card being squeezed. */}
        <Ocultavel id="painel.vendas" label="Vendas no período" className={`col-span-12 ${spanClass(linhaVendas, "painel.vendas")}`}>
          <PeriodCard
            label={PERIODOS.find((p) => p.id === periodo)!.label}
            periodo={periodoAtivo}
            sublabel={periodoAtivo.atual ? rotuloPeriodo(periodoAtivo.atual.chave) : undefined}
            delay={0.15}
            acoes={
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as PeriodoId)}
                className="rounded-chip border border-line bg-panel px-2 py-1 font-mono text-[11px] text-txt outline-none"
              >
                {PERIODOS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            }
            rodape={
              <MaisVendidosBotao
                total={topVendidos.length}
                aberto={maisVendidosAberto}
                onAlternar={() => setMaisVendidosAberto((v) => !v)}
              />
            }
          />
        </Ocultavel>

        {/*
          Profit before the company's own overhead — the sale-level result on its own. It shares
          the row with the sales card, so it carries the two figures it is made of (realizado
          minus devoluções) rather than sitting as a lone number in half a row.
        */}
        <Ocultavel id="painel.lucroSemOp" label="Lucro s/ operacional" className={`col-span-12 ${spanClass(linhaVendas, "painel.lucroSemOp")}`}>
          <GlowCard accent="green" className="h-full" preencher delay={0.2}>
            <div className="flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                <Coins size={15} className="text-green" strokeWidth={2} />
              </span>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Lucro s/ operacional</span>
            </div>

            <div className="flex flex-1 items-center">
              <BigStat
                value={lucroSemOperacional}
                format={money}
                accent={lucroSemOperacional >= 0 ? "text-green" : "text-danger"}
                className="text-4xl 2xl:text-5xl"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
              <Resumo rotulo="Realizado" valor={money(resMes.lucro)} />
              <Resumo rotulo="Devoluções" valor={money(reembolsoMes)} cor="text-danger" />
              <Resumo rotulo="Margem s/ oper." valor={percent(margemSemOperacional)} />
            </div>
          </GlowCard>
        </Ocultavel>

        {/* The best-sellers list opens full width, the way "Mais métricas" does: the trigger stays
            in the sales card it belongs to, but eight columns of money never read in half a row. */}
        {visivel("painel.vendas") && (
          <AnimatePresence initial={false}>
            {maisVendidosAberto && (
              <motion.div
                key="mais-vendidos"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="col-span-12 overflow-hidden"
              >
                <MaisVendidosPainel
                  linhas={topVendidos}
                  variacao={variacaoSemanal}
                  codigos={codigos}
                  periodoTexto={`${PERIODOS.find((p) => p.id === periodo)!.curto}${
                    periodoAtivo.atual ? ` · ${rotuloPeriodo(periodoAtivo.atual.chave)}` : ""
                  }`}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* sales over time (Amazon) */}
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

        <Ocultavel id="painel.capital" label="Capital em estoque" className={`col-span-12 ${spanClass(linhaTempo, "painel.capital")}`}>
          <MetricTile label="Capital em estoque" value={capitalEstoque} format={money} icon={Wallet} accent="gold" delay={0.25} className="h-full" />
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

        {/* the re-evaluation queue closes the page. The revenue projection used to sit on this
            row; it lives on Relatórios now, in its own "Projetado" mode, beside the real figures. */}

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

        <Ocultavel id="painel.contadores" label="Produtos e países" className={`col-span-12 ${spanClass(linhaFinal, "painel.contadores")}`}>
          <GlowCard className="flex h-full flex-col justify-center gap-4" delay={0.45}>
            <Counter icon={Package} label="Total de produtos" value={produtosEscopo.length} accent="green" />
            <div className="border-t border-line" />
            <Counter icon={MapPin} label="Locais de venda · países" value={porPais.length} accent="gold" />
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

/** The trigger for the best-sellers panel. Lives in the sales card; the panel itself is below. */
function MaisVendidosBotao({ total, aberto, onAlternar }: { total: number; aberto: boolean; onAlternar: () => void }) {
  return (
    <button
      onClick={onAlternar}
      className="mt-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-txtDim transition-colors hover:text-txt"
    >
      Mais vendidos
      <span className="rounded-full bg-bgRaise px-1.5 py-0.5 text-[10px] text-txtFaint">{total}</span>
      <ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
    </button>
  );
}

/**
 * Columns of the best-sellers table, staged across two breakpoints. Bringing all three secondary
 * columns back at `xl` needed 994px in the 934px box 1280 leaves, so preço médio — the one figure
 * the row already implies (faturamento ÷ unidades) — waits for `2xl`.
 */
const MV_COLUNAS: { k: string; label: string; num?: boolean; cls?: string }[] = [
  { k: "produto", label: "Produto" },
  { k: "canal", label: "Canal", cls: "hidden xl:table-cell" },
  { k: "precoMedio", label: "Preço médio", num: true, cls: "hidden 2xl:table-cell" },
  { k: "unidades", label: "Unidades", num: true },
  { k: "bruto", label: "Total faturado", num: true },
  { k: "share", label: "Represent.", num: true, cls: "hidden xl:table-cell" },
  { k: "lucro", label: "Lucro", num: true },
  { k: "margem", label: "Margem", num: true },
  { k: "semana", label: "vs. sem.", num: true },
];

/**
 * Which products are actually carrying the period's total, at full width.
 *
 * Capped at 15 by `maisVendidos` and re-read whenever the timeframe changes, so the list always
 * describes the number in the sales card above it — `periodoTexto` says which period that is,
 * since the panel no longer sits inside the card.
 */
function MaisVendidosPainel({
  linhas,
  variacao,
  codigos,
  periodoTexto,
}: {
  linhas: MaisVendido[];
  variacao: Map<string, number | null>;
  codigos: Map<string, string | undefined>;
  periodoTexto: string;
}) {
  return (
    <GlowCard className="mb-4 overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3.5">
        <h3 className="font-display text-base text-txt">Produtos mais vendidos</h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
          {periodoTexto} · máx. 15
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="py-10 text-center text-sm text-txtDim">Nenhuma venda atribuída a produto no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {MV_COLUNAS.map((c) => (
                  <th
                    key={c.k}
                    className={`whitespace-nowrap px-2 py-2.5 xl:px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint ${
                      c.num ? "text-right" : ""
                    } ${c.cls ?? ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const v = variacao.get(l.produtoId) ?? null;
                const codigo = codigos.get(l.produtoId);
                return (
                  <tr key={l.produtoId} className="border-b border-line/60 transition-colors last:border-0 hover:bg-greenSoft/20">
                    {/* name over code, the way the marketplace consoles show it */}
                    <td className="max-w-[140px] xl:max-w-[200px] 2xl:max-w-[240px] px-2 py-3.5 xl:px-3">
                      <span className="block truncate text-[15px] leading-tight text-txt" title={l.nome}>
                        {l.nome}
                      </span>
                      {codigo && (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-txtFaint">{codigo}</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-2 py-3.5 xl:px-3 text-sm text-txtDim xl:table-cell">
                      {l.canal}
                    </td>
                    <td className="hidden whitespace-nowrap px-2 py-3.5 xl:px-3 text-right font-mono text-sm tabular-nums text-txtDim 2xl:table-cell">
                      {money(l.precoMedio)}
                    </td>
                    <td className="px-2 py-3.5 xl:px-3 text-right font-mono text-sm tabular-nums text-txt">
                      {l.unidades}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3.5 xl:px-3 text-right font-mono text-[15px] tabular-nums text-txt">
                      {money(l.bruto)}
                    </td>
                    <td className="hidden px-2 py-3.5 xl:px-3 text-right font-mono text-sm tabular-nums text-txtDim xl:table-cell">
                      {percent(l.share)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3.5 xl:px-3 text-right font-mono text-sm tabular-nums text-txt">
                      {money(l.lucro)}
                    </td>
                    <td className="px-2 py-3.5 xl:px-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-1 font-mono text-[11px] tabular-nums ${
                          MARGEM_BADGE[l.statusCor]
                        }`}
                      >
                        {percent(l.margem)}
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-2 py-3.5 xl:px-3 text-right font-mono text-sm tabular-nums ${
                        v === null ? "text-txtFaint" : v >= 0 ? "text-green" : "text-danger"
                      }`}
                      title="Receita desta semana contra a semana anterior"
                    >
                      {v === null ? "—" : `${v >= 0 ? "+" : "−"}${percent(Math.abs(v))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlowCard>
  );
}

/** Health-band pill for the margin cell (Tailwind can't see interpolated class names). */
const MARGEM_BADGE: Record<string, string> = {
  verde: "bg-greenSoft text-green",
  amarelo: "bg-amberSoft text-amber",
  vermelho: "bg-danger/12 text-danger",
};

/** One supporting figure under the profit headline. */
function Resumo({ rotulo, valor, cor = "text-txt" }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">{rotulo}</p>
      <p className={`mt-0.5 font-mono text-sm tabular-nums ${cor}`}>{valor}</p>
    </div>
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
