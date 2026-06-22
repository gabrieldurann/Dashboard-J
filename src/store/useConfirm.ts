import { create } from "zustand";

// Promise-based confirmation (PLAN.md §9 Phase 1 #1). Usage:
//   if (await confirmAction({ title: "Excluir produto?", danger: true })) removeProduto(id);
// A single <ConfirmDialog/> mounted at the app root renders the prompt.

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions | null;
  resolver: ((v: boolean) => void) | null;
  request: (options: ConfirmOptions, resolver: (v: boolean) => void) => void;
  respond: (value: boolean) => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolver: null,
  request: (options, resolver) => set({ open: true, options, resolver }),
  respond: (value) => {
    get().resolver?.(value);
    set({ open: false, options: null, resolver: null });
  },
}));

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().request(options, resolve));
}
