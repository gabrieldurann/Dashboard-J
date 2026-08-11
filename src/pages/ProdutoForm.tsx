import { ArrowLeft, ImagePlus, Save, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Configuracoes } from "../calc/constants";
import { calcularMetricas } from "../calc/engine";
import type { Produto } from "../calc/types";
import { Field, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, percent } from "../i18n/format";

import { useStore } from "../store/useStore";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useConfig } from "../store/useConfig";
import { useStatusCores } from "../theme/useCores";

const novoProduto = (cfg: Configuracoes): Produto => ({
  id: crypto.randomUUID(),
  nome: "",
  precoVenda: 0,
  vendasMes: 0,
  custoUnit: 0,
  qtdCaixa: 0,
  imposto: cfg.imposto,
  comissao: cfg.comissao,
  aprovadoManual: null,
});

export function ProdutoForm() {
  const statusCores = useStatusCores();
  const cfg = useConfig();
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const produtos = useStore((s) => s.produtos);
  const addProduto = useStore((s) => s.addProduto);
  const updateProduto = useStore((s) => s.updateProduto);
  const removeProduto = useStore((s) => s.removeProduto);

  const existente = id ? produtos.find((p) => p.id === id) : undefined;
  const isEdit = !!existente;
  // A new product can arrive pre-filled from the Amazon page, where an imported SKU the catalog
  // doesn't know is exactly the thing that needs registering. Everything else stays blank —
  // the cost, which is the whole point, is the one figure no marketplace can hand us.
  const [draft, setDraft] = useState<Produto>(() => {
    if (existente) return existente;
    const nome = params.get("nome");
    const sku = params.get("sku");
    const novo = novoProduto(cfg);
    return nome || sku
      ? { ...novo, nome: nome ?? "", codigoProduto: sku ?? undefined }
      : novo;
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const m = useMemo(() => calcularMetricas(draft, cfg), [draft, cfg]);
  const set = <K extends keyof Produto>(k: K, v: Produto[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onImage = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => set("imagem", r.result as string);
    r.readAsDataURL(file);
  };

  const salvar = () => {
    if (!draft.nome.trim()) return;
    if (isEdit) updateProduto(draft.id, draft);
    else addProduto(draft);
    toast.success(isEdit ? "Produto atualizado" : "Produto adicionado");
    nav("/produtos");
  };

  const excluir = async () => {
    const ok = await confirmAction({
      title: "Excluir produto?",
      message: `"${draft.nome || "Sem nome"}" será removido da sua base. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeProduto(draft.id);
    toast.success("Produto excluído");
    nav("/produtos");
  };

  return (
    <Screen
      eyebrow={isEdit ? "Editar" : "Novo"}
      title={isEdit ? "Editar produto" : "Adicionar produto"}
      actions={
        <button
          onClick={() => nav("/produtos")}
          className="flex items-center gap-2 rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt"
        >
          <ArrowLeft size={15} /> Voltar
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-4">
        {/* form */}
        <div className="col-span-12 lg:col-span-7">
          <GlowCard>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Nome do produto">
                  <TextInput
                    value={draft.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    placeholder="Ex.: Cozedor de Ovos Elétrico"
                  />
                </Field>
              </div>
              <Field label="Código do produto">
                <TextInput
                  value={draft.codigoProduto ?? ""}
                  onChange={(e) => set("codigoProduto", e.target.value || undefined)}
                  placeholder="COZ-OVO-7"
                />
              </Field>
              <Field label="Fornecedor">
                <TextInput
                  value={draft.fornecedor ?? ""}
                  onChange={(e) => set("fornecedor", e.target.value || undefined)}
                />
              </Field>
              <Field label="ASIN" hint="Identificador Amazon (p/ venda/vínculo)">
                <TextInput
                  value={draft.asin ?? ""}
                  onChange={(e) => set("asin", e.target.value.trim().toUpperCase() || undefined)}
                  placeholder="B0C7LT71K9"
                />
              </Field>
              <Field label="EAN / código de barras" hint="GTIN — p/ listar por 'match' na Amazon">
                <TextInput
                  value={draft.ean ?? ""}
                  onChange={(e) => set("ean", e.target.value.replace(/\D/g, "") || undefined)}
                  placeholder="7891234567895"
                />
              </Field>
              <div className="col-span-2">
                <Field label="Link do anúncio de referência" hint="Clique para abrir depois — não perca o achado.">
                  <TextInput
                    value={draft.link ?? ""}
                    onChange={(e) => set("link", e.target.value || undefined)}
                    placeholder="https://..."
                  />
                </Field>
              </div>

              <Field label="Preço de venda">
                <NumberInput value={draft.precoVenda} onValue={(v) => set("precoVenda", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Custo fornecedor (un)">
                <NumberInput value={draft.custoUnit} onValue={(v) => set("custoUnit", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Vendas / mês">
                <NumberInput value={draft.vendasMes} onValue={(v) => set("vendasMes", v ?? 0)} />
              </Field>
              <Field label="Qtd. por caixa">
                <NumberInput value={draft.qtdCaixa} onValue={(v) => set("qtdCaixa", v ?? 0)} />
              </Field>

              <Field label="Imposto" hint="Padrão 4% (planilha)">
                <NumberInput
                  value={Math.round((draft.imposto ?? 0) * 1000) / 10}
                  onValue={(v) => set("imposto", (v ?? 0) / 100)}
                  unit="%"
                  mostrarZero
                />
              </Field>
              <Field label="Comissão categoria" hint="11–15%">
                <NumberInput
                  value={Math.round((draft.comissao ?? 0) * 1000) / 10}
                  onValue={(v) => set("comissao", (v ?? 0) / 100)}
                  unit="%"
                  mostrarZero
                />
              </Field>
              <Field label="Custo embalagem/branding (un)" hint="Opcional">
                <NumberInput
                  value={draft.custoEmbalagem}
                  onValue={(v) => set("custoEmbalagem", v)}
                  unit="R$"
                  allowEmpty
                />
              </Field>
              <Field label="Estoque inicial" hint="saldo de partida — o atual é calculado com compras, vendas e devoluções">
                <NumberInput value={draft.estoqueInicial} onValue={(v) => set("estoqueInicial", v)} allowEmpty />
              </Field>
              <Field label="Data da pesquisa">
                <input
                  type="date"
                  value={draft.dataPesquisa ?? ""}
                  onChange={(e) => set("dataPesquisa", e.target.value || undefined)}
                  className="w-full rounded-chip border border-line bg-bgRaise/60 px-3 py-2 font-mono text-sm text-txt outline-none focus:border-green"
                />
              </Field>
              <Field label="Aprovação">
                <select
                  value={draft.aprovadoManual === null || draft.aprovadoManual === undefined ? "auto" : draft.aprovadoManual ? "sim" : "nao"}
                  onChange={(e) =>
                    set("aprovadoManual", e.target.value === "auto" ? null : e.target.value === "sim")
                  }
                  className="w-full rounded-chip border border-line bg-bgRaise/60 px-3 py-2 font-mono text-sm text-txt outline-none focus:border-green"
                >
                  <option value="auto">Automático (≥15%)</option>
                  <option value="sim">Aprovado (manual)</option>
                  <option value="nao">Reprovado (manual)</option>
                </select>
              </Field>

              {/* image */}
              <div className="col-span-2">
                <Field label="Imagem do produto">
                  <div className="flex items-center gap-3">
                    {draft.imagem ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-chip border border-line">
                        <img src={draft.imagem} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => set("imagem", undefined)}
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
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onImage(e.target.files?.[0])}
                    />
                  </div>
                </Field>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={salvar}
                disabled={!draft.nome.trim()}
                className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save size={15} /> {isEdit ? "Salvar alterações" : "Adicionar produto"}
              </button>
              {isEdit && (
                <button
                  onClick={excluir}
                  className="flex items-center gap-2 rounded-chip border border-line px-4 py-2.5 font-mono text-sm text-danger transition-colors hover:border-danger"
                >
                  <Trash2 size={15} /> Excluir
                </button>
              )}
            </div>
          </GlowCard>
        </div>

        {/* live metrics */}
        <div className="col-span-12 lg:col-span-5">
          <GlowCard accent="green" grid className="lg:sticky lg:top-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Resultado</span>
              <span className="flex items-center gap-2">
                <StatusDot cor={m.statusCor} label />
              </span>
            </div>

            <div className="mb-5 flex items-end justify-between border-b border-line pb-4">
              <div>
                <div className="eyebrow mb-1">Margem</div>
                <span className="font-mono text-4xl font-semibold tabular-nums" style={{ color: statusCores[m.statusCor] }}>
                  {percent(m.margem)}
                </span>
              </div>
              <div className="text-right">
                <div className="eyebrow mb-1">Lucro / un</div>
                <span className="font-mono text-2xl tabular-nums text-txt">{money(m.lucroUnit)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Row label="Valor líquido (pós-taxas)" value={money(m.valorLiquido)} />
              <Row label="Frete (un)" value={m.freteUnit === 0 ? "Grátis" : money(m.freteUnit)} />
              <Row label="Lucro / mês" value={money(m.lucroMensal)} accent />
              <Row label="Lucro / caixa" value={money(m.lucroCaixa)} accent />
              <Row label="Capital p/ estoque" value={money(m.capitalEstoque)} />
              <Row label="Payback" value={m.paybackMeses ? `${m.paybackMeses.toFixed(1)} meses` : "—"} />
              <Row label="Aprovado" value={m.aprovado ? "Sim" : "Não"} accent={m.aprovado} />
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <div className="eyebrow mb-2">Cenário sem frete (acima de R$79)</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Row label="Margem s/ frete" value={percent(m.margemSemFrete)} />
                <Row label="Lucro/un s/ frete" value={money(m.lucroUnitSemFrete)} />
              </div>
            </div>
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
