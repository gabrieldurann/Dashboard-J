import { create } from "zustand";

// Reusable save/action feedback (PLAN.md §9 Phase 1 #3). Call `toast.success("…")`
// from anywhere — including non-component code — and a transient chip animates in.

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: string; message: string; kind: ToastKind };

type ToastState = {
  toasts: Toast[];
  push: (message: string, kind: ToastKind) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push(m, "success"),
  error: (m: string) => useToastStore.getState().push(m, "error"),
  info: (m: string) => useToastStore.getState().push(m, "info"),
};
