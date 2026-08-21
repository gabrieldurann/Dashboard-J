import { TODAS_LOJAS } from "../calc/engine";
import { useStore } from "../store/useStore";
import { Field, inputClass } from "./Field";

/**
 * The "which storefront does this belong to" picker, shared by every ledger form.
 *
 * "Sem loja" is a real choice, not a blank: company-level entries (rent, accounting) belong to no
 * storefront and show only under "Todas". Nothing is auto-assigned behind the user's back.
 */
export function CampoLoja({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  const lojas = useStore((s) => s.lojas);
  if (lojas.length === 0) return null;
  return (
    <Field label="Loja">
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— Sem loja (empresa) —</option>
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * What a new record's Loja starts as: whichever storefront is being viewed.
 *
 * Registering a sale while looking at "Loja 2" and having it land on the company as a whole — or
 * worse, on a different store — is the kind of mistake that is invisible until the month closes.
 * Under "Todas" it stays empty, because there is nothing to infer.
 */
export function useLojaPadrao() {
  const lojaAtiva = useStore((s) => s.lojaAtiva);
  return lojaAtiva === TODAS_LOJAS ? "" : lojaAtiva;
}
