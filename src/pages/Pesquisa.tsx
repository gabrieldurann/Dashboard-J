import { ExternalLink, Image as ImageIcon, ImagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { COMISSAO_PADRAO, IMPOSTO_PADRAO } from "../calc/constants";
import { calcularMetricas } from "../calc/engine";
import type { Pesquisa as PesquisaT } from "../calc/types";
import { Field, inputClass, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { money, percent, date } from "../i18n/format";
import { useStore } from "../store/useStore";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";

type Aprov = "auto" | "sim" | "nao";
type Draft = {
  link: string;
  nome: string;
  imagem: string;
  dataPesquisa: string;
  precoVenda: number;
  vendasMes: number;
  custoUnit: number;
  fornecedor: string;
  qtdCaixa: number;
  imposto: number;
  comissao: number;
  aprovacao: Aprov;
  observacao: string;
};

const emptyDraft = (): Draft => ({
  link: "",
  nome: "",
  imagem: "",
  dataPesquisa: new Date().toISOString().slice(0, 10),
  precoVenda: 0,
  vendasMes: 0,
  custoUnit: 0,
  fornecedor: "",
  qtdCaixa: 0,
  imposto: IMPOSTO_PADRAO,
  comissao: COMISSAO_PADRAO,
  aprovacao: "auto",
  observacao: "",
});

const aprovToOverride = (a: Aprov): boolean | null => (a === "auto" ? null : a === "sim");

export function Pesquisa() {
  const pesquisas = useStore((s) => s.pesquisas);
  const addPesquisa = useStore((s) => s.addPesquisa);
  const removePesquisa = useStore((s) => s.removePesquisa);

  const [showForm, setShowForm] = useState(false);
  const [d, setD] = useState<Draft>(emptyDraft);
  const [busca, setBusca] = useState("");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const fileRef = useRef<HTMLInputElement>(null);
  const onImage = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => set("imagem", r.result as string);
    r.readAsDataURL(file);
  };

  // live preview metrics for the form
  const previa = useMemo(
    () =>
      calcularMetricas({
        id: "preview",
        nome: d.nome,
        precoVenda: d.precoVenda,
        vendasMes: d.vendasMes,
        custoUnit: d.custoUnit,
        qtdCaixa: d.qtdCaixa,
        imposto: d.imposto,
        comissao: d.comissao,
        aprovadoManual: aprovToOverride(d.aprovacao),
      }),
    [d],
  );

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pesquisas
      .map((p) => ({ p, m: calcularMetricas(p) }))
      .filter(({ p }) =>
        !q ? true : [p.nome, p.fornecedor, p.link].filter(Boolean).some((s) => (s as string).toLowerCase().includes(q)),
      );
  }, [pesquisas, busca]);

  const valido = d.nome.trim() !== "" && d.precoVenda > 0;
  const salvar = () => {
    if (!valido) return;
    const nova: PesquisaT = {
      id: crypto.randomUUID(),
      link: d.link || undefined,
      nome: d.nome.trim(),
      imagem: d.imagem || undefined,
      dataPesquisa: d.dataPesquisa || undefined,
      precoVenda: d.precoVenda,
      vendasMes: d.vendasMes,
      custoUnit: d.custoUnit,
      fornecedor: d.fornecedor || undefined,
      qtdCaixa: d.qtdCaixa,
      imposto: d.imposto,
      comissao: d.comissao,
      aprovadoManual: aprovToOverride(d.aprovacao),
      observacao: d.observacao || undefined,
    };
    addPesquisa(nova);
    toast.success("Pesquisa salva");
    setD(emptyDraft());
    setShowForm(false);
  };

  const excluirPesquisa = async (p: PesquisaT) => {
    const ok = await confirmAction({
      title: "Excluir pesquisa?",
      message: `"${p.nome}" será removida do registro de pesquisas.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removePesquisa(p.id);
    toast.success("Pesquisa excluída");
  };

  return (
    <Screen
      eyebrow="Sourcing"
      title="Pesquisa de Produtos"
      subtitle="Registro das pesquisas de produtos (TabPesquisa) — com cálculo de taxas e veredito automático."
      actions={
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fechar" : "Adicionar pesquisa"}
        </button>
      }
    >
      {showForm && (
        <GlowCard accent="green" className="mb-4">
          <span className="mb-4 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Nova pesquisa</span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2 lg:col-span-4">
              <Field label="Link do anúncio referência">
                <TextInput value={d.link} onChange={(e) => set("link", e.target.value)} placeholder="https://..." />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Imagem do produto">
                <div className="flex items-center gap-3">
                  {d.imagem ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-chip border border-line">
                      <img src={d.imagem} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => set("imagem", "")}
                        className="absolute right-1 top-1 rounded-full bg-bg/80 p-0.5 text-txtDim hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-chip border border-dashed border-line text-txtFaint transition-colors hover:border-green hover:text-green"
                    >
                      <ImagePlus size={18} />
                      <span className="font-mono text-[10px]">Adicionar</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
                </div>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Nome do produto">
                <TextInput value={d.nome} onChange={(e) => set("nome", e.target.value)} />
              </Field>
            </div>
            <Field label="Data pesquisa">
              <input
                type="date"
                value={d.dataPesquisa}
                onChange={(e) => set("dataPesquisa", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Fornecedor">
              <TextInput value={d.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
            </Field>
            <Field label="Valor venda">
              <NumberInput value={d.precoVenda} onValue={(v) => set("precoVenda", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Custo fornecedor">
              <NumberInput value={d.custoUnit} onValue={(v) => set("custoUnit", v ?? 0)} unit="R$" />
            </Field>
            <Field label="Vendas / mês">
              <NumberInput value={d.vendasMes} onValue={(v) => set("vendasMes", v ?? 0)} />
            </Field>
            <Field label="Qtd. por caixa">
              <NumberInput value={d.qtdCaixa} onValue={(v) => set("qtdCaixa", v ?? 0)} />
            </Field>
            <Field label="Imposto" hint="Padrão 4%">
              <NumberInput value={Math.round(d.imposto * 1000) / 10} onValue={(v) => set("imposto", (v ?? 0) / 100)} unit="%" />
            </Field>
            <Field label="Comissão categoria" hint="11–15%">
              <NumberInput value={Math.round(d.comissao * 1000) / 10} onValue={(v) => set("comissao", (v ?? 0) / 100)} unit="%" />
            </Field>
            <Field label="Veredito">
              <select value={d.aprovacao} onChange={(e) => set("aprovacao", e.target.value as Aprov)} className={inputClass}>
                <option value="auto">Automático (margem ≥ 15%)</option>
                <option value="sim">Aprovado (manual)</option>
                <option value="nao">Reprovado (manual)</option>
              </select>
            </Field>
            <div className="col-span-2 lg:col-span-4">
              <Field label="Observação">
                <TextInput value={d.observacao} onChange={(e) => set("observacao", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* live preview */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-chip border border-line bg-bgRaise/40 px-4 py-3 font-mono text-sm tabular-nums">
            <span className="text-txtDim">
              Total taxas + comissão: <span className="text-txt">{money(previa.totalTaxasComissao)}</span>
            </span>
            <span className="text-txtDim">
              Margem: <span style={{ color: previa.aprovado ? "#34e3a0" : "#ff5f6b" }}>{percent(previa.margem)}</span>
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] ${previa.aprovado ? "border-green/40 bg-greenSoft text-green" : "border-danger/40 bg-danger/10 text-danger"}`}>
              {previa.aprovado ? "Aprovado" : "Reprovado"}
            </span>
          </div>

          <button
            onClick={salvar}
            disabled={!valido}
            className="mt-5 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} /> Salvar pesquisa
          </button>
        </GlowCard>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
          <Search size={15} className="text-txtFaint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, fornecedor, link…"
            className="w-72 bg-transparent font-mono text-sm text-txt outline-none placeholder:text-txtFaint"
          />
        </div>
        <span className="ml-auto font-mono text-xs text-txtFaint">{linhas.length} pesquisas</span>
      </div>

      <GlowCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {["Img", "Link", "Produto", "Data", "Valor venda", "Vendas/mês", "Custo forn.", "Fornecedor", "Qtd caixa", "Imposto", "Comissão", "Taxas + comissão", "Veredito", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-sm text-txtDim">
                    Nenhuma pesquisa registrada.
                  </td>
                </tr>
              ) : (
                linhas.map(({ p, m }) => (
                  <tr key={p.id} className="border-b border-line/60 transition-colors hover:bg-greenSoft/20">
                    <td className="px-4 py-3">
                      {p.imagem ? (
                        <img src={p.imagem} alt="" className="h-9 w-9 rounded-chip border border-line object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-chip border border-line bg-bgRaise/40 text-txtFaint">
                          <ImageIcon size={14} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.link ? (
                        <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex text-txtDim transition-colors hover:text-green" title="Abrir anúncio">
                          <ExternalLink size={15} />
                        </a>
                      ) : (
                        <span className="text-txtFaint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-txt">{p.nome}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-txtDim">{date(p.dataPesquisa)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-txt">{money(p.precoVenda)}</td>
                    <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{p.vendasMes}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{money(p.custoUnit)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-txtDim">{p.fornecedor ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{p.qtdCaixa}</td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-txtDim">{percent(p.imposto)}</td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-txtDim">{percent(p.comissao)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{money(m.totalTaxasComissao)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${m.aprovado ? "border-green/40 bg-greenSoft text-green" : "border-danger/40 bg-danger/10 text-danger"}`}>
                        {m.aprovado ? "Aprovado" : "Reprovado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => excluirPesquisa(p)} className="text-txtDim transition-colors hover:text-danger" title="Excluir pesquisa">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlowCard>
    </Screen>
  );
}
