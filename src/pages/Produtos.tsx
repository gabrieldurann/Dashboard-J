import { ChevronDown, ExternalLink, Info, PackageOpen, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { calcularMetricas, coberturaEstoque, estoqueProdutos, gruposDuplicados, JANELA_COBERTURA } from "../calc/engine";
import type { CoberturaEstoque, EstoqueProduto } from "../calc/engine";
import type { StatusCor } from "../calc/constants";
import type { MetricasProduto, Produto } from "../calc/types";
import { DuplicateBanner } from "../components/DuplicateBanner";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { date, money, number, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { useStore } from "../store/useStore";
import { useEscopo } from "../store/useEscopo";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useConfig } from "../store/useConfig";
import { useStatusCores } from "../theme/useCores";

type Filtro = "todos" | StatusCor;

/**
 * Column budget for the catalog table. `Screen` caps content at ~1074px, so this is a FIXED
 * budget — a breakpoint cannot buy width that never arrives. The collapsed row is for *finding*
 * a product and judging its health; the per-box and per-month money lives in the expander, which
 * costs a click rather than a column. `cls` stages what remains as the window narrows.
 */
const COLUNAS: { k: string; label: string; cls?: string }[] = [
  { k: "chevron", label: "" },
  { k: "dot", label: "" },
  { k: "produto", label: "Produto" },
  { k: "fornecedor", label: "Fornecedor" },
  { k: "codigo", label: "Código", cls: "hidden xl:table-cell" },
  { k: "custo", label: "Custo/un" },
  { k: "preco", label: "Preço" },
  { k: "margem", label: "Margem" },
  { k: "lucroUn", label: "Lucro/un", cls: "hidden xl:table-cell" },
  { k: "estoque", label: "Estoque" },
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
  // scoped to the selected storefront — see useEscopo
  const escopo = useEscopo();
  const compras = escopo.compras;
  const vendasLedger = escopo.vendas;
  const devolucoes = escopo.devolucoes;
  const cfg = useConfig();
  const produtos = useStore((s) => s.produtos);
  const removeProduto = useStore((s) => s.removeProduto);
  const nav = useNavigate();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<string | null>(null); // expanded product (one at a time)
  /** Which stock cell has its box open, and where to hang it. */
  const [caixaEstoque, setCaixaEstoque] = useState<{ id: string; rect: DOMRect } | null>(null);
  const filtrosAtivos = busca.trim() !== "" || filtro !== "todos";

  // Stock is derived from the ledgers, never stored (idea #3). The product's opening balance is
  // company-wide, so it only counts under "Todas" — scoped to one storefront the shelf is exactly
  // what that storefront bought, sold and had returned.
  const estoque = useMemo(
    () => estoqueProdutos(produtos, compras, vendasLedger, devolucoes, escopo.todas),
    [produtos, compras, vendasLedger, devolucoes, escopo.todas],
  );
  // how long that stock lasts at the recent sales rate, and whether it is already time to order
  const cobertura = useMemo(
    () => coberturaEstoque(produtos, compras, vendasLedger, devolucoes, JANELA_COBERTURA, escopo.todas),
    [produtos, compras, vendasLedger, devolucoes, escopo.todas],
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
  }, [produtos, busca, filtro, cfg]);

  const produtoDaCaixa = caixaEstoque ? produtos.find((p) => p.id === caixaEstoque.id) : undefined;

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
                {/* the secondary columns drop out below xl — the same staging Vendas and Compras
                    use. Everything hidden is still searchable and present in the expander. */}
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
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-4 py-16">
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
              {linhas.map(({ p, m }) => {
                const expandido = aberto === p.id;
                const e = estoque.get(p.id);
                const c = cobertura.get(p.id);
                return (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setAberto(expandido ? null : p.id)}
                      className={`cursor-pointer border-b border-line/60 transition-colors hover:bg-greenSoft/20 ${expandido ? "bg-greenSoft/20" : ""}`}
                    >
                      <td className="px-2 py-3">
                        <motion.span
                          animate={{ rotate: expandido ? 180 : 0 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="flex text-txtFaint"
                        >
                          <ChevronDown size={16} />
                        </motion.span>
                      </td>
                      <td className="px-2 py-3">
                        <StatusDot cor={m.statusCor} />
                      </td>
                      <td className="max-w-[150px] truncate px-2 py-3 text-sm text-txt xl:max-w-[200px] xl:px-3" title={p.nome}>
                        {p.nome}
                      </td>
                      <td
                        className="max-w-[110px] truncate px-2 py-3 text-sm text-txtDim xl:max-w-[130px] xl:px-3"
                        title={p.fornecedor}
                      >
                        {p.fornecedor ?? "—"}
                      </td>
                      <td className="hidden px-2 py-3 font-mono text-xs text-txtDim xl:table-cell xl:px-3">
                        {p.codigoProduto ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-txtDim xl:px-3">
                        {money(p.custoUnit)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-txt xl:px-3">
                        {money(p.precoVenda)}
                      </td>
                      <td
                        className="px-2 py-3 font-mono text-sm tabular-nums xl:px-3"
                        style={{ color: statusCores[m.statusCor] }}
                      >
                        {percent(m.margem)}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 font-mono text-sm tabular-nums text-txtDim xl:table-cell xl:px-3">
                        {money(m.lucroUnit)}
                      </td>
                      {/* stock is derived; the box behind it carries the cover and the arithmetic */}
                      <td className="px-2 py-3 xl:px-3" onClick={(ev) => ev.stopPropagation()}>
                        {!e ? (
                          <span className="text-txtFaint">—</span>
                        ) : (
                          <button
                            data-estoque
                            onClick={(ev) =>
                              setCaixaEstoque(
                                caixaEstoque?.id === p.id
                                  ? null
                                  : { id: p.id, rect: ev.currentTarget.getBoundingClientRect() },
                              )
                            }
                            title="Ver cobertura de estoque"
                            className="group flex items-center gap-1.5 rounded-chip px-1 py-0.5 text-left transition-colors hover:bg-bgRaise"
                          >
                            <span className="font-mono text-sm leading-tight tabular-nums">
                              <span className={e.atual < 0 ? "text-danger" : "text-txt"}>{number(e.atual)} un</span>
                              {p.qtdCaixa > 0 && (
                                <span className="block text-[11px] text-txtFaint">
                                  {number(e.atual / p.qtdCaixa)} cx
                                </span>
                              )}
                            </span>
                            <Info
                              size={15}
                              className={`shrink-0 transition-colors ${
                                c?.pedirAgora ? "text-danger" : "text-txtDim group-hover:text-txt"
                              }`}
                            />
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-3 xl:px-3" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => nav(`/produtos/${p.id}`)}
                            className="text-txtDim transition-colors hover:text-green"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={(ev) => excluirProduto(ev, p.id, p.nome)}
                            className="text-txtDim transition-colors hover:text-danger"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    <AnimatePresence initial={false}>
                      {expandido && (
                        <tr>
                          <td colSpan={COLUNAS.length} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.28, ease: EASE }}
                              className="overflow-hidden border-b border-line/60 bg-bgRaise/40"
                            >
                              <DetalheProduto produto={p} metricas={m} estoque={e} />
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlowCard>

      {caixaEstoque && produtoDaCaixa && (
        <CaixaEstoque
          produto={produtoDaCaixa}
          estoque={estoque.get(caixaEstoque.id)}
          cobertura={cobertura.get(caixaEstoque.id)}
          ancora={caixaEstoque.rect}
          onFechar={() => setCaixaEstoque(null)}
        />
      )}
    </Screen>
  );
}

/**
 * Stock cover for one product, hung off the cell that was clicked.
 *
 * Rendered into `document.body`: the table sits inside two clipping ancestors (`overflow-hidden`
 * on the card, `overflow-x-auto` on the scroller) and framer's transforms would re-anchor a
 * `fixed` child, so anything drawn in place would be cut off or land in the wrong spot.
 */
function CaixaEstoque({
  produto,
  estoque,
  cobertura,
  ancora,
  onFechar,
}: {
  produto: Produto;
  estoque?: EstoqueProduto;
  cobertura?: CoberturaEstoque;
  ancora: DOMRect;
  onFechar: () => void;
}) {
  useEffect(() => {
    const fechar = () => onFechar();
    const naTecla = (ev: KeyboardEvent) => ev.key === "Escape" && onFechar();
    /**
     * Clicks on a stock cell are left to the cell itself, which toggles. Closing here first would
     * make a second click on the same cell close and immediately reopen the box.
     */
    const foraDaCaixa = (ev: MouseEvent) => {
      if ((ev.target as HTMLElement | null)?.closest("[data-estoque]")) return;
      onFechar();
    };
    // the box is positioned from a rect taken at click time, so it has to go when things move
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    document.addEventListener("keydown", naTecla);
    document.addEventListener("mousedown", foraDaCaixa);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
      document.removeEventListener("keydown", naTecla);
      document.removeEventListener("mousedown", foraDaCaixa);
    };
  }, [onFechar]);

  const LARGURA = 300;
  // hang it under the cell, flipping above when the viewport runs out and pulling it back inside
  // horizontally so a right-hand column never pushes it off screen
  const acima = ancora.bottom + 210 > window.innerHeight && ancora.top > 220;
  const esquerda = Math.min(Math.max(12, ancora.left), window.innerWidth - LARGURA - 12);

  const dias = cobertura?.diasRestantes;

  return createPortal(
    <div
      role="dialog"
      aria-label={`Estoque de ${produto.nome}`}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: esquerda,
        top: acima ? undefined : ancora.bottom + 8,
        bottom: acima ? window.innerHeight - ancora.top + 8 : undefined,
        width: LARGURA,
        zIndex: 60,
      }}
      className="rounded-card border border-lineStrong bg-panel p-4 shadow-2xl backdrop-blur-md"
    >
      <p className="mb-3 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint" title={produto.nome}>
        {produto.nome}
      </p>

      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-txtDim">Unidades disponíveis</dt>
          <dd className={`font-mono text-lg tabular-nums ${(estoque?.atual ?? 0) < 0 ? "text-danger" : "text-txt"}`}>
            {number(estoque?.atual ?? 0)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-txtDim">Dias de estoque restantes</dt>
          <dd
            className={`font-mono text-lg tabular-nums ${
              dias == null ? "text-txtFaint" : cobertura?.pedirAgora ? "text-danger" : "text-txt"
            }`}
          >
            {dias == null ? "—" : Math.round(dias)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-txtDim">
        {dias == null
          ? `Sem vendas nos últimos ${JANELA_COBERTURA} dias, então não há ritmo para estimar a duração do estoque.`
          : `A estimativa é feita com base nas vendas deste produto nos últimos ${JANELA_COBERTURA} dias (${number(
              cobertura!.vendidas,
            )} un · ${number(cobertura!.vendaDiaria)} un/dia) e no estoque atual.`}
      </p>

      {cobertura?.diasParaPedir != null && (
        <p className={`mt-2 text-xs leading-relaxed ${cobertura.pedirAgora ? "text-danger" : "text-txtDim"}`}>
          {cobertura.pedirAgora
            ? `Repor agora: o estoque acaba antes dos ${produto.prazoReposicaoDias} dias que a reposição leva.`
            : `Repor em ${Math.round(cobertura.diasParaPedir)} dias — a reposição leva ${produto.prazoReposicaoDias} dias.`}
        </p>
      )}

    </div>,
    document.body,
  );
}

/** The expanded product: what it is on the left, what it earns on the right. */
function DetalheProduto({
  produto: p,
  metricas: m,
  estoque,
}: {
  produto: Produto;
  metricas: MetricasProduto;
  estoque?: EstoqueProduto;
}) {
  return (
    <div className="grid gap-6 px-4 py-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">Dados do produto</span>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <Dado termo="Código" valor={p.codigoProduto} />
          <Dado termo="Fornecedor" valor={p.fornecedor} />
          <Dado termo="ASIN" valor={p.asin} />
          <Dado termo="EAN" valor={p.ean} />
          <Dado termo="Qtd. por caixa" valor={p.qtdCaixa ? number(p.qtdCaixa) : undefined} />
          <Dado termo="Vendas/mês (cadastro)" valor={p.vendasMes ? number(p.vendasMes) : undefined} />
          <Dado
            termo="Prazo de reposição"
            valor={p.prazoReposicaoDias ? `${p.prazoReposicaoDias} dias` : undefined}
          />
          <Dado termo="Estoque inicial" valor={p.estoqueInicial != null ? number(p.estoqueInicial) : undefined} />
          <Dado termo="Data da pesquisa" valor={p.dataPesquisa ? date(p.dataPesquisa) : undefined} />
          <Dado termo="Estoque atual" valor={estoque ? `${number(estoque.atual)} un` : undefined} />
        </dl>
        {p.link && (
          <a
            href={p.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-chip border border-line px-3 py-1.5 font-mono text-xs text-txtDim transition-colors hover:text-green"
          >
            <ExternalLink size={13} /> Abrir anúncio de referência
          </a>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">Composição do lucro</span>
        <dl className="flex flex-col gap-1.5">
          {/* zero-valued deductions are dropped, the same rule the sale waterfall follows — a
              line reading −R$ 0,00 on every product is noise, not information */}
          <Linha termo="Preço de venda" valor={money(p.precoVenda)} />
          <Linha termo="Custo do fornecedor" valor={money(p.custoUnit)} tipo="saida" />
          {p.custoEmbalagem ? <Linha termo="Embalagem" valor={money(p.custoEmbalagem)} tipo="saida" /> : null}
          {p.imposto > 0 && (
            <Linha termo={`Imposto (${percent(p.imposto)})`} valor={money(p.precoVenda * p.imposto)} tipo="saida" />
          )}
          {p.comissao > 0 && (
            <Linha termo={`Comissão (${percent(p.comissao)})`} valor={money(p.precoVenda * p.comissao)} tipo="saida" />
          )}
          {m.freteUnit > 0 && <Linha termo="Frete / un" valor={money(m.freteUnit)} tipo="saida" />}
          <Linha termo="Valor líquido" valor={money(m.valorLiquido)} />
          <div className="my-1 border-t border-line" />
          <Linha termo="Lucro / un" valor={money(m.lucroUnit)} destaque />
          <Linha termo="Lucro / caixa" valor={money(m.lucroCaixa)} destaque />
          <Linha termo="Lucro / mês" valor={money(m.lucroMensal)} destaque />
          <div className="my-1 border-t border-line" />
          <Linha termo="Custo da caixa" valor={money(m.custoCaixa)} />
          <Linha termo="Capital em estoque" valor={money(m.capitalEstoque)} />
          <Linha
            termo="Payback"
            valor={m.paybackMeses == null ? "—" : `${number(m.paybackMeses)} meses`}
          />
        </dl>
      </div>
    </div>
  );
}

/** One term/value pair of the expanded product's metadata. Renders nothing without a value. */
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

/** One money line of the profit breakdown. */
function Linha({
  termo,
  valor,
  tipo,
  destaque = false,
}: {
  termo: ReactNode;
  valor: string;
  tipo?: "saida";
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-sm ${destaque ? "text-txt" : "text-txtDim"}`}>{termo}</dt>
      <dd
        className={`whitespace-nowrap font-mono text-sm tabular-nums ${
          tipo === "saida" ? "text-danger" : destaque ? "text-green" : "text-txt"
        }`}
      >
        {tipo === "saida" ? "−" : ""}
        {valor}
      </dd>
    </div>
  );
}
