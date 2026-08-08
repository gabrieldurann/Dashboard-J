import { ChevronDown, Coins, Package, Pencil, Plus, Receipt, Save, Search, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { detalharVenda } from "../calc/engine";
import type { Venda, VendaStatus } from "../calc/types";
import { CascataVenda } from "../components/CascataVenda";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { date, datetime, money } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { useConfig } from "../store/useConfig";
import { useStore } from "../store/useStore";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { PAISES, paisFlag, paisNome } from "../data/countries";

const STATUS: Record<VendaStatus, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "text-amber border-amber/40 bg-amberSoft" },
  enviado: { label: "Enviado", cls: "text-sky border-sky/40 bg-skySoft" },
  entregue: { label: "Entregue", cls: "text-green border-green/40 bg-greenSoft" },
  cancelado: { label: "Cancelado", cls: "text-txtDim border-lineStrong bg-neutroSoft" },
};
const STATUS_KEYS = Object.keys(STATUS) as VendaStatus[];

/**
 * Ledger columns, staged by width. The collapsed row is for *finding* a sale — identifiers and
 * the amount — while the money breakdown (lucro, margem) lives in the expanded waterfall, so it
 * costs a click rather than a column. Cliente is panel-only; it is still searchable.
 * The content box maxes out at ~1074px (Screen's `max-w-[1180px]`), so this is a fixed budget:
 * adding a column here means removing one. See the layout notes in PLAN.md.
 */
const COLUNAS: { k: string; label: string; cls?: string }[] = [
  { k: "chevron", label: "" },
  { k: "data", label: "Data" },
  { k: "pedido", label: "Pedido" },
  { k: "produto", label: "Produto" },
  { k: "codigo", label: "Código" },
  { k: "qtd", label: "Qtd", cls: "hidden xl:table-cell" },
  { k: "total", label: "Total" },
  { k: "canal", label: "Canal", cls: "hidden xl:table-cell" },
  { k: "status", label: "Status" },
  { k: "pais", label: "País", cls: "hidden xl:table-cell" },
  { k: "acoes", label: "" },
];

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Draft = {
  produtoId: string; // "" = avulsa
  produtoNome: string;
  codigoProduto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  canal: string;
  status: VendaStatus;
  numeroPedido: string;
  data: string;
  cliente: string;
  enderecoEntrega: string;
  cidade: string;
  uf: string;
  cep: string;
  pais: string;
  frete: number;
  observacao: string;
};

const emptyDraft = (): Draft => ({
  produtoId: "",
  produtoNome: "",
  codigoProduto: "",
  quantidade: 1,
  valorUnitario: 0,
  valorTotal: 0,
  canal: "",
  status: "pendente",
  numeroPedido: "",
  data: nowLocal(),
  cliente: "",
  enderecoEntrega: "",
  cidade: "",
  uf: "",
  cep: "",
  pais: "BR",
  frete: 0,
  observacao: "",
});

export function Vendas() {
  const cfg = useConfig();
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);
  const addVenda = useStore((s) => s.addVenda);
  const updateVenda = useStore((s) => s.updateVenda);
  const removeVenda = useStore((s) => s.removeVenda);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null); // expanded order (one at a time)
  const [d, setD] = useState<Draft>(emptyDraft);

  const [busca, setBusca] = useState("");
  const [fProduto, setFProduto] = useState("todos"); // todos | avulsa | <produtoId>
  const [fStatus, setFStatus] = useState<"todos" | VendaStatus>("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const canais = useMemo(
    () => Array.from(new Set(vendas.map((v) => v.canal).filter(Boolean))) as string[],
    [vendas],
  );

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vendas
      .filter((v) => {
        if (fProduto === "avulsa" && v.produtoId) return false;
        if (fProduto !== "todos" && fProduto !== "avulsa" && v.produtoId !== fProduto) return false;
        if (fStatus !== "todos" && v.status !== fStatus) return false;
        if (fCanal !== "todos" && v.canal !== fCanal) return false;
        const dia = v.data.slice(0, 10);
        if (dataDe && dia < dataDe) return false;
        if (dataAte && dia > dataAte) return false;
        if (!q) return true;
        return [v.produtoNome, v.codigoProduto, v.cliente, v.numeroPedido, v.enderecoEntrega, v.cidade]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [vendas, busca, fProduto, fStatus, fCanal, dataDe, dataAte]);

  // Waterfall for the open order only — no point costing it for rows nobody expanded.
  // Same source as every total in the app, so it always reconciles with the Painel.
  const detalhe = useMemo(() => {
    const v = linhas.find((x) => x.id === aberta);
    return v ? detalharVenda(v, produtos, cfg) : null;
  }, [linhas, aberta, produtos, cfg]);

  const totais = useMemo(() => {
    const receita = linhas.reduce((s, v) => s + v.valorTotal, 0);
    const itens = linhas.reduce((s, v) => s + v.quantidade, 0);
    return { receita, itens, qtd: linhas.length };
  }, [linhas]);

  const temFiltro = busca || fProduto !== "todos" || fStatus !== "todos" || fCanal !== "todos" || dataDe || dataAte;
  const limpar = () => {
    setBusca("");
    setFProduto("todos");
    setFStatus("todos");
    setFCanal("todos");
    setDataDe("");
    setDataAte("");
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
      valorUnitario: p.precoVenda,
      valorTotal: +(p.precoVenda * prev.quantidade).toFixed(2),
    }));
  };

  const setQtd = (q: number) => setD((p) => ({ ...p, quantidade: q, valorTotal: +(q * p.valorUnitario).toFixed(2) }));
  const setUnit = (u: number) => setD((p) => ({ ...p, valorUnitario: u, valorTotal: +(p.quantidade * u).toFixed(2) }));

  const valido = d.produtoNome.trim() !== "" && d.valorTotal > 0;
  const registrar = () => {
    if (!valido) return;
    const payload: Omit<Venda, "id"> = {
      data: d.data || nowLocal(),
      produtoId: d.produtoId || undefined,
      produtoNome: d.produtoNome.trim(),
      codigoProduto: d.codigoProduto || undefined,
      quantidade: d.quantidade,
      valorUnitario: d.valorUnitario,
      valorTotal: d.valorTotal,
      canal: d.canal || undefined,
      status: d.status,
      numeroPedido: d.numeroPedido || undefined,
      cliente: d.cliente || undefined,
      enderecoEntrega: d.enderecoEntrega || undefined,
      pais: d.pais || undefined,
      cidade: d.cidade || undefined,
      uf: d.uf || undefined,
      cep: d.cep || undefined,
      frete: d.frete || undefined,
      observacao: d.observacao || undefined,
    };
    if (editId) {
      updateVenda(editId, payload);
      toast.success("Venda atualizada");
    } else {
      addVenda({ id: crypto.randomUUID(), ...payload });
      toast.success("Venda registrada");
    }
    setD(emptyDraft());
    setEditId(null);
    setShowForm(false);
  };

  const novaVenda = () => {
    setEditId(null);
    setD(emptyDraft());
    setShowForm(true);
  };

  const editar = (v: Venda) => {
    setEditId(v.id);
    setD({
      produtoId: v.produtoId ?? "",
      produtoNome: v.produtoNome,
      codigoProduto: v.codigoProduto ?? "",
      quantidade: v.quantidade,
      valorUnitario: v.valorUnitario,
      valorTotal: v.valorTotal,
      canal: v.canal ?? "",
      status: v.status,
      numeroPedido: v.numeroPedido ?? "",
      data: v.data,
      cliente: v.cliente ?? "",
      enderecoEntrega: v.enderecoEntrega ?? "",
      cidade: v.cidade ?? "",
      uf: v.uf ?? "",
      cep: v.cep ?? "",
      pais: v.pais ?? "BR",
      frete: v.frete ?? 0,
      observacao: v.observacao ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluirVenda = async (v: Venda) => {
    const ok = await confirmAction({
      title: "Excluir venda?",
      message: `A venda de "${v.produtoNome}"${v.numeroPedido ? ` (pedido ${v.numeroPedido})` : ""} será removida do histórico.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeVenda(v.id);
    toast.success("Venda excluída");
  };

  return (
    <Screen
      eyebrow="Registros"
      title="Vendas"
      subtitle="Histórico de todas as vendas individuais — produto, valor, entrega e status, com filtros."
      actions={
        <button
          onClick={() => (showForm ? setShowForm(false) : novaVenda())}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fechar" : "Registrar venda"}
        </button>
      }
    >
      {showForm && (
        <GlowCard accent="green" className="mb-4">
          <span className="mb-4 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            {editId ? "Editar venda" : "Nova venda"}
          </span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2">
              <Field label="Produto" hint="Selecione do catálogo ou deixe em Avulsa">
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
            <Field label="Quantidade">
              <NumberInput value={d.quantidade} onValue={(v) => setQtd(v ?? 0)} />
            </Field>
            <Field label="Valor unitário">
              <NumberInput value={d.valorUnitario} onValue={(v) => setUnit(v ?? 0)} unit="R$" />
            </Field>
            <Field label="Valor total" hint="Auto, editável">
              <NumberInput value={d.valorTotal} onValue={(v) => set("valorTotal", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Frete">
              <NumberInput value={d.frete} onValue={(v) => set("frete", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Data / hora">
              <input
                type="datetime-local"
                value={d.data}
                onChange={(e) => set("data", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select value={d.status} onChange={(e) => set("status", e.target.value as VendaStatus)} className={inputClass}>
                {STATUS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {STATUS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Canal">
              <TextInput value={d.canal} onChange={(e) => set("canal", e.target.value)} placeholder="Amazon, Shopee..." />
            </Field>
            <Field label="Nº do pedido">
              <TextInput value={d.numeroPedido} onChange={(e) => set("numeroPedido", e.target.value)} />
            </Field>
            <Field label="Cliente">
              <TextInput value={d.cliente} onChange={(e) => set("cliente", e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="Endereço de entrega">
                <TextInput value={d.enderecoEntrega} onChange={(e) => set("enderecoEntrega", e.target.value)} />
              </Field>
            </div>
            <Field label="Cidade">
              <TextInput value={d.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </Field>
            <Field label="UF">
              <TextInput value={d.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} />
            </Field>
            <Field label="CEP">
              <TextInput value={d.cep} onChange={(e) => set("cep", e.target.value)} />
            </Field>
            <Field label="País" hint="Para o mapa de alcance">
              <select value={d.pais} onChange={(e) => set("pais", e.target.value)} className={inputClass}>
                {PAISES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.flag} {p.nome}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-span-2 lg:col-span-4">
              <Field label="Observação">
                <TextInput value={d.observacao} onChange={(e) => set("observacao", e.target.value)} />
              </Field>
            </div>
          </div>
          <button
            onClick={registrar}
            disabled={!valido}
            className="mt-5 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editId ? <Save size={15} /> : <Plus size={15} />} {editId ? "Salvar alterações" : "Registrar venda"}
          </button>
        </GlowCard>
      )}

      {/* summary (reflects current filters) */}
      <div className="mb-4 grid grid-cols-12 gap-4">
        <MetricTile label="Vendas" value={totais.qtd} format={(v) => String(Math.round(v))} icon={Receipt} className="col-span-6 lg:col-span-4" />
        <MetricTile label="Receita" value={totais.receita} format={money} icon={Coins} accent="gold" className="col-span-6 lg:col-span-4" delay={0.05} />
        <MetricTile label="Itens vendidos" value={totais.itens} format={(v) => String(Math.round(v))} icon={Package} className="col-span-6 lg:col-span-4" delay={0.1} />
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
          <Search size={15} className="text-txtFaint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, código, cliente, pedido, endereço…"
            className="w-72 bg-transparent font-mono text-sm text-txt outline-none placeholder:text-txtFaint"
          />
        </div>
        <FilterSelect label="Produto" value={fProduto} onChange={setFProduto}>
          <option value="todos">Todos os produtos</option>
          <option value="avulsa">Apenas avulsas</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" value={fStatus} onChange={(v) => setFStatus(v as "todos" | VendaStatus)}>
          <option value="todos">Todos</option>
          {STATUS_KEYS.map((k) => (
            <option key={k} value={k}>
              {STATUS[k].label}
            </option>
          ))}
        </FilterSelect>
        {canais.length > 0 && (
          <FilterSelect label="Canal" value={fCanal} onChange={setFCanal}>
            <option value="todos">Todos</option>
            {canais.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FilterSelect>
        )}
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Período</span>
          <div className="flex items-center gap-2 rounded-chip border border-line bg-bgRaise/40 px-2 py-1">
            <input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              title="De"
              className="bg-transparent px-1 py-1 font-mono text-sm text-txt outline-none"
            />
            <span className="font-mono text-xs text-txtFaint">→</span>
            <input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              title="Até"
              className="bg-transparent px-1 py-1 font-mono text-sm text-txt outline-none"
            />
          </div>
        </div>
        {temFiltro && (
          <button onClick={limpar} className="rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt">
            Limpar filtros
          </button>
        )}
      </div>

      {/* table — click a row to open its profit waterfall (Phase 10a) */}
      <GlowCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {COLUNAS.map((c) => (
                  <th
                    key={c.k}
                    className={`whitespace-nowrap px-2 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint xl:px-3 ${c.cls ?? ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-4 py-10 text-center text-sm text-txtDim">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                linhas.map((v) => {
                  const aberto = aberta === v.id;
                  const produto = v.produtoId ? produtos.find((p) => p.id === v.produtoId) : undefined;
                  return (
                    <Fragment key={v.id}>
                      <tr
                        onClick={() => setAberta(aberto ? null : v.id)}
                        className={`cursor-pointer border-b border-line/60 transition-colors hover:bg-greenSoft/20 ${aberto ? "bg-greenSoft/20" : ""}`}
                      >
                        <td className="px-2 py-3">
                          <motion.span
                            animate={{ rotate: aberto ? 180 : 0 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="flex text-txtFaint"
                          >
                            <ChevronDown size={16} />
                          </motion.span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-txtDim xl:px-3">
                          {date(v.data)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-txtDim xl:px-3">
                          {v.numeroPedido ?? "—"}
                        </td>
                        <td className="max-w-[110px] truncate px-2 py-3 text-sm text-txt xl:max-w-[135px] xl:px-3" title={v.produtoNome}>
                          {v.produtoNome}
                          {!v.produtoId && <span className="ml-2 font-mono text-[10px] text-gold">avulsa</span>}
                          {v.origem === "amazon" && (
                            <span
                              className="ml-2 font-mono text-[10px] text-sky"
                              title="Importada automaticamente da conta Amazon conectada"
                            >
                              importada
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-txtDim xl:px-3">
                          {v.codigoProduto ?? "—"}
                        </td>
                        <td className="hidden px-2 py-3 font-mono text-sm tabular-nums text-txtDim xl:table-cell xl:px-3">{v.quantidade}</td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-txt xl:px-3">{money(v.valorTotal)}</td>
                        <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-txtDim xl:table-cell xl:px-3">{v.canal ?? "—"}</td>
                        <td className="px-2 py-3 xl:px-3">
                          <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] ${STATUS[v.status].cls}`}>
                            {STATUS[v.status].label}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-txtDim xl:table-cell xl:px-3">
                          {v.pais ? (
                            <span title={paisNome(v.pais)}>
                              {paisFlag(v.pais)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-3 xl:px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <button onClick={() => editar(v)} className="text-txtDim transition-colors hover:text-green" title="Editar venda">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => excluirVenda(v)} className="text-txtDim transition-colors hover:text-danger" title="Excluir venda">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      <AnimatePresence initial={false}>
                        {aberto && (
                          <tr>
                            <td colSpan={COLUNAS.length} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: EASE }}
                                className="overflow-hidden border-b border-line/60 bg-bgRaise/40"
                              >
                                <div className="grid gap-6 px-4 py-5 lg:grid-cols-2">
                                  <div className="flex flex-col gap-3">
                                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
                                      Dados do pedido
                                    </span>
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                      <Dado termo="Data de criação" valor={datetime(v.data)} />
                                      <Dado termo="Nº do pedido" valor={v.numeroPedido} />
                                      <Dado termo="Quantidade" valor={`${v.quantidade} × ${money(v.valorUnitario)}`} />
                                      <Dado termo="Canal" valor={v.canal} />
                                      <Dado
                                        termo="Origem"
                                        valor={v.origem === "amazon" ? "Importada da Amazon" : undefined}
                                      />
                                      <Dado termo="Código" valor={v.codigoProduto} />
                                      <Dado termo="ASIN" valor={produto?.asin} />
                                      <Dado termo="EAN" valor={produto?.ean} />
                                      <Dado termo="Cliente" valor={v.cliente} />
                                      <Dado
                                        termo="País"
                                        valor={v.pais ? `${paisFlag(v.pais)} ${paisNome(v.pais)}` : undefined}
                                      />
                                    </dl>
                                    {(v.enderecoEntrega || v.cidade || v.cep) && (
                                      <dl className="grid grid-cols-1 gap-2.5">
                                        <Dado
                                          termo="Entrega"
                                          valor={[v.enderecoEntrega, v.cidade && `${v.cidade}${v.uf ? "/" + v.uf : ""}`, v.cep]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        />
                                      </dl>
                                    )}
                                    {v.observacao && (
                                      <p className="rounded-chip bg-panel px-3 py-2 text-xs leading-relaxed text-txtDim">
                                        {v.observacao}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-3">
                                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
                                      Composição do lucro
                                    </span>
                                    {detalhe && <CascataVenda detalhe={detalhe} />}
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlowCard>
    </Screen>
  );
}

/** One term/value pair of the expanded order's metadata. Renders nothing when there's no value. */
function Dado({ termo, valor }: { termo: string; valor?: string }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">{termo}</dt>
      <dd className="truncate text-sm text-txt" title={valor}>
        {valor}
      </dd>
    </div>
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

