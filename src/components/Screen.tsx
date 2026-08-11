import type { ReactNode } from "react";

/**
 * Page wrapper: eyebrow + title + content area (DESIGN.md §3).
 *
 * No subtitle by design — the page titles are specific enough that a line of prose under each
 * one only restates them.
 */
export function Screen({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1180px] px-8 py-9">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">{eyebrow}</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-txt">{title}</h1>
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
