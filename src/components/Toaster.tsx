import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Info } from "lucide-react";
import { EASE } from "../theme/tokens";
import { useToastStore, type ToastKind } from "../store/useToast";

const ICON = { success: Check, error: AlertTriangle, info: Info };
const ACCENT: Record<ToastKind, string> = {
  success: "border-green/40 text-green",
  error: "border-danger/40 text-danger",
  info: "border-lineStrong text-txtDim",
};

/** Transient feedback chips, stacked bottom-center. Driven by the global toast store. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.24, ease: EASE }}
              onClick={() => dismiss(t.id)}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-full border bg-panel px-4 py-2.5 text-sm text-txt shadow-glowGreen backdrop-blur-md ${ACCENT[t.kind]}`}
            >
              <Icon size={15} />
              <span className="text-txt">{t.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
