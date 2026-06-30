import { ArrowDown, ArrowUp, Box, PackageOpen, RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { simularCenario, type CenarioInput } from "../calc/engine";
import type { Produto } from "../calc/types";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, number, percent } from "../i18n/format";
import { COLORS, STATUS_COLOR } from "../theme/tokens";
import { useStore } from "../store/useStore";

/** The three live dials. Everything else (imposto, comissão, qtd/caixa) comes from the base product. */
type Cenario = { preco: number; custo: number; vendas: number };

const cenarioDe = (p: Produto): Cenario => ({
  preco: p.precoVenda,
  custo: p.custoUnit,
  vendas: p.vendasMes,
});

const STATUS_LABEL: Record<string, string> = {
  verde: "Margem saudável",
  amarelo: "Pode melhorar",
  vermelho: "Abaixo do ideal",
};

export function Simulacoes() {
  const produtos = useStore((s) => s.produtos);
  const nav = useNavigate();

  const [selId, setSelId] = useState(() => produtos[0]?.id ?? "");
  const base = produtos.find((p) => p.id === selId) ?? produtos[0];
  const [cen, setCen] = useState<Cenario>(() => (produtos[0] ? cenarioDe(produtos[0]) : { preco: 0, custo: 0, vendas: 0 }));

  if (!base) {
    return (
      <Screen eyebrow="Projeções" title="Simulações" subtitle="Modele cenários de preço, custo e volume para qualquer produto.">
        <GlowCard>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageOpen size={28} className="text-txtFaint" />
            <p className="text-sm text-txtDim">Cadastre um produto para começar a simular cenários.</p>
            <button
              onClick={() => nav("/produtos/novo")}
              className="rounded-chip border border-lineStrong bg-greenSoft px-4 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
            >
              Adicionar produto
            </button>
          </div>
        </GlowCard>
      </Screen>
    );
  }

  const selecionar = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    setSelId(id);
    setCen(cenarioDe(p));
  };
  const set = <K extends keyof Cenario>(k: K, v: number) => setCen((c) => ({ ...c, [k]: v }));
  const reset = () => setCen(cenarioDe(base));

  // slider ranges scale off the product's real values, with sane floors so tiny products still slide
  const rng = useMemo(
    () => ({
      preco: { min: 0, max: Math.max(Math.ceil(base.precoVenda * 2.5), 50), step: 0.5 },
      custo: { min: 0, max: Math.max(+(base.custoUnit * 2.5).toFixed(2), 10), step: 0.1 },
      vendas: { min: 0, max: Math.max(Math.ceil(base.vendasMes * 3), 50), step: 1 },
    }),
    [base],
  );

  const fixos = {
    qtdCaixa: base.qtdCaixa,
    imposto: base.imposto,
    comissao: base.comissao,
    custoEmbalagem: base.custoEmbalagem,
  };
  const atual = useMemo<CenarioInput>(
    () => ({ precoVenda: base.precoVenda, custoUnit: base.custoUnit, vendasMes: base.vendasMes, ...fixos }),
    [base],
  );
  const cenario = useMemo<CenarioInput>(
    () => ({ precoVenda: cen.preco, custoUnit: cen.custo, vendasMes: cen.vendas, ...fixos }),
    [cen, base],
  );
  const a = useMemo(() => simularCenario(atual), [atual]);
  const s = useMemo(() => simularCenario(cenario), [cenario]);

  const mudou = cen.preco !== base.precoVenda || cen.custo !== base.custoUnit || cen.vendas !== base.vendasMes;

  return (
    <Screen
      eyebrow="Projeções"
      title="Simulações"
      subtitle="Arraste preço, custo e volume para ver toda a conta do mês — sem alterar seus produtos."
    >
      <div className="grid grid-cols-12 gap-4">
        {/* controls */}
        <div className="col-span-12 lg:col-span-7">
          <GlowCard>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-txtDim">Produto</span>
                <select
                  value={selId}
                  onChange={(e) => selecionar(e.target.value)}
                  className="min-w-[260px] rounded-chip border border-line bg-bgRaise/60 px-3 py-2 font-mono text-sm text-txt outline-none transition-colors focus:border-green"
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={reset}
                disabled={!mudou}
                className="flex items-center gap-2 rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt disabled:cursor-not-allowed disabled:opacity-40"
                title="Voltar aos valores atuais do produto"
              >
                <RotateCcw size={14} /> Valores atuais
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <Slider
                label="Preço de venda"
                value={cen.preco}
                base={base.precoVenda}
                {...rng.preco}
                onChange={(v) => set("preco", v)}
                fmt={money}
              />
              <Slider
                label="Custo do fornecedor (un)"
                value={cen.custo}
                base={base.custoUnit}
                {...rng.custo}
                onChange={(v) => set("custo", v)}
                fmt={money}
                accent={COLORS.gold}
              />
              <Slider
                label="Vendas no mês (unidades)"
                value={cen.vendas}
                base={base.vendasMes}
                {...rng.vendas}
                onChange={(v) => set("vendas", v)}
                fmt={(v) => `${number(v)} un`}
              />
            </div>

            {/* fixed context */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Chip label="Imposto" value={percent(base.imposto)} />
              <Chip label="Comissão" value={percent(base.comissao)} />
              <Chip label="Qtd/caixa" value={number(base.qtdCaixa)} />
              {base.custoEmbalagem ? <Chip label="Embalagem" value={money(base.custoEmbalagem)} /> : null}
            </div>

            <p className="mt-4 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-txtFaint">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-amber" />
              Projeção hipotética. Assume que imposto, comissão e demais custos não mudam além dos valores informados —
              nada aqui altera seus produtos.
            </p>
          </GlowCard>
        </div>

        {/* headline result */}
        <div className="col-span-12 lg:col-span-5">
          <GlowCard accent="gold" grid className="lg:sticky lg:top-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-goldSoft">
                <SlidersHorizontal size={15} className="text-gold" strokeWidth={2} />
              </span>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Cenário projetado</span>
            </div>

            {/* margin */}
            <div className="border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-5xl font-semibold tabular-nums" style={{ color: STATUS_COLOR[s.statusCor] }}>
                  {percent(s.margem)}
                </span>
                <StatusDot cor={s.statusCor} />
              </div>
              <p className="mt-2 font-mono text-xs text-txtDim">
                {STATUS_LABEL[s.statusCor]} · lucro {money(s.lucroUnit)}/un
              </p>
            </div>

            {/* monthly profit — the headline number */}
            <div className="mt-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-txtFaint">Lucro líquido / mês</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span
                  className="font-mono text-3xl font-semibold tabular-nums"
                  style={{ color: s.lucroMes >= 0 ? COLORS.green : COLORS.danger }}
                >
                  {money(s.lucroMes)}
                </span>
                <Delta atual={a.lucroMes} cenario={s.lucroMes} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
              <Cell label="Faturamento / mês" value={money(s.faturamentoMes)} />
              <Cell label="Lucro / unidade" value={money(s.lucroUnit)} />
              <Cell label="Valor líquido / un" value={money(s.valorLiquido)} />
              <Cell label="Frete embutido / un" value={money(s.freteUnit)} />
              <Cell label="Lucro / caixa" value={money(s.lucroCaixa)} />
              <Cell label="Capital p/ 1 caixa" value={money(s.capitalCaixa)} />
              <Cell
                label="Payback do estoque"
                value={s.paybackMeses != null ? `${number(s.paybackMeses)} ${s.paybackMeses <= 1 ? "mês" : "meses"}` : "—"}
              />
            </div>
          </GlowCard>
        </div>

        {/* monthly P&L compare */}
        <div className="col-span-12">
          <GlowCard delay={0.1}>
            <div className="mb-4 flex items-center gap-2">
              <Box size={15} className="text-txtDim" />
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Resultado mensal — atual vs. cenário</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Linha", "Atual", "Cenário", "Diferença"].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint ${i === 0 ? "" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <PnLRow label="Faturamento bruto" atual={a.faturamentoMes} cenario={s.faturamentoMes} bom="cima" />
                  <PnLRow label="− Custo do produto" atual={a.custoMes} cenario={s.custoMes} bom="baixo" />
                  <PnLRow label="− Imposto" atual={a.impostoMes} cenario={s.impostoMes} bom="baixo" />
                  <PnLRow label="− Comissão" atual={a.comissaoMes} cenario={s.comissaoMes} bom="baixo" />
                  <PnLRow label="− Frete" atual={a.freteMes} cenario={s.freteMes} bom="baixo" />
                  {(a.embalagemMes > 0 || s.embalagemMes > 0) && (
                    <PnLRow label="− Embalagem" atual={a.embalagemMes} cenario={s.embalagemMes} bom="baixo" />
                  )}
                  <PnLRow label="= Lucro líquido" atual={a.lucroMes} cenario={s.lucroMes} bom="cima" destaque />
                </tbody>
              </table>
            </div>
          </GlowCard>
        </div>
      </div>
    </Screen>
  );
}

function Slider({
  label,
  value,
  base,
  min,
  max,
  step,
  onChange,
  fmt,
  accent = COLORS.green,
}: {
  label: string;
  value: number;
  base: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
  accent?: string;
}) {
  const mudou = value !== base;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtDim">{label}</span>
        <span className="flex items-baseline gap-2">
          {mudou && <span className="font-mono text-[10px] text-txtFaint">atual {fmt(base)}</span>}
          <span className="font-mono text-base font-semibold tabular-nums text-txt">{fmt(value)}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: accent }}
        className="w-full cursor-pointer"
      />
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-chip border border-line bg-bgRaise/40 px-2.5 py-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-txtFaint">{label}</span>
      <span className="font-mono text-xs tabular-nums text-txtDim">{value}</span>
    </span>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-txtFaint">{label}</div>
      <div className="font-mono text-sm tabular-nums text-txt">{value}</div>
    </div>
  );
}

/** Signed delta chip — green/red driven by whether "up" is good for this line. */
function Delta({ atual, cenario }: { atual: number; cenario: number }) {
  const d = cenario - atual;
  if (Math.abs(d) < 0.005) return null;
  const up = d > 0;
  const color = up ? COLORS.green : COLORS.danger;
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-xs tabular-nums" style={{ color }}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {money(Math.abs(d))}
    </span>
  );
}

function PnLRow({
  label,
  atual,
  cenario,
  bom,
  destaque = false,
}: {
  label: string;
  atual: number;
  cenario: number;
  bom: "cima" | "baixo";
  destaque?: boolean;
}) {
  const d = cenario - atual;
  const flat = Math.abs(d) < 0.005;
  const positivoBom = bom === "cima" ? d > 0 : d < 0;
  const deltaColor = flat ? COLORS.txtFaint : positivoBom ? COLORS.green : COLORS.danger;
  return (
    <tr className={`border-b border-line/60 ${destaque ? "bg-greenSoft/20" : ""}`}>
      <td className={`px-4 py-2.5 text-sm ${destaque ? "font-semibold text-txt" : "text-txtDim"}`}>{label}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-txtDim">{money(atual)}</td>
      <td className={`px-4 py-2.5 text-right font-mono text-sm tabular-nums ${destaque ? "font-semibold text-txt" : "text-txt"}`}>
        {money(cenario)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums" style={{ color: deltaColor }}>
        {flat ? "—" : `${d > 0 ? "+" : "−"}${money(Math.abs(d))}`}
      </td>
    </tr>
  );
}
