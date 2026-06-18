import { Coins, Plus, Receipt, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { VendaAvulsa } from "../calc/types";
import { Field, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { date, money, percent } from "../i18n/format";
import { useStore } from "../store/useStore";

type Form = {
  nome: string;
  data: string;
  precoVendido: number;
  custo: number;
  frete: number;
  observacao: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const inicial = (): Form => ({ nome: "", data: hoje(), precoVendido: 0, custo: 0, frete: 0, observacao: "" });

/** Lucro de uma venda avulsa (idea #4): preço vendido − custo − frete. */
const lucroVenda = (v: { precoVendido: number; custo: number; frete: number }) =>
  v.precoVendido - v.custo - v.frete;

export function VendasAvulsas() {
  const vendas = useStore((s) => s.vendasAvulsas);
  const addVenda = useStore((s) => s.addVendaAvulsa);
  const removeVenda = useStore((s) => s.removeVendaAvulsa);
  const [f, setF] = useState<Form>(inicial);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const lucroPrevia = lucroVenda(f);
  const margemPrevia = f.precoVendido > 0 ? lucroPrevia / f.precoVendido : 0;
  const valido = f.nome.trim() !== "" && f.precoVendido > 0;

  const totais = useMemo(() => {
    const totalVendido = vendas.reduce((s, v) => s + v.precoVendido, 0);
    const lucroTotal = vendas.reduce((s, v) => s + lucroVenda(v), 0);
    return { totalVendido, lucroTotal };
  }, [vendas]);

  const registrar = () => {
    if (!valido) return;
    const v: VendaAvulsa = {
      id: crypto.randomUUID(),
      nome: f.nome.trim(),
      data: f.data || hoje(),
      precoVendido: f.precoVendido,
      custo: f.custo,
      frete: f.frete,
      observacao: f.observacao || undefined,
    };
    addVenda(v);
    setF(inicial());
  };

  return (
    <Screen
      eyebrow="Manual"
      title="Vendas avulsas"
      subtitle="Entrada rápida de vendas fora do padrão (preço, custo e frete manuais) — aquelas que não seguem o catálogo."
    >
      <div className="grid grid-cols-12 gap-4">
        <MetricTile label="Total vendido (avulso)" value={totais.totalVendido} format={money} icon={Receipt} accent="gold" className="col-span-6 lg:col-span-3" />
        <MetricTile label="Lucro (avulso)" value={totais.lucroTotal} format={money} icon={Coins} accent="green" className="col-span-6 lg:col-span-3" delay={0.05} />

        {/* form */}
        <div className="col-span-12 lg:col-span-6">
          <GlowCard delay={0.1}>
            <span className="mb-4 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Nova venda</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Produto / descrição">
                  <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Lote de fones (venda casada)" />
                </Field>
              </div>
              <Field label="Preço vendido">
                <NumberInput value={f.precoVendido} onValue={(v) => set("precoVendido", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Custo">
                <NumberInput value={f.custo} onValue={(v) => set("custo", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Frete / entrega">
                <NumberInput value={f.frete} onValue={(v) => set("frete", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Data">
                <input
                  type="date"
                  value={f.data}
                  onChange={(e) => set("data", e.target.value)}
                  className="w-full rounded-chip border border-line bg-bgRaise/60 px-3 py-2 font-mono text-sm text-txt outline-none focus:border-green"
                />
              </Field>
              <div className="col-span-2">
                <Field label="Observação" hint="Opcional">
                  <TextInput value={f.observacao} onChange={(e) => set("observacao", e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-chip border border-line bg-bgRaise/40 px-4 py-3">
              <span className="font-mono text-xs text-txtDim">Lucro previsto</span>
              <span className="flex items-center gap-4 font-mono text-sm tabular-nums">
                <span className={lucroPrevia >= 0 ? "text-green" : "text-danger"}>{money(lucroPrevia)}</span>
                <span className="text-txtDim">{percent(margemPrevia)}</span>
              </span>
            </div>

            <button
              onClick={registrar}
              disabled={!valido}
              className="mt-4 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={15} /> Registrar venda
            </button>
          </GlowCard>
        </div>

        {/* list */}
        <div className="col-span-12 lg:col-span-6">
          <GlowCard delay={0.15}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Histórico</span>
              <span className="font-mono text-xs text-txtFaint">{vendas.length} vendas</span>
            </div>
            {vendas.length === 0 ? (
              <p className="py-8 text-center text-sm text-txtDim">Nenhuma venda avulsa registrada.</p>
            ) : (
              <ul className="divide-y divide-line">
                {vendas.map((v) => {
                  const lucro = lucroVenda(v);
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-txt">{v.nome}</div>
                        <div className="font-mono text-[11px] text-txtFaint">
                          {date(v.data)} · vendido {money(v.precoVendido)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-mono text-sm tabular-nums ${lucro >= 0 ? "text-green" : "text-danger"}`}>{money(lucro)}</span>
                        <button onClick={() => removeVenda(v.id)} className="text-txtDim transition-colors hover:text-danger" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlowCard>
        </div>
      </div>
    </Screen>
  );
}
