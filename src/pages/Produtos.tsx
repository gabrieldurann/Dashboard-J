import { ExternalLink, PackageOpen, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { calcularMetricas, estoqueProdutos, gruposDuplicados } from "../calc/engine";
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
                {["", "Código", "Produto", "Fornecedor", "Custo/un", "Preço", "Margem", "Lucro/un", "Lucro/caixa", "Lucro/mês", "Estoque", "Link", "Ações"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-16">
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
                  <td className="px-4 py-3 text-sm text-txtDim">{p.fornecedor ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{money(p.custoUnit)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txt">{money(p.precoVenda)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums" style={{ color: statusCores[m.statusCor] }}>
                    {percent(m.margem)}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{money(m.lucroUnit)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{money(m.lucroCaixa)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-green">{money(m.lucroMensal)}</td>
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
                      return (
                        <div className="font-mono text-sm leading-tight tabular-nums">
                          <span className={e.atual < 0 ? "text-danger" : "text-txt"}>{number(e.atual)} un</span>
                          {p.qtdCaixa > 0 && (
                            <span className="block text-[11px] text-txtFaint">{number(e.atual / p.qtdCaixa)} cx</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
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

