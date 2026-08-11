import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CONFIG_PADRAO, type Configuracoes } from "../calc/constants";
import type { Tema } from "../theme/tokens";
import type { LayoutLedger } from "../components/ExibicaoMenu";
import { aplicarRetencao, vincularImportados } from "../calc/engine";
import type { AnuncioAds, ContaAmazon, CalculoSalvo, Compra, CustoOperacional, Devolucao, ExecucaoSync, Pesquisa, Produto, Venda, VendaAvulsa } from "../calc/types";
import { ANUNCIOS_ADS_SEED, CONTAS_AMAZON_SEED, COMPRAS_SEED, CUSTOS_OPERACIONAIS_SEED, DEVOLUCOES_SEED, PESQUISAS_SEED, PRODUTOS_SEED, VENDAS_SEED } from "../data/seed";

// Local-first store (PLAN.md §6): hydrates from the bundled seed, then persists the user's edits
// to localStorage. The deployed link shows the seed to the partner; the user's test edits live
// only in their own browser. Swap `persist` storage for a backend adapter later — no UI change.

type State = {
  produtos: Produto[];
  pesquisas: Pesquisa[];
  vendas: Venda[];
  vendasAvulsas: VendaAvulsa[];
  calculosSalvos: CalculoSalvo[];
  custosOperacionais: CustoOperacional[];
  devolucoes: Devolucao[];
  compras: Compra[];
  anunciosAds: AnuncioAds[];
  contasAmazon: ContaAmazon[];
  /** History of every sync run — what each connection actually delivered, and when. */
  execucoesSync: ExecucaoSync[];
  addProduto: (p: Produto) => void;
  updateProduto: (id: string, patch: Partial<Produto>) => void;
  removeProduto: (id: string) => void;
  addPesquisa: (p: Pesquisa) => void;
  updatePesquisa: (id: string, patch: Partial<Pesquisa>) => void;
  removePesquisa: (id: string) => void;
  addVenda: (v: Venda) => void;
  /** bulk insert from a marketplace sync — the importer has already de-duplicated */
  importarVendas: (novas: Venda[]) => void;
  updateVenda: (id: string, patch: Partial<Venda>) => void;
  removeVenda: (id: string) => void;
  addVendaAvulsa: (v: VendaAvulsa) => void;
  removeVendaAvulsa: (id: string) => void;
  addCalculo: (c: CalculoSalvo) => void;
  removeCalculo: (id: string) => void;
  addCustoOperacional: (c: CustoOperacional) => void;
  updateCustoOperacional: (id: string, patch: Partial<CustoOperacional>) => void;
  removeCustoOperacional: (id: string) => void;
  /** dark (default) or light appearance — the only look-and-feel setting we kept */
  tema: Tema;
  setTema: (t: Tema) => void;
  /** tunable business rates (Configurações) — the engine receives these, never reads them itself */
  configuracoes: Configuracoes;
  setConfiguracoes: (patch: Partial<Configuracoes>) => void;
  resetConfiguracoes: () => void;
  /** overwrite every product's & pesquisa's own tax/commission with the current defaults */
  aplicarTaxasPadrao: () => void;
  /** per-page table/summary arrangement on the ledger pages, keyed by page id */
  layouts: Record<string, LayoutLedger>;
  setLayout: (pagina: string, l: LayoutLedger) => void;
  /** whether the sidebar's "Contas conectadas" section is expanded (a display preference) */
  contasAbertas: boolean;
  setContasAbertas: (v: boolean) => void;
  /** ids of dashboard cards the user chose to hide (a display preference, not data) */
  cardsOcultos: string[];
  toggleCardOculto: (id: string) => void;
  ocultarCards: (ids: string[]) => void;
  mostrarCards: (ids: string[]) => void;
  addContaAmazon: (c: ContaAmazon) => void;
  updateContaAmazon: (id: string, patch: Partial<ContaAmazon>) => void;
  removeContaAmazon: (id: string) => void;
  /** Record one finished sync run. Retention is applied here, so callers never have to think. */
  registrarExecucaoSync: (e: ExecucaoSync) => void;
  /**
   * Attach an imported SKU to a catalog product, after the user matched them by hand.
   * Returns how many imported rows moved. Hand-typed rows are never touched.
   */
  vincularSkuImportado: (sku: string, produtoId: string, contaId?: string) => number;
  addAnuncioAds: (a: AnuncioAds) => void;
  /** bulk insert from an Ads API sync — the importer has already de-duplicated */
  importarAnunciosAds: (novos: AnuncioAds[]) => void;
  updateAnuncioAds: (id: string, patch: Partial<AnuncioAds>) => void;
  removeAnuncioAds: (id: string) => void;
  addCompra: (c: Compra) => void;
  updateCompra: (id: string, patch: Partial<Compra>) => void;
  removeCompra: (id: string) => void;
  addDevolucao: (d: Devolucao) => void;
  updateDevolucao: (id: string, patch: Partial<Devolucao>) => void;
  removeDevolucao: (id: string) => void;
  /** restore the bundled seed (discard local edits) */
  resetSeed: () => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      produtos: PRODUTOS_SEED,
      pesquisas: PESQUISAS_SEED,
      vendas: VENDAS_SEED,
      vendasAvulsas: [],
      calculosSalvos: [],
      custosOperacionais: CUSTOS_OPERACIONAIS_SEED,
      devolucoes: DEVOLUCOES_SEED,
      compras: COMPRAS_SEED,
      anunciosAds: ANUNCIOS_ADS_SEED,
      contasAmazon: CONTAS_AMAZON_SEED,
      // Not seeded: a run that never happened would be a lie about where the data came from.
      // The demo's seeded rows are the starting balance, not the product of a sync.
      execucoesSync: [],
      addProduto: (p) => set((s) => ({ produtos: [...s.produtos, p] })),
      updateProduto: (id, patch) =>
        set((s) => ({
          produtos: s.produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeProduto: (id) =>
        set((s) => ({ produtos: s.produtos.filter((p) => p.id !== id) })),
      addPesquisa: (p) => set((s) => ({ pesquisas: [p, ...s.pesquisas] })),
      updatePesquisa: (id, patch) =>
        set((s) => ({
          pesquisas: s.pesquisas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePesquisa: (id) =>
        set((s) => ({ pesquisas: s.pesquisas.filter((p) => p.id !== id) })),
      addVenda: (v) => set((s) => ({ vendas: [v, ...s.vendas] })),
      importarVendas: (novas) => set((s) => ({ vendas: [...novas, ...s.vendas] })),
      updateVenda: (id, patch) =>
        set((s) => ({
          vendas: s.vendas.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      removeVenda: (id) =>
        set((s) => ({ vendas: s.vendas.filter((v) => v.id !== id) })),
      addVendaAvulsa: (v) => set((s) => ({ vendasAvulsas: [v, ...s.vendasAvulsas] })),
      removeVendaAvulsa: (id) =>
        set((s) => ({ vendasAvulsas: s.vendasAvulsas.filter((v) => v.id !== id) })),
      addCalculo: (c) => set((s) => ({ calculosSalvos: [c, ...s.calculosSalvos] })),
      removeCalculo: (id) =>
        set((s) => ({ calculosSalvos: s.calculosSalvos.filter((c) => c.id !== id) })),
      addCustoOperacional: (c) => set((s) => ({ custosOperacionais: [...s.custosOperacionais, c] })),
      updateCustoOperacional: (id, patch) =>
        set((s) => ({
          custosOperacionais: s.custosOperacionais.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCustoOperacional: (id) =>
        set((s) => ({ custosOperacionais: s.custosOperacionais.filter((c) => c.id !== id) })),
      tema: "escuro",
      setTema: (t) => set({ tema: t }),
      configuracoes: CONFIG_PADRAO,
      setConfiguracoes: (patch) =>
        set((s) => ({ configuracoes: { ...s.configuracoes, ...patch } })),
      resetConfiguracoes: () => set({ configuracoes: CONFIG_PADRAO }),
      aplicarTaxasPadrao: () =>
        set((s) => {
          const { imposto, comissao } = s.configuracoes;
          return {
            produtos: s.produtos.map((p) => ({ ...p, imposto, comissao })),
            pesquisas: s.pesquisas.map((p) => ({ ...p, imposto, comissao })),
          };
        }),
      layouts: {},
      setLayout: (pagina, l) => set((s) => ({ layouts: { ...s.layouts, [pagina]: l } })),
      // starts open: a collapsed section on first sight would hide the only thing in it
      contasAbertas: true,
      setContasAbertas: (v) => set({ contasAbertas: v }),
      cardsOcultos: [],
      toggleCardOculto: (id) =>
        set((s) => ({
          cardsOcultos: s.cardsOcultos.includes(id)
            ? s.cardsOcultos.filter((c) => c !== id)
            : [...s.cardsOcultos, id],
        })),
      ocultarCards: (ids) =>
        set((s) => ({ cardsOcultos: [...new Set([...s.cardsOcultos, ...ids])] })),
      mostrarCards: (ids) =>
        set((s) => ({ cardsOcultos: s.cardsOcultos.filter((c) => !ids.includes(c)) })),
      addContaAmazon: (c) => set((s) => ({ contasAmazon: [...s.contasAmazon, c] })),
      updateContaAmazon: (id, patch) =>
        set((s) => ({ contasAmazon: s.contasAmazon.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeContaAmazon: (id) => set((s) => ({ contasAmazon: s.contasAmazon.filter((c) => c.id !== id) })),
      registrarExecucaoSync: (e) =>
        set((s) => ({ execucoesSync: aplicarRetencao([e, ...s.execucoesSync]) })),
      vincularSkuImportado: (sku, produtoId, contaId) => {
        const s = get();
        const produto = s.produtos.find((p) => p.id === produtoId);
        if (!produto) return 0;
        const r = vincularImportados(sku, produto, s.vendas, s.anunciosAds, contaId);
        set({
          vendas: r.vendas,
          anunciosAds: r.anuncios,
          // Teach the catalog the code so the NEXT sync matches on its own — but only when the
          // product has none yet. Overwriting an existing code would silently break matching
          // for whatever SKU it already stood for.
          produtos: produto.codigoProduto
            ? s.produtos
            : s.produtos.map((p) => (p.id === produtoId ? { ...p, codigoProduto: sku } : p)),
        });
        return r.alteradas;
      },
      addAnuncioAds: (a) => set((s) => ({ anunciosAds: [a, ...s.anunciosAds] })),
      importarAnunciosAds: (novos) => set((s) => ({ anunciosAds: [...novos, ...s.anunciosAds] })),
      updateAnuncioAds: (id, patch) =>
        set((s) => ({ anunciosAds: s.anunciosAds.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAnuncioAds: (id) => set((s) => ({ anunciosAds: s.anunciosAds.filter((a) => a.id !== id) })),
      addCompra: (c) => set((s) => ({ compras: [c, ...s.compras] })),
      updateCompra: (id, patch) =>
        set((s) => ({ compras: s.compras.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCompra: (id) => set((s) => ({ compras: s.compras.filter((c) => c.id !== id) })),
      addDevolucao: (d) => set((s) => ({ devolucoes: [d, ...s.devolucoes] })),
      updateDevolucao: (id, patch) =>
        set((s) => ({
          devolucoes: s.devolucoes.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDevolucao: (id) =>
        set((s) => ({ devolucoes: s.devolucoes.filter((d) => d.id !== id) })),
      resetSeed: () =>
        set({
          produtos: PRODUTOS_SEED,
          pesquisas: PESQUISAS_SEED,
          vendas: VENDAS_SEED,
          vendasAvulsas: [],
          calculosSalvos: [],
          custosOperacionais: CUSTOS_OPERACIONAIS_SEED,
          devolucoes: DEVOLUCOES_SEED,
          compras: COMPRAS_SEED,
          anunciosAds: ANUNCIOS_ADS_SEED,
          contasAmazon: CONTAS_AMAZON_SEED,
          // goes with the data: restoring the seed removes the imported rows, so a history
          // still claiming those imports would describe sales that are no longer there
          execucoesSync: [],
        }),
    }),
    {
      // Bump this version whenever the bundled seed shape/content changes, so existing
      // browsers discard their stale persisted copy and re-hydrate from the new seed
      // instead of masking it. (v2: country data. v3: T1 historical sales. v4: calibrated
      // velocities. v5: demo scaled up ×12 + realistic operating costs. v6: returns ledger.
      // v7: returns gained status + restock date. v8: purchases ledger +
      // estoqueAtual renamed to estoqueInicial (stock is derived now). v9: operating entries
      // gained tipo despesa/receita + recorrente/pontual, and the seed gained examples of each.
      // v10: Amazon Ads ledger. v11: connections split per API (SP-API / Ads API) and imported
      // orders no longer carry buyer data. v12: June's seeded campaigns now carry the campaign
      // identity the Ads mock generates, so syncing Ads stops re-importing spend the seed
      // already had.)
      name: "painel-j-v12",
    },
  ),
);
