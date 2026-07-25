import { EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "../store/useStore";

/** A card the user can hide from a dashboard. Registered in the page's card list so the
 *  "Exibição" menu can list it by name and bring it back. */
export type CardRegistrado = {
  id: string;
  label: string;
  /** kept visible by the "Só o essencial" preset */
  essencial?: boolean;
};

/**
 * Wraps a dashboard card and adds a hide control. The button sits just outside the card's
 * top-right corner (in the grid gap) so it never covers the card's own header content, and
 * only fades in while the pointer is over the card.
 */
export function Ocultavel({
  id,
  label,
  className = "",
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const oculto = useStore((s) => s.cardsOcultos.includes(id));
  const toggle = useStore((s) => s.toggleCardOculto);

  if (oculto) return null;

  return (
    <div className={`group relative ${className}`}>
      {children}
      <button
        onClick={() => toggle(id)}
        aria-label={`Ocultar ${label}`}
        title={`Ocultar ${label}`}
        className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-lineStrong bg-bgRaise text-txtFaint opacity-0 transition-all hover:text-txt focus:opacity-100 group-hover:opacity-100"
      >
        <EyeOff size={12} />
      </button>
    </div>
  );
}
