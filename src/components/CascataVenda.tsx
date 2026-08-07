import { Banknote, Boxes, Package2, Percent, Receipt, ShoppingCart, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DetalheVenda } from "../calc/engine";
import { money, percent } from "../i18n/format";
import { useStatusCores } from "../theme/useCores";

/** One icon per waterfall row. Phase 11 adds `fba` / `freteRecebido` here. */
const ICONE: Record<string, LucideIcon> = {
  itens: ShoppingCart,
  imposto: Receipt,
  comissao: Percent,
  custo: Boxes,
  embalagem: Package2,
  frete: Truck,
};

/**
 * The per-order profit waterfall (Phase 10a, adapted from Gestor Seller's order detail):
 * what came in on top, every deduction below it, and the order's profit under the rule.
 *
 * All figures come from `detalharVenda`, which is what `resultadoVendas` sums — so an expanded
 * order always reconciles with the Painel and Gráficos totals.
 */
export function CascataVenda({ detalhe }: { detalhe: DetalheVenda }) {
  const statusCores = useStatusCores();

  if (!detalhe.atribuido) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 rounded-card border border-dashed border-line px-4 py-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">Sem custos atribuídos</span>
        <p className="text-sm leading-relaxed text-txtDim">
          Esta venda é <strong className="text-gold">avulsa</strong> — não está ligada a um produto do catálogo, então não
          há custo, imposto nem comissão para calcular. Entra apenas no faturamento bruto ({money(detalhe.bruto)}).
        </p>
        <p className="text-xs text-txtFaint">
          Ligue a venda a um produto para ver o lucro do pedido.
        </p>
      </div>
    );
  }

  const corMargem = statusCores[detalhe.statusCor];

  return (
    <div className="flex flex-col gap-1">
      {detalhe.linhas.map((l) => {
        const Icon = ICONE[l.chave] ?? Banknote;
        const entrada = l.tipo === "entrada";
        return (
          <div key={l.chave} className="flex items-center gap-3 py-1.5">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-chip ${
                entrada ? "bg-greenSoft text-green" : "bg-danger/12 text-danger"
              }`}
            >
              <Icon size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-txt">
              {l.label}
              {l.nota && <span className="ml-2 font-mono text-[11px] text-txtFaint">{l.nota}</span>}
            </span>
            <span
              className={`shrink-0 font-mono text-sm tabular-nums ${entrada ? "text-green" : "text-danger"}`}
            >
              {entrada ? "+" : "−"}
              {money(l.valor)}
            </span>
          </div>
        );
      })}

      <div className="mt-2 border-t border-line pt-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-greenSoft text-green">
            <Banknote size={14} />
          </span>
          <span className="min-w-0 flex-1 text-sm text-txt">Lucro do pedido</span>
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums"
            style={{ color: corMargem, borderColor: `${corMargem}66` }}
            title="Margem do pedido — lucro ÷ total dos itens"
          >
            {percent(detalhe.margem)}
          </span>
          <span
            className="shrink-0 font-mono text-base tabular-nums"
            style={{ color: detalhe.lucro >= 0 ? corMargem : undefined }}
          >
            {money(detalhe.lucro)}
          </span>
        </div>
        {!detalhe.contabilizado && (
          <p className="mt-2.5 rounded-chip bg-neutroSoft px-3 py-2 text-xs leading-relaxed text-txtDim">
            Pedido <strong>cancelado</strong> — os valores acima são apenas o cálculo do que teria sido. Ele não entra em
            nenhum total do app.
          </p>
        )}
      </div>
    </div>
  );
}
