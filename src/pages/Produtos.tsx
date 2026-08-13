import { ExternalLink, PackageOpen, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { calcularMetricas, coberturaEstoque, estoqueProdutos, gruposDuplicados, JANELA_COBERTURA } from "../calc/engine";
import type { StatusCor } from "../calc/constants";
import { DuplicateBanner } from "../components/DuplicateBanner";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, number, percent } from "../i18n/format";
import { useStore } from "../store/useStore";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useConfig } from "../store/useConfig";
import { useStatusCores } from "../theme/useCores";

type Filtro = "todos" | StatusCor;

/**
 * Column budget for the catalog table. `Screen` caps content at ~1074px, so this is a FIXED
 * budget — a breakpoint cannot buy width that never arrives. Fornecedor and Lucro/caixa were
 * dropped for that reason: the first is still searchable, the second lives in the product's own
 * form. `cls` stages what remains as the window narrows.
 */
const COLUNAS: { k: string; label: string; cls?: string }[] = [
  { k: "dot", label: "" },
  { k: "codigo", label: "Código" },
  { k: "produto", label: "Produto" },
  { k: "custo", label: "Custo/un" },
  { k: "preco", label: "Preço" },
  { k: "margem", label: "Margem" },
  { k: "lucroUn", label: "Lucro/un", cls: "hidden xl:table-cell" },
  { k: "lucroMes", label: "Lucro/mês", cls: "hidden xl:table-cell" },
  { k: "estoque", label: "Estoque" },
  { k: "link", label: "Link", cls: "hidden xl:table-cell" },
  { k: "acoes", label: "Ações" },
];

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "verde", label: "Ótimo" },
  { key: "amarelo", label: "Pode melhorar" },
  { key: "vermelho", label: "Re-avaliar" },
];

export function Produtos() {
  const statusCores = useStatusCores();
  const compras = useStore((s) => s.compras);
  const vendasLedger = useStore((s) => s.vendas);
  const devolucoes = useStore((s) => s.devolucoes);
  const cfg = useConfig();
  const produtos = useStore((s) => s.produtos);
  const removeProduto = useStore((s) => s.removeProduto);
  const nav = useNavigate();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const filtrosAtivos = busca.trim() !== "" || filtro !== "todos";

  // stock is derived from the ledgers, never stored (idea #3)
  const estoque = useMemo(
    () => estoqueProdutos(produtos, compras, vendasLedger, devolucoes),
    [produtos, compras, vendasLedger, devolucoes],
  );
  // how long that stock lasts at the recent sales rate, and whether it is already time to order
  const cobertura = useMemo(
    () => coberturaEstoque(produtos, compras, vendasLedger, devolucoes),
    [produtos, compras, vendasLedger, devolucoes],
  );

  // duplicate cleanup (idea #10) — catches dupes from the calculator, manual adds, anywhere
  const dupGrupos = useMemo(() => gruposDuplicados(produtos), [produtos]);
  const limparDuplicados = async () => {
    const aRemover = dupGrupos.reduce((s, g) => s + (g.length - 1), 0);
    const ok = await confirmAction({
      title: "Remover duplicados?",
      message: `Manter apenas o produto mais recente de cada nome repetido. ${aRemover} ${aRemover > 1 ? "itens serão removidos" : "item será removido"}.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    dupGrupos.forEach((g) => g.slice(0, -1).forEach((p) => removeProduto(p.id)));
    toast.success("Duplicados removidos");
  };

  const excluirProduto = async (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    const ok = await confirmAction({
      title: "Excluir produto?",
      message: `"${nome}" será removido da sua base.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeProduto(id);
    toast.success("Produto excluído");
  };

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .map((p) => ({ p, m: calcularMetricas(p, cfg) }))
      .filter(({ p, m }) => {
        if (filtro !== "todos" && m.statusCor !== filtro) return false;
        if (!q) return true;
        return (
          p.nome.toLowerCase().includes(q) ||
          (p.codigoProduto ?? "").toLowerCase().includes(q) ||
          (p.fornecedor ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.m.margem - a.m.margem);
  }, [produtos, busca, filtro]);

  return (
    <Screen
      eyebrow="Banco de Dados"
      title="Produtos"
      actions={
        <button
          onClick={() => nav("/produtos/novo")}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Adicionar produto
        </button>
      }
    >
      <DuplicateBanner grupos={dupGrupos} onLimpar={limparDuplicados} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
          <Search size={15} className="text-txtFaint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, código, fornecedor…"
            className="w-64 bg-transparent font-mono text-sm text-txt outline-none placeholder:text-txtFaint"
          />
        </div>
        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`rounded-chip border px-3 py-2 font-mono text-xs transition-colors ${
                filtro === f.key
                  ? "border-lineStrong bg-greenSoft text-txt"
                  : "border-line text-txtDim hover:text-txt"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs text-txtFaint">{linhas.length} itens</span>
      </div>

      <GlowCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {/* 13 columns do not fit the ~1074px content box, so the secondary ones drop out
                    below xl — the same staging Vendas and Compras use. Everything hidden is still
                    searchable and present in the product's own form. */}
                {COLUNAS.map((c) => (
                  <th
                    key={c.k}
                    className={`px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint xl:px-4 ${c.cls ?? ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      {filtrosAtivos ? (
                        <>
                          <SearchX size={28} className="text-txtFaint" />
                          <p className="text-sm text-txtDim">Nenhum produto corresponde aos filtros.</p>
                          <button
                            onClick={() => {
                              setBusca("");
                              setFiltro("todos");
                            }}
                            className="rounded-chip border border-line px-3 py-1.5 font-mono text-xs text-txtDim transition-colors hover:text-txt"
                          >
                            Limpar filtros
                          </button>
                        </>
                      ) : (
                        <>
                          <PackageOpen size={28} className="text-txtFaint" />
                          <p className="text-sm text-txtDim">Nenhum produto cadastrado ainda.</p>
                          <button
                            onClick={() => nav("/produtos/novo")}
                            className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-3 py-1.5 font-mono text-xs text-txt transition-opacity hover:opacity-90"
                          >
                            <Plus size={14} /> Adicionar o primeiro produto
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {linhas.map(({ p, m }) => (
                <tr
                  key={p.id}
                  onClick={() => nav(`/produtos/${p.id}`)}
                  className="cursor-pointer border-b border-line/60 transition-colors hover:bg-greenSoft/30"
                >
                  <td className="px-4 py-3">
                    <StatusDot cor={m.statusCor} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-txtDim">{p.codigoProduto ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-txt">{p.nome}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{money(p.custoUnit)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txt">{money(p.precoVenda)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums" style={{ color: statusCores[m.statusCor] }}>
                    {percent(m.margem)}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-sm tabular-nums text-txtDim xl:table-cell xl:px-4">{money(m.lucroUnit)}</td>
                  <td className="hidden px-3 py-3 font-mono text-sm tabular-nums text-green xl:table-cell xl:px-4">{money(m.lucroMensal)}</td>
                  {/* stock is derived — the tooltip shows the movements behind the number */}
                  <td
                    className="px-4 py-3"
                    title={(() => {
                      const e = estoque.get(p.id);
                      return e
                        ? `inicial ${e.inicial} + compras ${e.comprado} − vendas ${e.vendido} + devoluções ${e.devolvido}`
                        : "";
                    })()}
                  >
                    {(() => {
                      const e = estoque.get(p.id);
                      if (!e) return <span className="text-txtFaint">—</span>;
                      const c = cobertura.get(p.id);
                      return (
                        <div className="font-mono text-sm leading-tight tabular-nums">
                          <span className={e.atual < 0 ? "text-danger" : "text-txt"}>{number(e.atual)} un</span>
                          {p.qtdCaixa > 0 && (
                            <span className="block text-[11px] text-txtFaint">{number(e.atual / p.qtdCaixa)} cx</span>
                          )}
                          {/* how long it lasts — the question stock levels are actually asked to answer */}
                          {c && (
                            <span
                              className={`block text-[11px] ${
                                c.pedirAgora ? "text-danger" : c.diasRestantes === null ? "text-txtFaint" : "text-txtDim"
                              }`}
                              title={
                                c.diasRestantes === null
                                  ? "Sem vendas na janela recente, então não há ritmo para estimar."
                                  : `${number(c.vendidas)} un vendidas nos últimos ${JANELA_COBERTURA} dias · ${number(c.vendaDiaria)} un/dia` +
                                    (c.diasParaPedir !== null
                                      ? ` · repor leva ${p.prazoReposicaoDias} dias, então pedir em ${Math.max(0, Math.round(c.diasParaPedir))}`
                                      : "")
                              }
                            >
                              {c.diasRestantes === null
                                ? "sem giro"
                                : c.pedirAgora
                                  ? `${Math.round(c.diasRestantes)} d · repor já`
                                  : `${Math.round(c.diasRestantes)} d de estoque`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="hidden px-3 py-3 xl:table-cell xl:px-4">
                    {p.link ? (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex text-txtDim transition-colors hover:text-green"
                        title="Abrir anúncio de referência"
                      >
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <span className="text-txtFaint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nav(`/produtos/${p.id}`);
                        }}
                        className="text-txtDim transition-colors hover:text-green"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => excluirProduto(e, p.id, p.nome)}
                        className="text-txtDim transition-colors hover:text-danger"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>
    </Screen>
  );
}

