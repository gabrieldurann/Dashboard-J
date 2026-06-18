import type { ReactNode } from "react";

/** Page wrapper: eyebrow + title + subtitle + content area (DESIGN.md §3). */
export function Screen({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1180px] px-8 py-9">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">{eyebrow}</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-txt">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-txtDim">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
