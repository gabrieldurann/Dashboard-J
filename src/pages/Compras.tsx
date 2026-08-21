import { Coins, PackageCheck, Pencil, Plus, Save, Search, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { comprasPorFornecedor, custoTotalCompra, resumoCompras } from "../calc/engine";
import type { Compra, CompraStatus } from "../calc/types";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { CampoLoja, useLojaPadrao } from "../components/CampoLoja";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { ExibicaoMenu } from "../components/ExibicaoMenu";
import { Ocultavel, type CardRegistrado } from "../components/Ocultavel";
import { Screen } from "../components/Screen";
import { Tooltip } from "../components/Tooltip";
import { date as fmtDate, datetime, money, number, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";
import { useEscopo } from "../store/useEscopo";

// Compras = the stock purchase ledger (idea #3). Received purchases feed the derived stock
// (see `estoqueProdutos`); the unit cost paid is kept per purchase and only copied onto the
// product when the user asks — never silently, since custoUnit drives every margin.

/** Blocks the user can hide to focus on the ledger alone. */
const CARDS: CardRegistrado[] = [
  { id: "compras.kpis", label: "Indicadores do topo" },
  { id: "compras.resumo", label: "Resumo por fornecedor" },
];

const STATUS: Record<CompraStatus, { label: string; cls: string }> = {
  pedida: { label: "Pedida", cls: "text-amber border-amber/40 bg-amberSoft" },
  em_transito: { label: "Em trânsito", cls: "text-sky border-sky/40 bg-skySoft" },
  recebida: { label: "Recebida", cls: "text-green border-green/40 bg-greenSoft" },
  cancelada: { label: "Cancelada", cls: "text-txtDim border-lineStrong bg-neutroSoft" },
};
const STATUS_KEYS = Object.keys(STATUS) as CompraStatus[];

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const hoje = () => new Date().toISOString().slice(0, 10);

type Draft = {
  lojaId: string;
  produtoId: string;
  produtoNome: string;
  codigoProduto: string;
  data: string;
  dataRecebimento: string;
  quantidade: number;
  custoUnit: number;
  frete: number;
  outrosCustos: number;
  status: CompraStatus;
  fornecedor: string;
  numeroNota: string;
  observacao: string;
};

const emptyDraft = (lojaId = ""): Draft => ({
  lojaId,
  produtoId: "",
  produtoNome: "",
  codigoProduto: "",
  data: nowLocal(),
  dataRecebimento: "",
  quantidade: 0,
  custoUnit: 0,
  frete: 0,
  outrosCustos: 0,
  status: "pedida",
  fornecedor: "",
  numeroNota: "",
  observacao: "",
});

export function Compras() {
  // scoped to the selected storefront — see useEscopo
  const escopo = useEscopo();
  const compras = escopo.compras;
  const produtos = useStore((s) => s.produtos);
  const addCompra = useStore((s) => s.addCompra);
  const updateCompra = useStore((s) => s.updateCompra);
  const removeCompra = useStore((s) => s.removeCompra);
  const updateProduto = useStore((s) => s.updateProduto);

  // stacked by default; "dividido" restores the old summary-on-the-left arrangement
  const dividido = useStore((s) => s.layouts["compras"]) === "dividido";
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const lojaPadrao = useLojaPadrao();
  const [d, setD] = useState<Draft>(() => emptyDraft(lojaPadrao));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const [busca, setBusca] = useState("");
  const [fProduto, setFProduto] = useState("todos");
  const [fStatus, setFStatus] = useState<"todos" | CompraStatus>("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return compras
      .filter((c) => {
        if (fProduto !== "todos" && c.produtoId !== fProduto) return false;
        if (fStatus !== "todos" && c.status !== fStatus) return false;
        const dia = c.data.slice(0, 10);
        if (dataDe && dia < dataDe) return false;
        if (dataAte && dia > dataAte) return false;
        if (!q) return true;
        return [c.produtoNome, c.codigoProduto, c.fornecedor, c.numeroNota]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [compras, busca, fProduto, fStatus, dataDe, dataAte]);

  const resumo = useMemo(() => resumoCompras(linhas), [linhas]);
  const porFornecedor = useMemo(() => comprasPorFornecedor(linhas), [linhas]);
  const maxShare = Math.max(...porFornecedor.map((f) => f.share), 0.0001);

  const temFiltro = busca || fProduto !== "todos" || fStatus !== "todos" || dataDe || dataAte;
  const limpar = () => {
    setBusca("");
    setFProduto("todos");
    setFStatus("todos");
    setDataDe("");
    setDataAte("");
  };

  // picking a catalog product seeds the name/code and its current cost as the starting price
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
      custoUnit: prev.custoUnit || p.custoUnit,
      fornecedor: prev.fornecedor || p.fornecedor || "",
    }));
  };

  const produtoDoDraft = produtos.find((p) => p.id === d.produtoId);
  const totalDraft = d.quantidade * d.custoUnit + d.frete + d.outrosCustos;

  const abrirNovo = () => {
    setEditId(null);
    setD(emptyDraft(lojaPadrao));
    setShowForm(true);
  };
  const editar = (c: Compra) => {
    setEditId(c.id);
    setD({
      lojaId: c.lojaId ?? "",
      produtoId: c.produtoId ?? "",
      produtoNome: c.produtoNome,
      codigoProduto: c.codigoProduto ?? "",
      data: c.data,
      dataRecebimento: c.dataRecebimento ?? "",
      quantidade: c.quantidade,
      custoUnit: c.custoUnit,
      frete: c.frete ?? 0,
      outrosCustos: c.outrosCustos ?? 0,
      status: c.status,
      fornecedor: c.fornecedor ?? "",
      numeroNota: c.numeroNota ?? "",
      observacao: c.observacao ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const valido = d.produtoNome.trim() !== "" && d.quantidade > 0 && d.custoUnit >= 0;
  const salvar = () => {
    if (!valido) return;
    const payload: Omit<Compra, "id"> = {
      lojaId: d.lojaId || undefined,
      produtoId: d.produtoId || undefined,
      produtoNome: d.produtoNome.trim(),
      codigoProduto: d.codigoProduto || undefined,
      data: d.data || nowLocal(),
      // a received purchase always carries an arrival date, defaulting to today
      dataRecebimento: d.status === "recebida" ? d.dataRecebimento || hoje() : undefined,
      quantidade: d.quantidade,
      custoUnit: d.custoUnit,
      frete: d.frete || undefined,
      outrosCustos: d.outrosCustos || undefined,
      status: d.status,
      fornecedor: d.fornecedor || undefined,
      numeroNota: d.numeroNota || undefined,
      observacao: d.observacao || undefined,
    };
    if (editId) {
      updateCompra(editId, payload);
      toast.success("Compra atualizada");
    } else {
      addCompra({ id: crypto.randomUUID(), ...payload });
      toast.success("Compra registrada");
    }
    setD(emptyDraft(lojaPadrao));
    setEditId(null);
    setShowForm(false);
  };

  const excluir = async (c: Compra) => {
    const ok = await confirmAction({
      title: "Excluir compra?",
      message: `A compra de "${c.produtoNome}"${c.numeroNota ? ` (${c.numeroNota})` : ""} será removida — o estoque é recalculado.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeCompra(c.id);
    toast.success("Compra excluída");
  };

  /** Copy this purchase's unit cost onto the product (never automatic — it moves every margin). */
  const aplicarCusto = async (c: Compra) => {
    const p = produtos.find((x) => x.id === c.produtoId);
    if (!p) return;
    const ok = await confirmAction({
      title: "Usar este custo no produto?",
      message: `"${p.nome}" passa de ${money(p.custoUnit)} para ${money(c.custoUnit)} por unidade. Isso altera a margem em todo o app.`,
      confirmLabel: "Atualizar custo",
    });
    if (!ok) return;
    updateProduto(p.id, { custoUnit: c.custoUnit });
    toast.success("Custo do produto atualizado");
  };

  return (
    <Screen
      eyebrow="Registros"
      title="Compras"
      actions={
        <div className="flex items-center gap-2">
          <ExibicaoMenu cards={CARDS} paginaLayout="compras" />
          <button
            onClick={() => (showForm ? setShowForm(false) : abrirNovo())}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fechar" : "Registrar compra"}
          </button>
        </div>
      }
    >
      {showForm && (
        <GlowCard accent="green" className="mb-4">
          <span className="mb-4 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            {editId ? "Editar compra" : "Nova compra"}
          </span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2">
              <Field label="Produto" hint="Do catálogo, ou deixe avulso e digite o nome">
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
            {!d.produtoId && (
              <>
                <Field label="Nome (avulsa)">
                  <TextInput value={d.produtoNome} onChange={(e) => set("produtoNome", e.target.value)} />
                </Field>
                <Field label="Código">
                  <TextInput value={d.codigoProduto} onChange={(e) => set("codigoProduto", e.target.value)} />
                </Field>
              </>
            )}

            <Field
              label="Quantidade (un)"
              hint={
                produtoDoDraft && produtoDoDraft.qtdCaixa > 0 && d.quantidade > 0
                  ? `${number(d.quantidade / produtoDoDraft.qtdCaixa)} cx de ${produtoDoDraft.qtdCaixa}`
                  : "em unidades"
              }
            >
              <NumberInput value={d.quantidade} onValue={(v) => set("quantidade", v ?? 0)} />
            </Field>
            <Field
              label="Custo por unidade"
              hint={
                produtoDoDraft && d.custoUnit > 0 && d.custoUnit !== produtoDoDraft.custoUnit
                  ? `cadastro: ${money(produtoDoDraft.custoUnit)}`
                  : undefined
              }
            >
              <NumberInput value={d.custoUnit} onValue={(v) => set("custoUnit", v ?? 0)} unit="R$" mostrarZero />
            </Field>
            <Field label="Frete da compra">
              <NumberInput value={d.frete} onValue={(v) => set("frete", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Outros custos" hint="imposto de importação, despachante…">
              <NumberInput value={d.outrosCustos} onValue={(v) => set("outrosCustos", v ?? 0)} unit="R$" />
            </Field>

            <Field label="Status">
              <select value={d.status} onChange={(e) => set("status", e.target.value as CompraStatus)} className={inputClass}>
                {STATUS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {STATUS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data do pedido">
              <input type="datetime-local" value={d.data} onChange={(e) => set("data", e.target.value)} className={inputClass} />
            </Field>
            {d.status === "recebida" && (
              <Field label="Data de recebimento" hint="quando entrou no estoque">
                <input
                  type="date"
                  value={d.dataRecebimento || hoje()}
                  onChange={(e) => set("dataRecebimento", e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
            <CampoLoja valor={d.lojaId} onChange={(v) => set("lojaId", v)} />
            <Field label="Fornecedor">
              <TextInput value={d.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
            </Field>
            <Field label="Nº da nota / pedido">
              <TextInput value={d.numeroNota} onChange={(e) => set("numeroNota", e.target.value)} placeholder="NF-1234" />
            </Field>
            <div className="col-span-2 lg:col-span-4">
              <Field label="Observação">
                <TextInput value={d.observacao} onChange={(e) => set("observacao", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <span className="font-mono text-xs tabular-nums text-txtDim">
              Total da compra:{" "}
              <span className="text-gold">{money(totalDraft)}</span>
              {d.quantidade > 0 && (
                <span className="text-txtFaint">
                  {" "}
                  · {money(totalDraft / d.quantidade)}/un com frete
                </span>
              )}
            </span>
            <button
              onClick={salvar}
              disabled={!valido}
              className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {editId ? <Save size={15} /> : <Plus size={15} />} {editId ? "Salvar alterações" : "Registrar compra"}
            </button>
          </div>
        </GlowCard>
      )}

      {/* summary (reflects the current filters) */}
      <Ocultavel id="compras.kpis" label="Indicadores do topo" className="mb-4 block">
        <div className="grid grid-cols-12 gap-4">
        <MetricTile dense label="Investido" value={resumo.investido} format={money} icon={Coins} accent="gold" className="col-span-6 lg:col-span-3" />
        <MetricTile dense label="Unidades compradas" value={resumo.unidades} format={(v) => number(v)} icon={ShoppingCart} footnote={`${resumo.pedidos} compra(s)`} className="col-span-6 lg:col-span-3" delay={0.05} />
        <MetricTile dense label="Já recebidas" value={resumo.recebidas} format={(v) => number(v)} icon={PackageCheck} accent="green" className="col-span-6 lg:col-span-3" delay={0.1} />
        <MetricTile dense label="A caminho" value={resumo.aCaminho} format={(v) => number(v)} icon={Truck} accent="red" footnote={`${resumo.pendentes} compra(s) pendente(s)`} className="col-span-6 lg:col-span-3" delay={0.15} />
        </div>
      </Ocultavel>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
          <Search size={15} className="text-txtFaint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, código, fornecedor, nota…"
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
        <FilterSelect label="Status" value={fStatus} onChange={(v) => setFStatus(v as "todos" | CompraStatus)}>
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
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* the ledger owns the full width — it's what this page is for */}
        <GlowCard className={`col-span-12 overflow-hidden p-0 ${dividido ? "lg:col-span-8" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {/* secondary columns drop out when the window is narrow, so the ledger never
                      needs a horizontal scroll — the data is still searchable and in the form */}
                  {[
                    { h: "Data", cls: "" },
                    { h: "Produto", cls: "" },
                    { h: "Qtd", cls: "" },
                    { h: "Custo/un", cls: "hidden xl:table-cell" },
                    { h: "Total", cls: "" },
                    { h: "Status", cls: "" },
                    { h: "Nota", cls: "hidden xl:table-cell" },
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
                    <td colSpan={8} className="px-3 py-12 text-center text-sm text-txtDim">
                      Nenhuma compra encontrada.
                    </td>
                  </tr>
                ) : (
                  linhas.map((c) => {
                    const prod = produtos.find((p) => p.id === c.produtoId);
                    const custoDiferente = prod && c.custoUnit !== prod.custoUnit && c.status !== "cancelada";
                    return (
                      <tr key={c.id} className="border-b border-line/60 transition-colors hover:bg-greenSoft/20">
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-txtDim">
                          {datetime(c.data)}
                          {c.dataRecebimento && (
                            <span className="block text-[10px] text-txtFaint">chegou {fmtDate(c.dataRecebimento)}</span>
                          )}
                        </td>
                        <td className="max-w-[140px] px-3 py-3 text-sm text-txt xl:max-w-[190px]">
                          <span className="block truncate">{c.produtoNome}</span>
                          {c.fornecedor && <span className="block font-mono text-[11px] text-txtFaint">{c.fornecedor}</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-sm tabular-nums text-txtDim">{number(c.quantidade)}</td>
                        <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums text-txt xl:table-cell">
                          {money(c.custoUnit)}
                          {custoDiferente && (
                            <span className="block text-[10px] text-amber">≠ {money(prod!.custoUnit)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums text-gold">
                          {money(custoTotalCompra(c))}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] ${STATUS[c.status].cls}`}>
                            {STATUS[c.status].label}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-xs text-txtDim xl:table-cell">{c.numeroNota ?? "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            {custoDiferente && (
                              <Tooltip label="Usar este custo no produto">
                                <button
                                  onClick={() => aplicarCusto(c)}
                                  className="text-amber transition-colors hover:text-gold"
                                  aria-label="Usar este custo no produto"
                                >
                                  <Coins size={15} />
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip label="Editar">
                              <button onClick={() => editar(c)} className="text-txtDim transition-colors hover:text-green" aria-label="Editar">
                                <Pencil size={15} />
                              </button>
                            </Tooltip>
                            <Tooltip label="Excluir">
                              <button onClick={() => excluir(c)} className="text-txtDim transition-colors hover:text-danger" aria-label="Excluir">
                                <Trash2 size={15} />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlowCard>

        <Ocultavel id="compras.resumo" label="Resumo por fornecedor" className={`col-span-12 ${dividido ? "lg:col-span-4 lg:order-first" : ""}`}>
            <GlowCard className="h-full">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Por fornecedor</span>
            {porFornecedor.length === 0 ? (
              <p className="py-8 text-center text-sm text-txtDim">Nenhuma compra no filtro atual.</p>
            ) : (
              <ul className={`mt-3 ${dividido ? "flex flex-col gap-2.5" : "grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3"}`}>
                {porFornecedor.map((f, i) => (
                  <li key={f.fornecedor}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-txt">{f.fornecedor}</span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="font-mono text-sm tabular-nums text-gold">{money(f.investido)}</span>
                        <span className="w-12 text-right font-mono text-xs tabular-nums text-txtDim">{percent(f.share)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/40">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(f.share / maxShare) * 100}%` }}
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
