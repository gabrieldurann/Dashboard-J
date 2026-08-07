import { Building2, Pencil, Plus, Trash2, TrendingUp, Wallet, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { AggCategoria } from "../calc/engine";
import {
  custosPorCategoria,
  resultadoVendas,
  resumoOperacional,
  resumoPeriodo,
  vendasPorMes,
} from "../calc/engine";
import type {
  CategoriaCusto,
  CategoriaOperacional,
  CategoriaReceita,
  CustoOperacional,
  TipoOperacional,
} from "../calc/types";
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

/** Operational income categories (Gestor Seller "Receitas Operacionais"). */
const RECEITA_LABEL: Record<CategoriaReceita, string> = {
  juros: "Juros e rendimentos",
  reembolso: "Reembolsos recebidos",
  servicos: "Serviços prestados",
  aluguel_recebido: "Aluguel recebido",
  outros_ganhos: "Outros ganhos",
};

const ROTULO: Record<CategoriaOperacional, string> = { ...CATEGORIA_LABEL, ...RECEITA_LABEL };

/** The category list depends on the tipo — rent is not a source of income. */
const CATEGORIAS_POR_TIPO: Record<TipoOperacional, CategoriaOperacional[]> = {
  despesa: Object.keys(CATEGORIA_LABEL) as CategoriaCusto[],
  receita: Object.keys(RECEITA_LABEL) as CategoriaReceita[],
};

const hoje = () => new Date().toISOString().slice(0, 10);

/** "2026-06-14" → "06/2026" — one-offs are read by the month they belong to, not the day. */
const mesCurto = (iso?: string) => {
  if (!iso) return "sem mês";
  const [ano, mes] = iso.slice(0, 7).split("-");
  return `${mes}/${ano}`;
};

type Draft = {
  nome: string;
  tipo: TipoOperacional;
  categoria: CategoriaOperacional;
  valorMensal: number;
  recorrente: boolean;
  data: string;
  observacao: string;
};
const emptyDraft = (): Draft => ({
  nome: "",
  tipo: "despesa",
  categoria: "aluguel",
  valorMensal: 0,
  recorrente: true,
  data: hoje(),
  observacao: "",
});

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

  // realized profit for the latest month, then net of operating costs ("money in pocket")
  const mensal = useMemo(() => resumoPeriodo(vendasPorMes(vendas)), [vendas]);
  const mesChave = mensal.atual?.chave;

  // everything on this page is read for that same month: recurring entries plus its one-offs
  const resumo = useMemo(() => resumoOperacional(custos, mesChave), [custos, mesChave]);
  const total = resumo.liquido;
  const despesasPorCat = useMemo(() => custosPorCategoria(custos, "despesa", mesChave), [custos, mesChave]);
  const receitasPorCat = useMemo(() => custosPorCategoria(custos, "receita", mesChave), [custos, mesChave]);
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
    setD({
      nome: c.nome,
      tipo: c.tipo ?? "despesa",
      categoria: c.categoria,
      valorMensal: c.valorMensal,
      recorrente: c.recorrente !== false,
      data: c.data?.slice(0, 10) ?? hoje(),
      observacao: c.observacao ?? "",
    });
    setShowForm(true);
  };

  /** Switching tipo must also move the category — the two lists share no members. */
  const trocarTipo = (tipo: TipoOperacional) =>
    setD((p) => ({ ...p, tipo, categoria: CATEGORIAS_POR_TIPO[tipo][0] }));

  const valido = d.nome.trim() !== "" && d.valorMensal > 0;
  const salvar = () => {
    if (!valido) return;
    const limpo: Omit<CustoOperacional, "id"> = {
      nome: d.nome.trim(),
      tipo: d.tipo,
      categoria: d.categoria,
      valorMensal: d.valorMensal,
      recorrente: d.recorrente,
      // a recurring entry has no single month, so the date is only stored for one-offs
      data: d.recorrente ? undefined : d.data,
      observacao: d.observacao.trim() || undefined,
    };
    if (editId) {
      updateCusto(editId, limpo);
      toast.success(d.tipo === "receita" ? "Receita atualizada" : "Custo atualizado");
    } else {
      addCusto({ id: crypto.randomUUID(), ...limpo });
      toast.success(d.tipo === "receita" ? "Receita adicionada" : "Custo adicionado");
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
      subtitle="Despesas e receitas da empresa que não pertencem a nenhum produto — e o lucro líquido depois delas."
      actions={
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Adicionar lançamento
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
            Lucro realizado do mês − despesas operacionais + receitas operacionais. O que sobra no bolso
            (custos de anúncios entram na fase de Ads).
          </p>
        </GlowCard>

        <MetricTile
          label="Despesas operacionais / mês"
          value={resumo.despesas}
          format={money}
          icon={Building2}
          accent="red"
          footnote="Recorrentes + pontuais do mês"
          delay={0.05}
          className="col-span-12 lg:col-span-4"
        />
        <MetricTile
          label="Receitas operacionais / mês"
          value={resumo.receitas}
          format={money}
          icon={TrendingUp}
          accent="green"
          footnote="Entradas que não são venda de produto"
          delay={0.1}
          className="col-span-12 lg:col-span-4"
        />
      </div>

      {/* add / edit form */}
      {showForm && (
        <GlowCard className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
              {editId ? "Editar lançamento" : "Novo lançamento"}
            </span>
            <button onClick={() => setShowForm(false)} className="text-txtFaint hover:text-txt">
              <X size={15} />
            </button>
          </div>
          {/* despesa ⇄ receita — the switch that decides everything else on this form */}
          <div className="mb-4 inline-flex rounded-chip border border-line p-1">
            {(["despesa", "receita"] as TipoOperacional[]).map((t) => (
              <button
                key={t}
                onClick={() => trocarTipo(t)}
                className={`rounded-chip px-4 py-1.5 font-mono text-xs transition-colors ${
                  d.tipo === t
                    ? t === "receita"
                      ? "bg-greenSoft text-green"
                      : "bg-danger/12 text-danger"
                    : "text-txtDim hover:text-txt"
                }`}
              >
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Nome">
                <TextInput
                  value={d.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder={d.tipo === "receita" ? "Rendimento, reembolso…" : "Aluguel, Internet…"}
                />
              </Field>
            </div>
            <Field label="Categoria">
              <select
                value={d.categoria}
                onChange={(e) => set("categoria", e.target.value as CategoriaOperacional)}
                className={inputClass}
              >
                {CATEGORIAS_POR_TIPO[d.tipo].map((c) => (
                  <option key={c} value={c}>
                    {ROTULO[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={d.recorrente ? "Valor mensal" : "Valor"}>
              <NumberInput value={d.valorMensal} onValue={(v) => set("valorMensal", v ?? 0)} unit="R$" />
            </Field>
            <div className="md:col-span-2">
              <Field
                label="Recorrência"
                hint={d.recorrente ? "Conta em todos os meses" : "Conta só no mês escolhido"}
              >
                <label className="flex h-[42px] cursor-pointer items-center gap-2.5 rounded-chip border border-line bg-bgRaise/40 px-3">
                  <input
                    type="checkbox"
                    checked={d.recorrente}
                    onChange={(e) => set("recorrente", e.target.checked)}
                    className="h-4 w-4 accent-green"
                  />
                  <span className="font-mono text-sm text-txt">
                    {d.tipo === "receita" ? "Receita recorrente" : "Despesa recorrente"}
                  </span>
                </label>
              </Field>
            </div>
            {!d.recorrente && (
              <div className="md:col-span-2">
                <Field label="Mês de referência" hint="A entrada conta para o mês inteiro">
                  <input
                    type="date"
                    value={d.data}
                    onChange={(e) => set("data", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
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
        {/* breakdown by category — despesas and receitas kept apart, as in Gestor Seller */}
        <GlowCard className="col-span-12 xl:col-span-5">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Por categoria</span>
          {despesasPorCat.length === 0 && receitasPorCat.length === 0 ? (
            <p className="py-8 text-center text-sm text-txtDim">Nenhum lançamento cadastrado.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-5">
              <Grupo titulo="Despesas operacionais" itens={despesasPorCat} cor="bg-danger" texto="text-danger" />
              {receitasPorCat.length > 0 ? (
                <Grupo titulo="Receitas operacionais" itens={receitasPorCat} cor="bg-green" texto="text-green" />
              ) : (
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
                    Receitas operacionais
                  </span>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-txtFaint">
                    Nenhuma receita cadastrada. Use para entradas que não são venda de produto — juros,
                    reembolso de fornecedor, serviços.
                  </p>
                </div>
              )}
            </div>
          )}
        </GlowCard>

        {/* list */}
        <GlowCard className="col-span-12 overflow-hidden p-0 xl:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Lançamento", "Categoria", "Valor", ""].map((h) => (
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
                      Nenhum lançamento ainda — adicione aluguel, internet, energia… ou uma receita operacional.
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
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtDim">
                            {ROTULO[c.categoria]}
                          </span>
                          {c.recorrente === false ? (
                            <span
                              className="whitespace-nowrap rounded-full border border-lineStrong bg-neutroSoft px-2.5 py-1 font-mono text-[10px] text-txtDim"
                              title="Conta só no mês de referência"
                            >
                              pontual · {mesCurto(c.data)}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtFaint">
                              mensal
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums ${
                          c.tipo === "receita" ? "text-green" : "text-danger"
                        }`}
                      >
                        {c.tipo === "receita" ? "+" : "−"}
                        {money(c.valorMensal)}
                      </td>
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

/** One tipo's category ranking: a labelled row plus a bar scaled against that tipo's largest share. */
function Grupo({
  titulo,
  itens,
  cor,
  texto,
}: {
  titulo: string;
  itens: AggCategoria[];
  cor: string;
  texto: string;
}) {
  const maxShare = Math.max(...itens.map((i) => i.share), 0.0001);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">{titulo}</span>
        <span className={`font-mono text-xs tabular-nums ${texto}`}>{money(total)}</span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {itens.map((b, i) => (
          <li key={b.categoria}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-txt">{ROTULO[b.categoria]}</span>
              <span className="flex items-baseline gap-3">
                <span className={`font-mono text-sm tabular-nums ${texto}`}>{money(b.valor)}</span>
                <span className="w-12 text-right font-mono text-xs tabular-nums text-txtDim">{percent(b.share)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/40">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(b.share / maxShare) * 100}%` }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.05 * i }}
                className={`h-full rounded-full ${cor}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
