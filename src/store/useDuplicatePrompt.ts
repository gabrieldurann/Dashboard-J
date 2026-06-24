import { create } from "zustand";

// Promise-based 3-way prompt for duplicate names (ideas #9/#10). Usage:
//   const escolha = await askDuplicate({ nome, destino: "Produtos", quantidade: dups.length });
//   if (escolha === "cancelar") return;
//   if (escolha === "substituir") dups.forEach((d) => remove(d.id));
//   add(novo); // "manter" simply keeps both

export type DupChoice = "substituir" | "manter" | "cancelar";
export type DupOptions = { nome: string; destino: string; quantidade: number };

type State = {
  open: boolean;
  options: DupOptions | null;
  resolver: ((c: DupChoice) => void) | null;
  request: (o: DupOptions, r: (c: DupChoice) => void) => void;
  respond: (c: DupChoice) => void;
};

export const useDuplicatePromptStore = create<State>((set, get) => ({
  open: false,
  options: null,
  resolver: null,
  request: (options, resolver) => set({ open: true, options, resolver }),
  respond: (c) => {
    get().resolver?.(c);
    set({ open: false, options: null, resolver: null });
  },
}));

export function askDuplicate(options: DupOptions): Promise<DupChoice> {
  return new Promise((resolve) => useDuplicatePromptStore.getState().request(options, resolve));
}
