import { Check, Columns2, Eye, LayoutGrid, Rows2 } from "lucide-react";
import { useState } from "react";
import type { CardRegistrado } from "./Ocultavel";
import { useStore } from "../store/useStore";

/** How a ledger page arranges its table and its summary block. */
export type LayoutLedger = "empilhado" | "dividido";

const LAYOUTS: { id: LayoutLedger; label: string; desc: string; Icone: typeof Rows2 }[] = [
  { id: "empilhado", label: "Empilhado", desc: "Tabela inteira, resumo abaixo", Icone: Rows2 },
  { id: "dividido", label: "Dividido", desc: "Resumo à esquerda da tabela", Icone: Columns2 },
];

/**
 * Visibility control for a dashboard: presets ("Só o essencial" / "Mostrar tudo") plus a
 * per-card checklist. Pairs with <Ocultavel>; the page owns the card list so labels and the
 * essential set live next to the markup they describe.
 */
export function ExibicaoMenu({
  cards,
  /** ledger pages pass their id to also offer the stacked/split layout choice */
  paginaLayout,
}: {
  cards: CardRegistrado[];
  paginaLayout?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ocultos = useStore((s) => s.cardsOcultos);
  const toggle = useStore((s) => s.toggleCardOculto);
  const ocultarCards = useStore((s) => s.ocultarCards);
  const mostrarCards = useStore((s) => s.mostrarCards);
  const layouts = useStore((s) => s.layouts);
  const setLayout = useStore((s) => s.setLayout);
  const layoutAtual = paginaLayout ? (layouts[paginaLayout] ?? "empilhado") : null;

  const ids = cards.map((c) => c.id);
  const qtdOcultos = ids.filter((id) => ocultos.includes(id)).length;
  const naoEssenciais = cards.filter((c) => !c.essencial).map((c) => c.id);

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-chip border border-line px-3 py-2.5 font-mono text-sm text-txtDim transition-colors hover:text-txt"
      >
        <LayoutGrid size={15} />
        Exibição
        {qtdOcultos > 0 && (
          <span className="rounded-full bg-goldSoft px-1.5 py-0.5 font-mono text-[10px] text-gold">
            {qtdOcultos} oculto{qtdOcultos > 1 ? "s" : ""}
          </span>
        )}
      </button>

      {aberto && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-[290px] rounded-card border border-lineStrong bg-bgRaise p-3 shadow-xl">
            {paginaLayout && (
              <div className="mb-3 border-b border-line pb-3">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">
                  Layout
                </span>
                <div className="flex gap-2">
                  {LAYOUTS.map(({ id, label, desc, Icone }) => {
                    const ativo = layoutAtual === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setLayout(paginaLayout, id)}
                        title={desc}
                        className={`flex flex-1 items-center gap-2 rounded-chip border px-2 py-1.5 font-mono text-[11px] transition-colors ${
                          ativo ? "border-lineStrong bg-greenSoft text-txt" : "border-line text-txtDim hover:text-txt"
                        }`}
                      >
                        <Icone size={13} className={ativo ? "text-green" : ""} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-3 flex gap-2">
              <button
                onClick={() => ocultarCards(naoEssenciais)}
                className="flex-1 rounded-chip border border-line px-2 py-1.5 font-mono text-[11px] text-txtDim transition-colors hover:text-txt"
              >
                Só o essencial
              </button>
              <button
                onClick={() => mostrarCards(ids)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-chip border border-lineStrong bg-greenSoft px-2 py-1.5 font-mono text-[11px] text-txt transition-opacity hover:opacity-90"
              >
                <Eye size={12} /> Mostrar tudo
              </button>
            </div>

            <ul className="max-h-[320px] overflow-y-auto">
              {cards.map((c) => {
                const visivel = !ocultos.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => toggle(c.id)}
                      className="flex w-full items-center gap-2.5 rounded-chip px-1.5 py-1.5 text-left transition-colors hover:bg-panel"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          visivel ? "border-green bg-greenSoft text-green" : "border-line text-transparent"
                        }`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-sm ${visivel ? "text-txt" : "text-txtFaint"}`}>
                        {c.label}
                      </span>
                      {c.essencial && (
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-txtFaint">
                          essencial
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
