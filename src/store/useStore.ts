import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalculoSalvo, Pesquisa, Produto, Venda, VendaAvulsa } from "../calc/types";
import { PESQUISAS_SEED, PRODUTOS_SEED, VENDAS_SEED } from "../data/seed";

// Local-first store (PLAN.md §6): hydrates from the bundled seed, then persists the user's edits
// to localStorage. The deployed link shows the seed to the partner; the user's test edits live
// only in their own browser. Swap `persist` storage for a backend adapter later — no UI change.

type State = {
  produtos: Produto[];
  pesquisas: Pesquisa[];
  vendas: Venda[];
  vendasAvulsas: VendaAvulsa[];
  calculosSalvos: CalculoSalvo[];
  addProduto: (p: Produto) => void;
  updateProduto: (id: string, patch: Partial<Produto>) => void;
  removeProduto: (id: string) => void;
  addPesquisa: (p: Pesquisa) => void;
  updatePesquisa: (id: string, patch: Partial<Pesquisa>) => void;
  removePesquisa: (id: string) => void;
  addVenda: (v: Venda) => void;
  updateVenda: (id: string, patch: Partial<Venda>) => void;
  removeVenda: (id: string) => void;
  addVendaAvulsa: (v: VendaAvulsa) => void;
  removeVendaAvulsa: (id: string) => void;
  addCalculo: (c: CalculoSalvo) => void;
  removeCalculo: (id: string) => void;
  /** restore the bundled seed (discard local edits) */
  resetSeed: () => void;
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      produtos: PRODUTOS_SEED,
      pesquisas: PESQUISAS_SEED,
      vendas: VENDAS_SEED,
      vendasAvulsas: [],
      calculosSalvos: [],
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
      resetSeed: () =>
        set({
          produtos: PRODUTOS_SEED,
          pesquisas: PESQUISAS_SEED,
          vendas: VENDAS_SEED,
          vendasAvulsas: [],
          calculosSalvos: [],
        }),
    }),
    {
      // Bump this version whenever the bundled seed shape/content changes, so existing
      // browsers discard their stale persisted copy and re-hydrate from the new seed
      // instead of masking it. (v2: added country data + expanded demo sales.)
      name: "painel-j-v2",
    },
  ),
);
