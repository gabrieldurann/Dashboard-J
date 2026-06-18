import type { StatusCor } from "../calc/constants";
import { STATUS_COLOR } from "../theme/tokens";

const LABEL: Record<StatusCor, string> = {
  vermelho: "Re-avaliar",
  amarelo: "Pode melhorar",
  verde: "Ótimo",
};

/** Colored health dot for margin bands (idea #2). */
export function StatusDot({ cor, label = false }: { cor: StatusCor; label?: boolean }) {
  const c = STATUS_COLOR[cor];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: c, boxShadow: `0 0 8px ${c}` }}
      />
      {label && <span className="font-mono text-xs text-txtDim">{LABEL[cor]}</span>}
    </span>
  );
}
