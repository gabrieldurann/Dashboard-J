import { useMemo } from "react";
import { daLoja, TODAS_LOJAS } from "../calc/engine";
import { useStore } from "./useStore";

/**
 * Every collection a page reads, already narrowed to the selected storefront.
 *
 * Pages take their data from here instead of straight off the store, which is what makes one
 * picker scope the whole app: the Painel, the DRE, the ledgers and the charts all compute from
 * collections that went through the same filter, so they cannot disagree about what "this store"
 * contains.
 *
 * `produtos` and `pesquisas` are deliberately absent — the catalogue is shared, and a store's
 * stock comes out of its own compras/vendas/devoluções rather than from a separate product list.
 */
export function useEscopo() {
  const lojaAtiva = useStore((s) => s.lojaAtiva);
  const vendas = useStore((s) => s.vendas);
  const vendasAvulsas = useStore((s) => s.vendasAvulsas);
  const compras = useStore((s) => s.compras);
  const devolucoes = useStore((s) => s.devolucoes);
  const custosOperacionais = useStore((s) => s.custosOperacionais);
  const anunciosAds = useStore((s) => s.anunciosAds);
  const contasAmazon = useStore((s) => s.contasAmazon);

  return useMemo(
    () => ({
      lojaAtiva,
      /** true when nothing is filtered out — the company as a whole */
      todas: lojaAtiva === TODAS_LOJAS,
      vendas: daLoja(vendas, lojaAtiva),
      vendasAvulsas: daLoja(vendasAvulsas, lojaAtiva),
      compras: daLoja(compras, lojaAtiva),
      devolucoes: daLoja(devolucoes, lojaAtiva),
      custosOperacionais: daLoja(custosOperacionais, lojaAtiva),
      anunciosAds: daLoja(anunciosAds, lojaAtiva),
      contasAmazon: daLoja(contasAmazon, lojaAtiva),
    }),
    [lojaAtiva, vendas, vendasAvulsas, compras, devolucoes, custosOperacionais, anunciosAds, contasAmazon],
  );
}

/** The storefronts themselves, plus helpers for naming one. */
export function useLojas() {
  const lojas = useStore((s) => s.lojas);
  const lojaAtiva = useStore((s) => s.lojaAtiva);
  return useMemo(
    () => ({
      lojas,
      lojaAtiva,
      todas: lojaAtiva === TODAS_LOJAS,
      /** the selected store, or undefined under "Todas" */
      atual: lojas.find((l) => l.id === lojaAtiva),
      nomeDe: (id?: string) => lojas.find((l) => l.id === id)?.nome,
    }),
    [lojas, lojaAtiva],
  );
}
