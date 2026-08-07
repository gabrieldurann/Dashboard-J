import { Coins, MousePointerClick, Megaphone, Pencil, Plus, Save, Search, Target, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { desempenhoAds, resumoAds } from "../calc/engine";
import type { DesempenhoAds } from "../calc/engine";
import type { AnuncioAds } from "../calc/types";
import { ExibicaoMenu, type LayoutLedger } from "../components/ExibicaoMenu";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Ocultavel, type CardRegistrado } from "../components/Ocultavel";
import { Screen } from "../components/Screen";
import { date, money, number, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { useCores } from "../theme/useCores";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";

const PAGINA = "ads";
const CARDS: CardRegistrado[] = [
  { id: "ads.kpis", label: "Indicadores", essencial: true },
  { id: "ads.resumo", label: "Desempenho por produto" },
];

/**
 * ACOS bands. Unlike the margin bands these are not user-configurable yet — they are the
 * rules of thumb sellers use, and a bad ACOS is bad regardless of the product's own margin.
 */
const acosCor = (v: number | null, cores: ReturnType<typeof useCores>) => {
  if (v === null) return cores.txtFaint;
  if (v > 0.3) return cores.danger;
  if (v > 0.2) return cores.amber;
  return cores.green;
};

const hoje = () => new Date().toISOString().slice(0, 10);

type Draft = {
  produtoId: string;
  produtoNome: string;
  sku: string;
  canal: string;
  data: string;
  custo: number;
  faturamentoAds: number;
  unidadesAds: number;
  unidadesOrganicas: number;
  cliques: number;
  observacao: string;
};

const emptyDraft = (): Draft => ({
  produtoId: "",
  produtoNome: "",
  sku: "",
  canal: "Amazon",
  data: hoje(),
  custo: 0,
  faturamentoAds: 0,
  unidadesAds: 0,
  unidadesOrganicas: 0,
  cliques: 0,
  observacao: "",
});

export function Ads() {
  const cores = useCores();
  const anuncios = useStore((s) => s.anunciosAds);
  const produtos = useStore((s) => s.produtos);
  const addAnuncio = useStore((s) => s.addAnuncioAds);
  const updateAnuncio = useStore((s) => s.updateAnuncioAds);
  const removeAnuncio = useStore((s) => s.removeAnuncioAds);
  const layout = useStore((s) => s.layouts[PAGINA] ?? "empilhado") as LayoutLedger;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(emptyDraft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const [busca, setBusca] = useState("");
  const [fCanal, setFCanal] = useState("todos");
  const [fMes, setFMes] = useState("todos");

  const canais = useMemo(
    () => Array.from(new Set(anuncios.map((a) => a.canal).filter(Boolean))),
    [anuncios],
  );
  const meses = useMemo(
    () => Array.from(new Set(anuncios.map((a) => a.data.slice(0, 7)))).sort().reverse(),
    [anuncios],
  );

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return anuncios
      .filter((a) => {
        if (fCanal !== "todos" && a.canal !== fCanal) return false;
        if (fMes !== "todos" && a.data.slice(0, 7) !== fMes) return false;
        if (!q) return true;
        return [a.produtoNome, a.sku, a.canal].filter(Boolean).some((s) => (s as string).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [anuncios, busca, fCanal, fMes]);

  const resumo = useMemo(() => resumoAds(linhas), [linhas]);
  const porProduto = useMemo(() => desempenhoAds(linhas), [linhas]);

  const temFiltro = busca || fCanal !== "todos" || fMes !== "todos";
  const limpar = () => {
    setBusca("");
    setFCanal("todos");
    setFMes("todos");
  };

  const escolherProduto = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) {
      setD((prev) => ({ ...prev, produtoId: "", produtoNome: "", sku: "" }));
      return;
    }
    setD((prev) => ({ ...prev, produtoId: p.id, produtoNome: p.nome, sku: p.codigoProduto ?? prev.sku }));
  };

  const abrirNovo = () => {
    setEditId(null);
    setD(emptyDraft());
    setShowForm(true);
  };
  const abrirEdicao = (a: AnuncioAds) => {
    setEditId(a.id);
    setD({
      produtoId: a.produtoId ?? "",
      produtoNome: a.produtoNome,
      sku: a.sku ?? "",
      canal: a.canal,
      data: a.data.slice(0, 10),
      custo: a.custo,
      faturamentoAds: a.faturamentoAds,
      unidadesAds: a.unidadesAds,
      unidadesOrganicas: a.unidadesOrganicas ?? 0,
      cliques: a.cliques ?? 0,
      observacao: a.observacao ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const valido = d.produtoNome.trim() !== "" && d.custo > 0;
  const salvar = () => {
    if (!valido) return;
    const payload: Omit<AnuncioAds, "id"> = {
      produtoId: d.produtoId || undefined,
      produtoNome: d.produtoNome.trim(),
      sku: d.sku.trim() || undefined,
      canal: d.canal.trim() || "Amazon",
      data: d.data || hoje(),
      custo: d.custo,
      faturamentoAds: d.faturamentoAds,
      unidadesAds: d.unidadesAds,
      unidadesOrganicas: d.unidadesOrganicas || undefined,
      cliques: d.cliques || undefined,
      observacao: d.observacao.trim() || undefined,
    };
    if (editId) {
      updateAnuncio(editId, payload);
      toast.success("Campanha atualizada");
    } else {
      addAnuncio({ id: crypto.randomUUID(), ...payload });
      toast.success("Campanha registrada");
    }
    setShowForm(false);
    setEditId(null);
    setD(emptyDraft());
  };

  const excluir = async (a: AnuncioAds) => {
    const ok = await confirmAction({
      title: "Excluir campanha?",
      message: `O registro de anúncios de "${a.produtoNome}" (${date(a.data)}) será removido.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeAnuncio(a.id);
    toast.success("Campanha excluída");
  };

  const dividido = layout === "dividido";

  return (
    <Screen
      eyebrow="Amazon"
      title="Ads"
      subtitle="O que os anúncios custam e o que trazem de volta — ACOS, TACOS e o peso do tráfego pago em cada produto."
      actions={
        <div className="flex items-center gap-2">
          <ExibicaoMenu cards={CARDS} paginaLayout={PAGINA} />
          <button
            onClick={() => (showForm ? setShowForm(false) : abrirNovo())}
            className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fechar" : "Registrar campanha"}
          </button>
        </div>
      }
    >
      {showForm && (
        <GlowCard accent="green" className="mb-4">
          <span className="mb-4 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
            {editId ? "Editar campanha" : "Nova campanha"}
          </span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2">
              <Field label="Produto" hint="Do catálogo, ou deixe solto e digite o nome">
                <select value={d.produtoId} onChange={(e) => escolherProduto(e.target.value)} className={inputClass}>
                  <option value="">— Fora do catálogo —</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {!d.produtoId && (
              <Field label="Nome do anúncio">
                <TextInput value={d.produtoNome} onChange={(e) => set("produtoNome", e.target.value)} />
              </Field>
            )}
            <Field label="SKU">
              <TextInput value={d.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <Field label="Canal">
              <TextInput value={d.canal} onChange={(e) => set("canal", e.target.value)} placeholder="Amazon…" />
            </Field>
            <Field label="Mês de referência" hint="Os números valem para o mês inteiro">
              <input type="date" value={d.data} onChange={(e) => set("data", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Custo dos anúncios">
              <NumberInput value={d.custo} onValue={(v) => set("custo", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Faturamento dos anúncios" hint="Receita atribuída pela plataforma">
              <NumberInput value={d.faturamentoAds} onValue={(v) => set("faturamentoAds", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Unidades via anúncio">
              <NumberInput value={d.unidadesAds} onValue={(v) => set("unidadesAds", v ?? 0)} />
            </Field>
            <Field label="Unidades orgânicas" hint="Vendidas sem anúncio no mês">
              <NumberInput value={d.unidadesOrganicas} onValue={(v) => set("unidadesOrganicas", v ?? 0)} />
            </Field>
            <Field label="Cliques" hint="Opcional — habilita a conversão">
              <NumberInput value={d.cliques} onValue={(v) => set("cliques", v ?? 0)} />
            </Field>
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
            {editId ? <Save size={15} /> : <Plus size={15} />} {editId ? "Salvar alterações" : "Registrar campanha"}
          </button>
        </GlowCard>
      )}

      <Ocultavel id="ads.kpis" label="Indicadores" className="mb-4 block">
          <div className="grid grid-cols-12 gap-4">
            <MetricTile
              dense
              label="Custo dos anúncios"
              value={resumo.custo}
              format={money}
              icon={Megaphone}
              accent="red"
              footnote="O que saiu em tráfego pago"
              className="col-span-6 lg:col-span-3 h-full"
            />
            <MetricTile
              dense
              label="Faturamento via ads"
              value={resumo.faturamentoAds}
              format={money}
              icon={Coins}
              accent="gold"
              footnote={`${number(resumo.unidadesAds)} un. vendidas pelo anúncio`}
              delay={0.05}
              className="col-span-6 lg:col-span-3 h-full"
            />
            <GlowCard className="col-span-6 h-full lg:col-span-3" delay={0.1}>
              <div className="flex items-center gap-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                  <Target size={15} style={{ color: acosCor(resumo.acos, cores) }} strokeWidth={2} />
                </span>
                <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">ACOS</span>
              </div>
              <p className="mt-3 font-mono text-2xl tabular-nums" style={{ color: acosCor(resumo.acos, cores) }}>
                {resumo.acos === null ? "—" : percent(resumo.acos)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-txtFaint">Custo ÷ faturamento dos anúncios</p>
            </GlowCard>
            <GlowCard className="col-span-6 h-full lg:col-span-3" delay={0.15}>
              <div className="flex items-center gap-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                  <MousePointerClick size={15} className="text-green" strokeWidth={2} />
                </span>
                <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">TACOS</span>
              </div>
              <p className="mt-3 font-mono text-2xl tabular-nums text-txt">
                {resumo.tacos === null ? "—" : percent(resumo.tacos)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-txtFaint">
                Custo ÷ faturamento total {resumo.conversao !== null && `· conversão ${percent(resumo.conversao)}`}
              </p>
            </GlowCard>
        </div>
      </Ocultavel>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
          <Search size={15} className="text-txtFaint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, SKU, canal…"
            className="w-64 bg-transparent font-mono text-sm text-txt outline-none placeholder:text-txtFaint"
          />
        </div>
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
        <FilterSelect label="Mês" value={fMes} onChange={setFMes}>
          <option value="todos">Todos</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {m.split("-").reverse().join("/")}
            </option>
          ))}
        </FilterSelect>
        {temFiltro && (
          <button onClick={limpar} className="rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ledger */}
        <GlowCard className={`col-span-12 overflow-hidden p-0 ${dividido ? "lg:col-span-8" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {[
                    { k: "mes", l: "Mês" },
                    { k: "produto", l: "Produto" },
                    { k: "canal", l: "Canal", cls: "hidden xl:table-cell" },
                    { k: "custo", l: "Custo" },
                    { k: "fat", l: "Fat. ads" },
                    { k: "un", l: "Un. ads", cls: "hidden xl:table-cell" },
                    { k: "acos", l: "ACOS" },
                    { k: "acoes", l: "" },
                  ].map((c) => (
                    <th
                      key={c.k}
                      className={`whitespace-nowrap px-2 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint xl:px-3 ${c.cls ?? ""}`}
                    >
                      {c.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-txtDim">
                      Nenhuma campanha registrada — lance o custo e o retorno dos anúncios do mês.
                    </td>
                  </tr>
                ) : (
                  linhas.map((a) => {
                    const r = resumoAds([a]);
                    return (
                      <tr key={a.id} className="border-b border-line/60 transition-colors hover:bg-greenSoft/20">
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-txtDim xl:px-3">
                          {a.data.slice(0, 7).split("-").reverse().join("/")}
                        </td>
                        <td className="max-w-[150px] truncate px-2 py-3 text-sm text-txt xl:px-3" title={a.produtoNome}>
                          {a.produtoNome}
                          {a.sku && <span className="ml-2 font-mono text-[10px] text-txtFaint">{a.sku}</span>}
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-txtDim xl:table-cell xl:px-3">{a.canal}</td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-danger xl:px-3">
                          −{money(a.custo)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-txt xl:px-3">
                          {money(a.faturamentoAds)}
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-txtDim xl:table-cell xl:px-3">
                          {number(a.unidadesAds)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums xl:px-3" style={{ color: acosCor(r.acos, cores) }}>
                          {r.acos === null ? "—" : percent(r.acos)}
                        </td>
                        <td className="px-2 py-3 xl:px-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => abrirEdicao(a)} className="text-txtDim transition-colors hover:text-green" title="Editar">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => excluir(a)} className="text-txtDim transition-colors hover:text-danger" title="Excluir">
                              <Trash2 size={15} />
                            </button>
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

        {/* per-product rollup */}
        {porProduto.length > 0 && (
          <Ocultavel
            id="ads.resumo"
            label="Desempenho por produto"
            className={`col-span-12 ${dividido ? "lg:order-first lg:col-span-4" : ""}`}
          >
            <GlowCard className="h-full">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Desempenho por produto</span>
              <p className="mt-0.5 font-mono text-[11px] text-txtFaint">
                Quanto do volume veio do anúncio e a que custo
              </p>
              <ul
                className={`mt-4 grid gap-4 ${dividido ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}
              >
                {porProduto.map((p, i) => (
                  <LinhaProduto key={p.produtoId ?? p.nome} p={p} i={i} cor={acosCor(p.acos, cores)} />
                ))}
              </ul>
            </GlowCard>
          </Ocultavel>
        )}
      </div>
    </Screen>
  );
}

/** One product's ad performance: spend vs return, plus how much of its volume the ads carried. */
function LinhaProduto({ p, i, cor }: { p: DesempenhoAds; i: number; cor: string }) {
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-txt" title={p.nome}>
          {p.nome}
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums" style={{ color: cor }}>
          {p.acos === null ? "—" : percent(p.acos)}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-[11px] text-txtFaint">
        <span>
          <span className="text-danger">−{money(p.custo)}</span> → {money(p.faturamentoAds)}
        </span>
        {p.parcelaAds !== null && <span>{percent(p.parcelaAds)} via ads</span>}
      </div>
      {/* share of this product's units that the ads brought in */}
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/40" title="Parcela das unidades vinda do anúncio">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(p.parcelaAds ?? 0) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.05 * i }}
          className="h-full rounded-full"
          style={{ background: cor }}
        />
      </div>
    </li>
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
