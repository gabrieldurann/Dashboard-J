import type { ReactNode } from "react";

/**
 * Fast hover tooltip. Native `title` attributes have a ~0.5s browser delay that can't be tuned;
 * this shows near-instantly (100ms fade) so icon-only actions are legible before you click.
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const pos =
    side === "bottom"
      ? "top-full mt-1.5"
      : "bottom-full mb-1.5";
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-chip border border-lineStrong bg-bgRaise px-2 py-1 font-mono text-[10px] text-txt opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 ${pos}`}
      >
        {label}
      </span>
    </span>
  );
}
