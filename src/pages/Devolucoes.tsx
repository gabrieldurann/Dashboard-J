import { Clock, Coins, PackageCheck, Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { devolucoesPorMotivo, resumoDevolucoes, taxaDevolucao } from "../calc/engine";
import type { Devolucao, DevolucaoStatus, MotivoDevolucao } from "../calc/types";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { date as fmtDate, datetime, money, percent } from "../i18n/format";
import { MOTIVO_LABEL, MOTIVOS } from "../i18n/labels";
import { EASE } from "../theme/tokens";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";


const STATUS: Record<DevolucaoStatus, { label: string; cls: string }> = {
  solicitada: { label: "Solicitada", cls: "text-amber border-amber/40 bg-amber/10" },
  em_analise: { label: "Em análise", cls: "text-sky border-sky/40 bg-skySoft" },
  aprovada: { label: "Aprovada", cls: "text-green border-green/40 bg-greenSoft" },
  concluida: { label: "Concluída", cls: "text-green border-green/40 bg-greenSoft" },
  recusada: { label: "Recusada", cls: "text-txtFaint border-line" },
};
const STATUS_KEYS = Object.keys(STATUS) as DevolucaoStatus[];
/** A return counts as "open" until it is concluded or rejected. */
const emAberto = (s: DevolucaoStatus) => s !== "concluida" && s !== "recusada";

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Draft = {
  vendaId: string; // "" = sem venda vinculada
  produtoId: string;
  produtoNome: string;
  codigoProduto: string;
  data: string;
  quantidade: number;
  motivo: MotivoDevolucao;
  status: DevolucaoStatus;
  valorReembolsado: number;
  reestocado: boolean;
  dataReestoque: string; // "" quando não reestocado / sem data
  canal: string;
  cliente: string;
  numeroPedido: string;
  observacao: string;
};

const emptyDraft = (): Draft => ({
  vendaId: "",
  produtoId: "",
  produtoNome: "",
  codigoProduto: "",
  data: nowLocal(),
  quantidade: 1,
  motivo: "defeito",
  status: "solicitada",
  valorReembolsado: 0,
  reestocado: false,
  dataReestoque: "",
  canal: "",
  cliente: "",
  numeroPedido: "",
  observacao: "",
});

export function Devolucoes() {
  const devolucoes = useStore((s) => s.devolucoes);
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);
  const addDevolucao = useStore((s) => s.addDevolucao);
  const updateDevolucao = useStore((s) => s.updateDevolucao);
  const removeDevolucao = useStore((s) => s.removeDevolucao);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(emptyDraft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const [busca, setBusca] = useState("");
  const [fProduto, setFProduto] = useState("todos"); // todos | <produtoId>
  const [fMotivo, setFMotivo] = useState<"todos" | MotivoDevolucao>("todos");
  const [fStatus, setFStatus] = useState<"todos" | DevolucaoStatus>("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  // most recent sales first, for the "venda de origem" picker
  const vendasOrdenadas = useMemo(() => [...vendas].sort((a, b) => (a.data < b.data ? 1 : -1)), [vendas]);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return devolucoes
      .filter((r) => {
        if (fProduto !== "todos" && r.produtoId !== fProduto) return false;
        if (fMotivo !== "todos" && r.motivo !== fMotivo) return false;
        if (fStatus !== "todos" && r.status !== fStatus) return false;
        const dia = r.data.slice(0, 10);
        if (dataDe && dia < dataDe) return false;
        if (dataAte && dia > dataAte) return false;
        if (!q) return true;
        return [r.produtoNome, r.codigoProduto, r.cliente, r.numeroPedido, r.canal]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [devolucoes, busca, fProduto, fMotivo, fStatus, dataDe, dataAte]);

  // headline reflects the current filter; taxa uses all sales as the denominator
  const resumo = useMemo(() => resumoDevolucoes(linhas), [linhas]);
  const taxa = useMemo(() => taxaDevolucao(linhas, vendas), [linhas, vendas]);
  const porMotivo = useMemo(() => devolucoesPorMotivo(linhas), [linhas]);
  const maxShare = Math.max(...porMotivo.map((m) => m.share), 0.0001);
  const abertas = useMemo(() => linhas.filter((r) => emAberto(r.status)).length, [linhas]);

  const temFiltro = busca || fProduto !== "todos" || fMotivo !== "todos" || fStatus !== "todos" || dataDe || dataAte;
  const limpar = () => {
    setBusca("");
    setFProduto("todos");
    setFMotivo("todos");
    setFStatus("todos");
    setDataDe("");
    setDataAte("");
  };

  // pick an originating sale → snapshot its product/order/channel/customer and suggest the refund
  const escolherVenda = (id: string) => {
    const v = vendas.find((x) => x.id === id);
    if (!v) {
      setD((prev) => ({ ...prev, vendaId: "" }));
      return;
    }
    setD((prev) => {
      const qtd = Math.min(prev.quantidade || 1, v.quantidade);
      return {
        ...prev,
        vendaId: v.id,
        produtoId: v.produtoId ?? "",
        produtoNome: v.produtoNome,
        codigoProduto: v.codigoProduto ?? "",
        quantidade: qtd,
        valorReembolsado: +(v.valorUnitario * qtd).toFixed(2),
        canal: v.canal ?? "",
        cliente: v.cliente ?? "",
        numeroPedido: v.numeroPedido ?? "",
      };
    });
  };

  const escolherProduto = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) {
      setD((prev) => ({ ...prev, produtoId: "", produtoNome: "", codigoProduto: "" }));
      return;
    }
    setD((prev) => ({
      ...prev,
      produtoId: p.id,
      produtoNome: p.nome,
      codigoProduto: p.codigoProduto ?? "",
      valorReembolsado: prev.valorReembolsado || +(p.precoVenda * (prev.quantidade || 1)).toFixed(2),
    }));
  };

  const abrirNovo = () => {
    setEditId(null);
    setD(emptyDraft());
    setShowForm(true);
  };
  const editar = (r: Devolucao) => {
    setEditId(r.id);
    setD({
      vendaId: r.vendaId ?? "",
      produtoId: r.produtoId ?? "",
      produtoNome: r.produtoNome,
      codigoProduto: r.codigoProduto ?? "",
      data: r.data,
      quantidade: r.quantidade,
      motivo: r.motivo,
      status: r.status,
      valorReembolsado: r.valorReembolsado,
      reestocado: r.reestocado,
      dataReestoque: r.dataReestoque ?? "",
      canal: r.canal ?? "",
      cliente: r.cliente ?? "",
      numeroPedido: r.numeroPedido ?? "",
      observacao: r.observacao ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const valido = d.produtoNome.trim() !== "" && d.quantidade > 0 && d.valorReembolsado >= 0;
  const salvar = () => {
    if (!valido) return;
    const payload: Omit<Devolucao, "id"> = {
      vendaId: d.vendaId || undefined,
      produtoId: d.produtoId || undefined,
      produtoNome: d.produtoNome.trim(),
      codigoProduto: d.codigoProduto || undefined,
      data: d.data || nowLocal(),
      quantidade: d.quantidade,
      motivo: d.motivo,
      status: d.status,
      valorReembolsado: d.valorReembolsado,
      reestocado: d.reestocado,
      dataReestoque: d.reestocado ? d.dataReestoque || undefined : undefined,
      canal: d.canal || undefined,
      cliente: d.cliente || undefined,
      numeroPedido: d.numeroPedido || undefined,
      observacao: d.observacao || undefined,
    };
    if (editId) {
      updateDevolucao(editId, payload);
      toast.success("Devolução atualizada");
    } else {
      addDevolucao({ id: crypto.randomUUID(), ...payload });
      toast.success("Devolução registrada");
    }
    setD(emptyDraft());
    setEditId(null);
    setShowForm(false);
  };

  const excluir = async (r: Devolucao) => {
    const ok = await confirmAction({
      title: "Excluir devolução?",
      message: `A devolução de "${r.produtoNome}"${r.numeroPedido ? ` (pedido ${r.numeroPedido})` : ""} será removida.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeDevolucao(r.id);
    toast.success("Devolução excluída");
  };

  return (
    <Screen
      eyebrow="Registros"
      title="Devoluções"
      subtitle="Devoluções e reembolsos — motivo, valor devolvido e reposição ao estoque. Os reembolsos reduzem o lucro líquido do Painel."
      actions={
        <button
          onClick={() => (showForm ? setShowForm(false) : abrirNovo())}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fechar" : "Registrar devolução"}
        </button>
      }
    >
      {showForm && (
        <GlowCard accent="green" className="mb-4">
          <span className="mb-4 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            {editId ? "Editar devolução" : "Nova devolução"}
          </span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2">
              <Field label="Venda de origem" hint="Preenche produto, pedido e sugere o reembolso">
                <select value={d.vendaId} onChange={(e) => escolherVenda(e.target.value)} className={inputClass}>
                  <option value="">— Sem venda vinculada —</option>
                  {vendasOrdenadas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {datetime(v.data)} · {v.produtoNome}
                      {v.numeroPedido ? ` · ${v.numeroPedido}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {!d.vendaId && (
              <div className="col-span-2">
                <Field label="Produto" hint="Do catálogo, ou digite um nome avulso abaixo">
                  <select value={d.produtoId} onChange={(e) => escolherProduto(e.target.value)} className={inputClass}>
                    <option value="">— Avulsa (fora do catálogo) —</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {!d.vendaId && !d.produtoId && (
              <>
                <Field label="Nome (avulsa)">
                  <TextInput value={d.produtoNome} onChange={(e) => set("produtoNome", e.target.value)} />
                </Field>
                <Field label="Código">
                  <TextInput value={d.codigoProduto} onChange={(e) => set("codigoProduto", e.target.value)} />
                </Field>
              </>
            )}
            <Field label="Quantidade devolvida">
              <NumberInput value={d.quantidade} onValue={(v) => set("quantidade", v ?? 0)} />
            </Field>
            <Field label="Valor reembolsado">
              <NumberInput value={d.valorReembolsado} onValue={(v) => set("valorReembolsado", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Motivo">
              <select value={d.motivo} onChange={(e) => set("motivo", e.target.value as MotivoDevolucao)} className={inputClass}>
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {MOTIVO_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" hint="Situação da devolução">
              <select value={d.status} onChange={(e) => set("status", e.target.value as DevolucaoStatus)} className={inputClass}>
                {STATUS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {STATUS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data / hora da devolução">
              <input type="datetime-local" value={d.data} onChange={(e) => set("data", e.target.value)} className={inputClass} />
            </Field>
            <div className="col-span-2 lg:col-span-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-chip border border-line bg-bgRaise/40 px-4 py-3">
                <input
                  type="checkbox"
                  checked={d.reestocado}
                  onChange={(e) =>
                    setD((p) => ({
                      ...p,
                      reestocado: e.target.checked,
                      // auto-suggest today's date on first check; clear when unchecked
                      dataReestoque: e.target.checked ? p.dataReestoque || nowLocal().slice(0, 10) : "",
                    }))
                  }
                  className="h-4 w-4 accent-green"
                />
                <span className="font-mono text-sm text-txt">Reestocado</span>
                <span className="font-mono text-xs text-txtFaint">
                  — voltou ao estoque vendável (senão, foi perda total).
                </span>
              </label>
              {d.reestocado && (
                <Field label="Data de reestoque" hint="Quando o(s) item(ns) voltaram ao estoque">
                  <input type="date" value={d.dataReestoque} onChange={(e) => set("dataReestoque", e.target.value)} className={inputClass} />
                </Field>
              )}
            </div>
            {d.vendaId && (
              <>
                <Field label="Canal">
                  <TextInput value={d.canal} onChange={(e) => set("canal", e.target.value)} />
                </Field>
                <Field label="Cliente">
                  <TextInput value={d.cliente} onChange={(e) => set("cliente", e.target.value)} />
                </Field>
                <Field label="Nº do pedido">
                  <TextInput value={d.numeroPedido} onChange={(e) => set("numeroPedido", e.target.value)} />
                </Field>
              </>
            )}
            <div className="col-span-2 lg:col-span-4">
              <Field label="Observação">
                <TextInput value={d.observacao} onChange={(e) => set("observacao", e.target.value)} />
              </Field>
            </div>
          </div>
          <button
            onClick={salvar}
            disabled={!valido}
            className="mt-5 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editId ? <Save size={15} /> : <Plus size={15} />} {editId ? "Salvar alterações" : "Registrar devolução"}
          </button>
        </GlowCard>
      )}

      {/* summary (reflects current filters) */}
      <div className="mb-4 grid grid-cols-12 gap-4">
        <MetricTile label="Reembolso total" value={resumo.reembolso} format={money} icon={Coins} accent="gold" footnote="Valor devolvido aos clientes (nas devoluções filtradas)" className="col-span-6 lg:col-span-3" />
        <MetricTile label="Taxa de devolução" value={taxa} format={percent} icon={RotateCcw} footnote="Unidades devolvidas ÷ unidades vendidas" className="col-span-6 lg:col-span-3" delay={0.05} />
        <MetricTile label="Unidades devolvidas" value={resumo.unidades} format={(v) => String(Math.round(v))} icon={Undo2} footnote={`${resumo.registros} devolução(ões)`} className="col-span-6 lg:col-span-3" delay={0.1} />
        <MetricTile label="Reestocadas" value={resumo.reestocadas} format={(v) => String(Math.round(v))} icon={PackageCheck} accent="green" footnote="Unidades que voltaram ao estoque" className="col-span-6 lg:col-span-3" delay={0.15} />
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
          <Search size={15} className="text-txtFaint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, código, cliente, pedido, canal…"
            className="w-72 bg-transparent font-mono text-sm text-txt outline-none placeholder:text-txtFaint"
          />
        </div>
        <FilterSelect label="Produto" value={fProduto} onChange={setFProduto}>
          <option value="todos">Todos os produtos</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Motivo" value={fMotivo} onChange={(v) => setFMotivo(v as "todos" | MotivoDevolucao)}>
          <option value="todos">Todos</option>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_LABEL[m]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" value={fStatus} onChange={(v) => setFStatus(v as "todos" | DevolucaoStatus)}>
          <option value="todos">Todos</option>
          {STATUS_KEYS.map((k) => (
            <option key={k} value={k}>
              {STATUS[k].label}
            </option>
          ))}
        </FilterSelect>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Período</span>
          <div className="flex items-center gap-2 rounded-chip border border-line bg-bgRaise/40 px-2 py-1">
            <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} title="De" className="bg-transparent px-1 py-1 font-mono text-sm text-txt outline-none" />
            <span className="font-mono text-xs text-txtFaint">→</span>
            <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} title="Até" className="bg-transparent px-1 py-1 font-mono text-sm text-txt outline-none" />
          </div>
        </div>
        {temFiltro && (
          <button onClick={limpar} className="rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt">
            Limpar filtros
          </button>
        )}
        {abertas > 0 && (
          <button
            onClick={() => setFStatus("solicitada")}
            title="Devoluções ainda não concluídas nem recusadas"
            className="ml-auto flex items-center gap-2 rounded-chip border border-amber/40 bg-amber/10 px-3 py-2 font-mono text-xs text-amber transition-opacity hover:opacity-90"
          >
            <Clock size={13} /> {abertas} em aberto
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* breakdown by reason */}
        <GlowCard className="col-span-12 lg:col-span-5">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Por motivo</span>
          {porMotivo.length === 0 ? (
            <p className="py-8 text-center text-sm text-txtDim">Nenhuma devolução no filtro atual.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {porMotivo.map((m, i) => (
                <li key={m.motivo}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-txt">{MOTIVO_LABEL[m.motivo]}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-xs tabular-nums text-txtDim">{m.unidades} un</span>
                      <span className="font-mono text-sm tabular-nums text-gold">{money(m.reembolso)}</span>
                      <span className="w-12 text-right font-mono text-xs tabular-nums text-txtDim">{percent(m.share)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.share / maxShare) * 100}%` }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.05 * i }}
                      className="h-full rounded-full bg-gold"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>

        {/* table */}
        <GlowCard className="col-span-12 overflow-hidden p-0 lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Data", "Produto", "Pedido", "Qtd", "Motivo", "Status", "Reembolso", "Estoque", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-txtDim">
                      Nenhuma devolução encontrada.
                    </td>
                  </tr>
                ) : (
                  linhas.map((r) => (
                    <tr key={r.id} className="border-b border-line/60 transition-colors hover:bg-greenSoft/20">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-txtDim">{datetime(r.data)}</td>
                      <td className="px-4 py-3 text-sm text-txt">
                        {r.produtoNome}
                        {!r.produtoId && <span className="ml-2 font-mono text-[10px] text-gold">avulsa</span>}
                        {r.cliente && <span className="block font-mono text-[11px] text-txtFaint">{r.cliente}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-txtDim">{r.numeroPedido ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{r.quantidade}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtDim">
                          {MOTIVO_LABEL[r.motivo]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] ${STATUS[r.status].cls}`}>
                          {STATUS[r.status].label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-gold">{money(r.valorReembolsado)}</td>
                      <td className="px-4 py-3">
                        {r.reestocado ? (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-green">
                              <PackageCheck size={13} /> reestocado
                            </span>
                            {r.dataReestoque && (
                              <span className="whitespace-nowrap font-mono text-[10px] text-txtFaint">em {fmtDate(r.dataReestoque)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-danger">perda</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => editar(r)} className="text-txtDim transition-colors hover:text-green" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => excluir(r)} className="text-txtDim transition-colors hover:text-danger" title="Excluir">
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

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} py-2`}>
        {children}
      </select>
    </label>
  );
}
