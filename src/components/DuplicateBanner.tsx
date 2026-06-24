import { CopyCheck } from "lucide-react";

// Cleanup banner for duplicate names from ANY source (idea #10). Shows when duplicate groups
// exist; the action keeps only the most recent item of each repeated name.

export function DuplicateBanner({ grupos, onLimpar }: { grupos: { length: number }[]; onLimpar: () => void }) {
  if (grupos.length === 0) return null;
  const aRemover = grupos.reduce((s, g) => s + (g.length - 1), 0);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-goldSoft px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <CopyCheck size={16} className="text-gold" />
        <span className="text-sm text-txt">
          {grupos.length} nome{grupos.length > 1 ? "s" : ""} duplicado{grupos.length > 1 ? "s" : ""} ·{" "}
          <span className="text-txtDim">{aRemover} a remover</span>
        </span>
      </div>
      <button
        onClick={onLimpar}
        className="rounded-chip border border-gold/40 px-3 py-1.5 font-mono text-xs text-gold transition-colors hover:bg-gold/15"
      >
        Manter só o mais recente
      </button>
    </div>
  );
}
