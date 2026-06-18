import { ExternalLink, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { calcularMetricas } from "../calc/engine";
import type { StatusCor } from "../calc/constants";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, percent } from "../i18n/format";
import { useStore } from "../store/useStore";

type Filtro = "todos" | StatusCor;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "verde", label: "Ótimo" },
  { key: "amarelo", label: "Pode melhorar" },
  { key: "vermelho", label: "Re-avaliar" },
];

export function Produtos() {
  const produtos = useStore((s) => s.produtos);
  const nav = useNavigate();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .map((p) => ({ p, m: calcularMetricas(p) }))
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
      subtitle="Todos os produtos pesquisados — preço, custo, margem, estoque e link da referência."
      actions={
        <button
          onClick={() => nav("/produtos/novo")}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Adicionar produto
        </button>
      }
    >
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
                {["", "Código", "Produto", "Fornecedor", "Custo/un", "Preço", "Margem", "Lucro/mês", "Estoque", "Link"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
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
                  <td className="px-4 py-3 font-mono text-sm tabular-nums" style={{ color: marginColor(m.statusCor) }}>
                    {percent(m.margem)}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-green">{money(m.lucroMensal)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums text-txtDim">{p.estoqueAtual ?? "—"}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>
    </Screen>
  );
}

function marginColor(cor: StatusCor) {
  return cor === "vermelho" ? "#ff5f6b" : cor === "amarelo" ? "#f5a623" : "#34e3a0";
}
