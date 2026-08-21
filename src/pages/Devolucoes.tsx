import { ChevronRight, Clock, Coins, PackageCheck, Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { devolucoesPorMotivo, devolucoesPorProduto, resumoDevolucoes, taxaDevolucao } from "../calc/engine";
import type { Devolucao, DevolucaoStatus, MotivoDevolucao } from "../calc/types";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { CampoLoja, useLojaPadrao } from "../components/CampoLoja";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { ExibicaoMenu } from "../components/ExibicaoMenu";
import { Ocultavel, type CardRegistrado } from "../components/Ocultavel";
import { Screen } from "../components/Screen";
import { date as fmtDate, datetime, money, percent } from "../i18n/format";
import { MOTIVO_LABEL, MOTIVOS } from "../i18n/labels";
import { EASE } from "../theme/tokens";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";
import { useEscopo } from "../store/useEscopo";
import { useConfig } from "../store/useConfig";


/** Blocks the user can hide to focus on the ledger alone. */
const CARDS: CardRegistrado[] = [
  { id: "devolucoes.kpis", label: "Indicadores do topo" },
  { id: "devolucoes.resumo", label: "Resumo por motivo" },
  { id: "devolucoes.produtos", label: "Impacto por produto" },
];

const STATUS: Record<DevolucaoStatus, { label: string; cls: string }> = {
  solicitada: { label: "Solicitada", cls: "text-amber border-amber/40 bg-amberSoft" },
  em_analise: { label: "Em análise", cls: "text-sky border-sky/40 bg-skySoft" },
  aprovada: { label: "Aprovada", cls: "text-green border-green/40 bg-greenSoft" },
  concluida: { label: "Concluída", cls: "text-green border-green/40 bg-greenSoft" },
  recusada: { label: "Recusada", cls: "text-txtDim border-lineStrong bg-neutroSoft" },
};
const STATUS_KEYS = Object.keys(STATUS) as DevolucaoStatus[];
/** A return counts as "open" until it is concluded or rejected. */
const emAberto = (s: DevolucaoStatus) => s !== "concluida" && s !== "recusada";

/**
 * The next stage in the normal lifecycle, for the one-click advance in the table.
 *
 * Only the happy path: `concluida` is the end, and `recusada` is a decision rather than a step,
 * so neither offers a next stage and both are reached through the form. The button exists to
 * catch the app up on a return already processed elsewhere, not to replace editing.
 */
const PROXIMO: Partial<Record<DevolucaoStatus, DevolucaoStatus>> = {
  solicitada: "em_analise",
  em_analise: "aprovada",
  aprovada: "concluida",
};

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Draft = {
  lojaId: string;
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

const emptyDraft = (lojaId = ""): Draft => ({
  lojaId,
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
  const cfg = useConfig();
  // scoped to the selected storefront — see useEscopo
  const escopo = useEscopo();
  const devolucoes = escopo.devolucoes;
  const vendas = escopo.vendas;
  const produtos = useStore((s) => s.produtos);
  const addDevolucao = useStore((s) => s.addDevolucao);
  const updateDevolucao = useStore((s) => s.updateDevolucao);
  const removeDevolucao = useStore((s) => s.removeDevolucao);

  // stacked by default; "dividido" restores the old summary-on-the-left arrangement
  const dividido = useStore((s) => s.layouts["devolucoes"]) === "dividido";
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const lojaPadrao = useLojaPadrao();
  const [d, setD] = useState<Draft>(() => emptyDraft(lojaPadrao));
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
  const porProduto = useMemo(
    () => devolucoesPorProduto(linhas, vendas, produtos, cfg),
    [linhas, vendas, produtos, cfg],
  );
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

  /** Move a return one stage on, straight from the table. */
  const avancarStatus = (r: Devolucao) => {
    const proximo = PROXIMO[r.status];
    if (!proximo) return;
    updateDevolucao(r.id, { status: proximo });
    toast.success(`"${r.produtoNome}" → ${STATUS[proximo].label}`);
  };

  const abrirNovo = () => {
    setEditId(null);
    setD(emptyDraft(lojaPadrao));
    setShowForm(true);
  };
  const editar = (r: Devolucao) => {
    setEditId(r.id);
    setD({
      lojaId: r.lojaId ?? "",
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
      lojaId: d.lojaId || undefined,
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
    setD(emptyDraft(lojaPadrao));
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
      actions={
        <div className="flex items-center gap-2">
          <ExibicaoMenu cards={CARDS} paginaLayout="devolucoes" />
          <button
            onClick={() => (showForm ? setShowForm(false) : abrirNovo())}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fechar" : "Registrar devolução"}
          </button>
        </div>
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
            <CampoLoja valor={d.lojaId} onChange={(v) => set("lojaId", v)} />
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
      <Ocultavel id="devolucoes.kpis" label="Indicadores do topo" className="mb-4 block">
        <div className="grid grid-cols-12 gap-4">
        <MetricTile label="Reembolso total" value={resumo.reembolso} format={money} icon={Coins} accent="gold" className="col-span-6 lg:col-span-3" />
        <MetricTile label="Taxa de devolução" value={taxa} format={percent} icon={RotateCcw} footnote="Unidades devolvidas ÷ unidades vendidas" className="col-span-6 lg:col-span-3" delay={0.05} />
        <MetricTile label="Unidades devolvidas" value={resumo.unidades} format={(v) => String(Math.round(v))} icon={Undo2} footnote={`${resumo.registros} devolução(ões)`} className="col-span-6 lg:col-span-3" delay={0.1} />
        <MetricTile label="Reestocadas" value={resumo.reestocadas} format={(v) => String(Math.round(v))} icon={PackageCheck} accent="green" className="col-span-6 lg:col-span-3" delay={0.15} />
        </div>
      </Ocultavel>

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
        {/* the ledger owns the full width — it's what this page is for */}
        <GlowCard className={`col-span-12 overflow-hidden p-0 ${dividido ? "lg:col-span-8" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {/* secondary columns drop out when the window is narrow, so the ledger never
                      needs a horizontal scroll — the data is still searchable and in the form.
                      They return in STAGES: bringing both back at `xl` needed 1008px in a 934px
                      box, so Motivo waits for `2xl`. It is the one already reachable another way
                      — there is a Motivo filter and a whole "Por motivo" card on this page —
                      while Pedido is how you find a specific return. */}
                  {[
                    { h: "Data", cls: "" },
                    { h: "Produto", cls: "" },
                    { h: "Pedido", cls: "hidden xl:table-cell" },
                    { h: "Qtd", cls: "" },
                    { h: "Motivo", cls: "hidden 2xl:table-cell" },
                    { h: "Status", cls: "" },
                    { h: "Reembolso", cls: "" },
                    { h: "Estoque", cls: "" },
                    { h: "", cls: "" },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`whitespace-nowrap px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-12 text-center text-sm text-txtDim">
                      Nenhuma devolução encontrada.
                    </td>
                  </tr>
                ) : (
                  linhas.map((r) => (
                    <tr key={r.id} className="border-b border-line/60 transition-colors hover:bg-greenSoft/20">
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-txtDim">
                        {/* just the date when space is tight; full timestamp on wide screens */}
                        <span className="xl:hidden">{fmtDate(r.data)}</span>
                        <span className="hidden xl:inline">{datetime(r.data)}</span>
                      </td>
                      <td className="max-w-[140px] px-3 py-3 text-sm text-txt xl:max-w-[200px]">
                        <span className="block truncate">{r.produtoNome}</span>
                        {!r.produtoId && <span className="ml-2 font-mono text-[10px] text-gold">avulsa</span>}
                        {r.cliente && <span className="block font-mono text-[11px] text-txtFaint">{r.cliente}</span>}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-xs text-txtDim xl:table-cell">{r.numeroPedido ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-sm tabular-nums text-txtDim">{r.quantidade}</td>
                      <td className="hidden px-3 py-3 2xl:table-cell">
                        <span className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtDim">
                          {MOTIVO_LABEL[r.motivo]}
                        </span>
                      </td>
                      {/* px-3 like every other cell: the advance button widened this column
                          enough to push the ledger past its box at 1024 */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] ${STATUS[r.status].cls}`}>
                            {STATUS[r.status].label}
                          </span>
                          {/* one click moves the return one stage on, for when it was already
                              handled on the marketplace and the app just has to catch up */}
                          {PROXIMO[r.status] && (
                            <button
                              onClick={() => avancarStatus(r)}
                              title={`Avançar para "${STATUS[PROXIMO[r.status]!].label}"`}
                              className="shrink-0 rounded-full border border-line p-1 text-txtDim transition-colors hover:border-green/50 hover:text-green"
                            >
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums text-gold">{money(r.valorReembolsado)}</td>
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3">
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

        {/* breakdown sits UNDER the table so the ledger is never squeezed; hide it for table-only */}
        <Ocultavel id="devolucoes.resumo" label="Resumo por motivo" className={`col-span-12 ${dividido ? "lg:col-span-4 lg:order-first" : ""}`}>
          <GlowCard className="h-full">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Por motivo</span>
            {porMotivo.length === 0 ? (
              <p className="py-8 text-center text-sm text-txtDim">Nenhuma devolução no filtro atual.</p>
            ) : (
              <ul className={`mt-3 ${dividido ? "flex flex-col gap-2.5" : "grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3"}`}>
                {porMotivo.map((m, i) => (
                  <li key={m.motivo}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-txt">{MOTIVO_LABEL[m.motivo]}</span>
                      <span className="flex shrink-0 items-baseline gap-3">
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
        </Ocultavel>

        {/*
          The block that changes decisions: a product can carry a healthy margin on every sale and
          still lose money once enough of them come back. "Por motivo" above says WHY things are
          returned; this says WHICH products it is actually costing.
        */}
        <Ocultavel id="devolucoes.produtos" label="Impacto por produto" className="col-span-12">
          <GlowCard className="h-full">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
                Impacto por produto
              </span>
              <span className="font-mono text-[11px] text-txtFaint">
                margem antes → depois dos reembolsos
              </span>
            </div>
            {porProduto.length === 0 ? (
              <p className="py-8 text-center text-sm text-txtDim">Nenhuma devolução no filtro atual.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      {[
                        { k: "produto", l: "Produto" },
                        { k: "reg", l: "Devol.", cls: "hidden xl:table-cell" },
                        { k: "un", l: "Un." },
                        { k: "taxa", l: "Taxa" },
                        { k: "reemb", l: "Reembolso" },
                        { k: "lucro", l: "Lucro", cls: "hidden xl:table-cell" },
                        { k: "depois", l: "Lucro após" },
                        { k: "margens", l: "Margem" },
                      ].map((c) => (
                        <th
                          key={c.k}
                          className={`whitespace-nowrap px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint xl:px-3 ${c.cls ?? ""}`}
                        >
                          {c.l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porProduto.map((p) => {
                      const semVendas = p.lucro === 0 && p.margem === 0;
                      return (
                        <tr key={p.produtoId ?? p.nome} className="border-b border-line/60">
                          <td className="max-w-[150px] truncate px-2 py-2.5 text-sm text-txt xl:px-3" title={p.nome}>
                            {p.nome}
                            {!p.produtoId && (
                              <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 font-mono text-[9px] text-txtFaint">
                                sem cadastro
                              </span>
                            )}
                          </td>
                          <td className="hidden px-2 py-2.5 font-mono text-xs text-txtDim xl:table-cell xl:px-3">{p.registros}</td>
                          <td className="px-2 py-2.5 font-mono text-xs text-txtDim xl:px-3">{p.unidades}</td>
                          <td className={`px-2 py-2.5 font-mono text-xs tabular-nums xl:px-3 ${p.taxa > 0.1 ? "text-danger" : "text-txtDim"}`}>
                            {p.taxa > 0 ? percent(p.taxa) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 font-mono text-sm tabular-nums text-gold xl:px-3">
                            {money(p.reembolso)}
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2.5 font-mono text-xs tabular-nums text-txtDim xl:table-cell xl:px-3">
                            {semVendas ? "—" : money(p.lucro)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-2 py-2.5 font-mono text-sm tabular-nums xl:px-3 ${
                              semVendas ? "text-txtFaint" : p.lucroLiquido < 0 ? "text-danger" : "text-txt"
                            }`}
                          >
                            {semVendas ? "—" : money(p.lucroLiquido)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs tabular-nums xl:px-3">
                            {semVendas ? (
                              <span className="text-txtFaint">—</span>
                            ) : (
                              <>
                                <span className="text-txtDim">{percent(p.margem)}</span>
                                <span className="mx-1 text-txtFaint">→</span>
                                <span className={p.margemLiquida < 0 ? "text-danger" : p.margemLiquida < p.margem ? "text-amber" : "text-green"}>
                                  {percent(p.margemLiquida)}
                                </span>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-txtFaint">
              O lucro é o realizado do produto em todo o período (não só no filtro), e o reembolso é
              o das devoluções filtradas. Produtos sem venda atribuída aparecem com “—”: houve
              reembolso, mas não há lucro registrado para descontar.
            </p>
          </GlowCard>
        </Ocultavel>
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
