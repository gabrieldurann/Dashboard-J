import { Calculator, FolderOpen, Save, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { COMISSAO_PADRAO, IMPOSTO_PADRAO } from "../calc/constants";
import { capitalParaEstoque, precoParaMargem } from "../calc/engine";
import type { CalculoSalvo } from "../calc/types";
import { Field, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { date, money, percent } from "../i18n/format";
import { useStore } from "../store/useStore";

type Form = {
  nome: string;
  fornecedor: string;
  custoUnit: number;
  imposto: number;
  comissao: number;
  custoEmbalagem: number;
  qtdCaixa: number;
  margemDesejada: number;
  room: number;
};

const inicial: Form = {
  nome: "",
  fornecedor: "",
  custoUnit: 0,
  imposto: IMPOSTO_PADRAO,
  comissao: COMISSAO_PADRAO,
  custoEmbalagem: 0,
  qtdCaixa: 0,
  margemDesejada: 0.15,
  room: 0.03,
};

export function Calculadora() {
  const [f, setF] = useState<Form>(inicial);
  const calculos = useStore((s) => s.calculosSalvos);
  const addCalculo = useStore((s) => s.addCalculo);
  const removeCalculo = useStore((s) => s.removeCalculo);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const r = useMemo(
    () =>
      precoParaMargem({
        custoUnit: f.custoUnit,
        margemDesejada: f.margemDesejada,
        imposto: f.imposto,
        comissao: f.comissao,
        custoEmbalagem: f.custoEmbalagem,
        room: f.room,
      }),
    [f],
  );
  const capital = capitalParaEstoque(f.custoUnit, f.qtdCaixa);
  const valido = Number.isFinite(r.precoSugerido) && f.custoUnit > 0;

  const salvar = () => {
    if (!valido) return;
    const c: CalculoSalvo = {
      id: crypto.randomUUID(),
      nome: f.nome.trim() || "Cálculo sem nome",
      custoUnit: f.custoUnit,
      fornecedor: f.fornecedor || undefined,
      imposto: f.imposto,
      comissao: f.comissao,
      custoEmbalagem: f.custoEmbalagem,
      margemDesejada: f.margemDesejada,
      precoSugerido: r.precoSugerido,
      criadoEm: new Date().toISOString(),
    };
    addCalculo(c);
  };

  const carregar = (c: CalculoSalvo) =>
    setF((p) => ({
      ...p,
      nome: c.nome,
      fornecedor: c.fornecedor ?? "",
      custoUnit: c.custoUnit,
      imposto: c.imposto,
      comissao: c.comissao,
      custoEmbalagem: c.custoEmbalagem,
      margemDesejada: c.margemDesejada,
    }));

  return (
    <Screen
      eyebrow="Precificação"
      title="Calculadora"
      subtitle="Informe custo e margem desejada — descubra por quanto vender, com folga e impacto do frete. Não altera seus produtos."
    >
      <div className="grid grid-cols-12 gap-4">
        {/* inputs */}
        <div className="col-span-12 lg:col-span-7">
          <GlowCard>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Nome do produto" hint="Opcional — só para salvar">
                  <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Mini ventilador USB" />
                </Field>
              </div>
              <Field label="Fornecedor">
                <TextInput value={f.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
              </Field>
              <Field label="Custo fornecedor (un)">
                <NumberInput value={f.custoUnit} onValue={(v) => set("custoUnit", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Margem desejada">
                <NumberInput
                  value={Math.round(f.margemDesejada * 1000) / 10}
                  onValue={(v) => set("margemDesejada", (v ?? 0) / 100)}
                  unit="%"
                />
              </Field>
              <Field label="Folga ±" hint="Faixa de preço sugerida">
                <NumberInput
                  value={Math.round(f.room * 1000) / 10}
                  onValue={(v) => set("room", (v ?? 0) / 100)}
                  unit="%"
                />
              </Field>
              <Field label="Imposto" hint="Padrão 4%">
                <NumberInput value={Math.round(f.imposto * 1000) / 10} onValue={(v) => set("imposto", (v ?? 0) / 100)} unit="%" />
              </Field>
              <Field label="Comissão categoria" hint="11–15%">
                <NumberInput value={Math.round(f.comissao * 1000) / 10} onValue={(v) => set("comissao", (v ?? 0) / 100)} unit="%" />
              </Field>
              <Field label="Custo embalagem/branding (un)" hint="Opcional">
                <NumberInput value={f.custoEmbalagem} onValue={(v) => set("custoEmbalagem", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Qtd. por caixa" hint="Para o capital de estoque">
                <NumberInput value={f.qtdCaixa} onValue={(v) => set("qtdCaixa", v ?? 0)} />
              </Field>
            </div>

            <button
              onClick={salvar}
              disabled={!valido}
              className="mt-6 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={15} /> Salvar cálculo
            </button>
          </GlowCard>
        </div>

        {/* result */}
        <div className="col-span-12 lg:col-span-5">
          <GlowCard accent="gold" grid className="lg:sticky lg:top-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-goldSoft">
                <Calculator size={15} className="text-gold" strokeWidth={2} />
              </span>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Preço sugerido</span>
            </div>

            {!valido ? (
              <div className="flex items-start gap-2 py-6 text-sm text-txtDim">
                <TriangleAlert size={16} className="mt-0.5 text-amber" />
                <span>
                  Informe um <span className="text-txt">custo</span> válido. A soma imposto + comissão + margem precisa
                  ser menor que 100%.
                </span>
              </div>
            ) : (
              <>
                <div className="border-b border-line pb-4">
                  <span className="font-mono text-5xl font-semibold tabular-nums text-gold">{money(r.precoSugerido)}</span>
                  <p className="mt-2 font-mono text-xs text-txtDim">
                    Faixa: <span className="text-txt">{money(r.faixaMin)}</span> — <span className="text-txt">{money(r.faixaMax)}</span>
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Row label="Margem alvo" value={percent(f.margemDesejada)} accent />
                  <Row label="Preço sem frete" value={money(r.precoSemFrete)} />
                  <Row label="Impacto do frete" value={`+ ${money(r.impactoFrete)}`} />
                  <Row label="Capital p/ 1 caixa" value={money(capital)} />
                </div>
                <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] leading-relaxed text-txtFaint">
                  O frete acrescenta {money(r.impactoFrete)} ao preço para manter a margem. Acima de R$79 o frete é
                  grátis — por isso o "preço sem frete".
                </p>
              </>
            )}
          </GlowCard>
        </div>

        {/* saved */}
        <div className="col-span-12">
          <GlowCard delay={0.1}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Cálculos salvos</span>
              <span className="font-mono text-xs text-txtFaint">{calculos.length} salvos</span>
            </div>
            {calculos.length === 0 ? (
              <p className="py-6 text-center text-sm text-txtDim">Nenhum cálculo salvo ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {calculos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-txt">{c.nome}</div>
                      <div className="font-mono text-[11px] text-txtFaint">
                        custo {money(c.custoUnit)} · margem {percent(c.margemDesejada)} · {date(c.criadoEm)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm tabular-nums text-gold">{money(c.precoSugerido)}</span>
                      <button
                        onClick={() => carregar(c)}
                        className="text-txtDim transition-colors hover:text-green"
                        title="Carregar no formulário"
                      >
                        <FolderOpen size={15} />
                      </button>
                      <button
                        onClick={() => removeCalculo(c.id)}
                        className="text-txtDim transition-colors hover:text-danger"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlowCard>
        </div>
      </div>
    </Screen>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-txtFaint">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${accent ? "text-green" : "text-txt"}`}>{value}</div>
    </div>
  );
}
