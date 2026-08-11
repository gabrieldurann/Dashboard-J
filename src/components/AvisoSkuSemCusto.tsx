import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { pendenciasImportacao } from "../calc/engine";
import { useStore } from "../store/useStore";

/**
 * Painel warning: imported SKUs the app cannot cost.
 *
 * ⚠️ **Deliberately self-contained and disposable.** The user asked to keep this for now and to
 * remove it later, so it owns its own data, reads nothing from the Painel and returns `null`
 * when there is nothing to say. Deleting it is deleting the one `<AvisoSkuSemCusto />` line in
 * Painel.tsx and this file — nothing else has to be unpicked.
 *
 * Why it exists at all: this is the one case where the headline profit is wrong and nothing on
 * screen admits it. The revenue of an uncosted import lands in the month, its cost does not, and
 * the margin quietly reads better than reality.
 */
export function AvisoSkuSemCusto() {
  const vendas = useStore((s) => s.vendas);
  const anuncios = useStore((s) => s.anunciosAds);
  const produtos = useStore((s) => s.produtos);

  // every account: the Painel's figures are company-wide, so the warning has to be too
  const pendencias = pendenciasImportacao(vendas, anuncios, produtos);
  if (pendencias.length === 0) return null;

  const n = pendencias.length;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/40 bg-amberSoft px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />
        <p className="text-sm leading-relaxed text-txtDim">
          <strong className="text-amber">
            {n} SKU{n > 1 ? "s" : ""} importado{n > 1 ? "s" : ""} sem custo cadastrado.
          </strong>{" "}
          A receita entrou e o custo não, então o lucro abaixo está melhor do que a realidade.
        </p>
      </div>
      <Link
        to="/contas/amazon"
        className="shrink-0 rounded-chip border border-lineStrong bg-panel px-3 py-1.5 font-mono text-xs text-txt transition-opacity hover:opacity-90"
      >
        Ver quais
      </Link>
    </div>
  );
}
