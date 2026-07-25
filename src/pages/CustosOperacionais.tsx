import { Building2, Coins, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  custosPorCategoria,
  resultadoVendas,
  resumoPeriodo,
  totalOperacional,
  vendasPorMes,
} from "../calc/engine";
import type { CategoriaCusto, CustoOperacional } from "../calc/types";
import { BigStat } from "../components/BigStat";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { money, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";
import { useConfig } from "../store/useConfig";

const CATEGORIA_LABEL: Record<CategoriaCusto, string> = {
  aluguel: "Aluguel",
  energia: "Energia",
  agua: "Água",
  internet: "Internet",
  telefone: "Telefone",
  software: "Software",
  salarios: "Salários",
  contabilidade: "Contabilidade",
  outros: "Outros",
};
const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaCusto[];

type Draft = { nome: string; categoria: CategoriaCusto; valorMensal: number; observacao: string };
const emptyDraft = (): Draft => ({ nome: "", categoria: "aluguel", valorMensal: 0, observacao: "" });

export function CustosOperacionais() {
  const cfg = useConfig();
  const custos = useStore((s) => s.custosOperacionais);
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);
  const addCusto = useStore((s) => s.addCustoOperacional);
  const updateCusto = useStore((s) => s.updateCustoOperacional);
  const removeCusto = useStore((s) => s.removeCustoOperacional);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(emptyDraft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const total = useMemo(() => totalOperacional(custos), [custos]);
  const breakdown = useMemo(() => custosPorCategoria(custos), [custos]);
  const maxShare = Math.max(...breakdown.map((b) => b.share), 0.0001);

  // realized profit for the latest month, then net of operating costs ("money in pocket")
  const mensal = useMemo(() => resumoPeriodo(vendasPorMes(vendas)), [vendas]);
  const mesChave = mensal.atual?.chave;
  const resMes = useMemo(
    () => resultadoVendas(mesChave ? vendas.filter((v) => v.data.slice(0, 7) === mesChave) : [], produtos, cfg),
    [vendas, produtos, mesChave, cfg],
  );
  const lucroLiquido = resMes.lucro - total;

  const abrirNovo = () => {
    setEditId(null);
    setD(emptyDraft());
    setShowForm(true);
  };
  const abrirEdicao = (c: CustoOperacional) => {
    setEditId(c.id);
    setD({ nome: c.nome, categoria: c.categoria, valorMensal: c.valorMensal, observacao: c.observacao ?? "" });
    setShowForm(true);
  };

  const valido = d.nome.trim() !== "" && d.valorMensal > 0;
  const salvar = () => {
    if (!valido) return;
    const limpo = { ...d, nome: d.nome.trim(), observacao: d.observacao.trim() || undefined };
    if (editId) {
      updateCusto(editId, limpo);
      toast.success("Custo atualizado");
    } else {
      addCusto({ id: crypto.randomUUID(), ...limpo });
      toast.success("Custo adicionado");
    }
    setShowForm(false);
    setEditId(null);
    setD(emptyDraft());
  };

  const excluir = async (c: CustoOperacional) => {
    const ok = await confirmAction({
      title: "Excluir custo?",
      message: `"${c.nome}" será removido dos custos operacionais.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeCusto(c.id);
    toast.success("Custo excluído");
  };

  return (
    <Screen
      eyebrow="Empresa"
      title="Custos Operacionais"
      subtitle="Custos fixos da empresa que não entram no custo dos produtos — e o lucro líquido depois deles."
      actions={
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Adicionar custo
        </button>
      }
    >
      {/* headline metrics */}
      <div className="mb-4 grid grid-cols-12 gap-4">
        <GlowCard accent={lucroLiquido >= 0 ? "green" : "none"} className="col-span-12 lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
              <Wallet size={15} className="text-green" strokeWidth={2} />
            </span>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Lucro líquido · após operacional</span>
          </div>
          <div className="mt-3">
            <BigStat value={lucroLiquido} format={money} accent={lucroLiquido >= 0 ? "text-green" : "text-danger"} className="text-3xl" />
          </div>
          <p className="mt-1.5 font-mono text-xs text-txtFaint">
            Lucro realizado do mês − custos operacionais. O que sobra no bolso (custos de anúncios entram na fase de Ads).
          </p>
        </GlowCard>

        <MetricTile
          label="Custos operacionais / mês"
          value={total}
          format={money}
          icon={Building2}
          accent="gold"
          footnote="Soma dos custos fixos mensais"
          delay={0.05}
          className="col-span-12 lg:col-span-4"
        />
        <MetricTile
          label="Lucro realizado / mês"
          value={resMes.lucro}
          format={money}
          icon={Coins}
          accent="green"
          footnote="Antes dos custos operacionais"
          delay={0.1}
          className="col-span-12 lg:col-span-4"
        />
      </div>

      {/* add / edit form */}
      {showForm && (
        <GlowCard className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
              {editId ? "Editar custo" : "Novo custo"}
            </span>
            <button onClick={() => setShowForm(false)} className="text-txtFaint hover:text-txt">
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Nome">
                <TextInput value={d.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Aluguel, Internet…" />
              </Field>
            </div>
            <Field label="Categoria">
              <select value={d.categoria} onChange={(e) => set("categoria", e.target.value as CategoriaCusto)} className={inputClass}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor mensal">
              <NumberInput value={d.valorMensal} onValue={(v) => set("valorMensal", v ?? 0)} unit="R$" />
            </Field>
            <div className="md:col-span-2 lg:col-span-4">
              <Field label="Observação">
                <TextInput value={d.observacao} onChange={(e) => set("observacao", e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-chip border border-line px-4 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={!valido}
              className="rounded-chip border border-lineStrong bg-greenSoft px-4 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {editId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </GlowCard>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* breakdown by category */}
        <GlowCard className="col-span-12 lg:col-span-5">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Por categoria</span>
          {breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-txtDim">Nenhum custo cadastrado.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {breakdown.map((b, i) => (
                <li key={b.categoria}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-txt">{CATEGORIA_LABEL[b.categoria]}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-sm tabular-nums text-gold">{money(b.valor)}</span>
                      <span className="w-12 text-right font-mono text-xs tabular-nums text-txtDim">{percent(b.share)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(b.share / maxShare) * 100}%` }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.05 * i }}
                      className="h-full rounded-full bg-gold"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        {/* list */}
        <GlowCard className="col-span-12 overflow-hidden p-0 lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Custo", "Categoria", "Valor / mês", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {custos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-txtDim">
                      Nenhum custo operacional ainda — adicione aluguel, internet, energia…
                    </td>
                  </tr>
                ) : (
                  custos.map((c) => (
                    <tr key={c.id} className="border-b border-line/60">
                      <td className="px-4 py-3 text-sm text-txt">
                        {c.nome}
                        {c.observacao && <span className="block font-mono text-[11px] text-txtFaint">{c.observacao}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtDim">
                          {CATEGORIA_LABEL[c.categoria]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-gold">{money(c.valorMensal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => abrirEdicao(c)} className="text-txtDim transition-colors hover:text-green" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => excluir(c)} className="text-txtDim transition-colors hover:text-danger" title="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlowCard>
      </div>
    </Screen>
  );
}
