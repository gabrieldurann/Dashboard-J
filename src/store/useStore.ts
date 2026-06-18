import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalculoSalvo, Produto, VendaAvulsa } from "../calc/types";
import { PRODUTOS_SEED } from "../data/seed";

// Local-first store (PLAN.md §6): hydrates from the bundled seed, then persists the user's edits
// to localStorage. The deployed link shows the seed to the partner; the user's test edits live
// only in their own browser. Swap `persist` storage for a backend adapter later — no UI change.

type State = {
  produtos: Produto[];
  vendasAvulsas: VendaAvulsa[];
  calculosSalvos: CalculoSalvo[];
  addProduto: (p: Produto) => void;
  updateProduto: (id: string, patch: Partial<Produto>) => void;
  removeProduto: (id: string) => void;
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
      vendasAvulsas: [],
      calculosSalvos: [],
      addProduto: (p) => set((s) => ({ produtos: [...s.produtos, p] })),
      updateProduto: (id, patch) =>
        set((s) => ({
          produtos: s.produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeProduto: (id) =>
        set((s) => ({ produtos: s.produtos.filter((p) => p.id !== id) })),
      addVendaAvulsa: (v) => set((s) => ({ vendasAvulsas: [v, ...s.vendasAvulsas] })),
      removeVendaAvulsa: (id) =>
        set((s) => ({ vendasAvulsas: s.vendasAvulsas.filter((v) => v.id !== id) })),
      addCalculo: (c) => set((s) => ({ calculosSalvos: [c, ...s.calculosSalvos] })),
      removeCalculo: (id) =>
        set((s) => ({ calculosSalvos: s.calculosSalvos.filter((c) => c.id !== id) })),
      resetSeed: () =>
        set({ produtos: PRODUTOS_SEED, vendasAvulsas: [], calculosSalvos: [] }),
    }),
    { name: "painel-j-v1" },
  ),
);
