import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { EASE } from "../theme/tokens";
import { useConfirmStore } from "../store/useConfirm";

/** Single global confirmation modal, driven by confirmAction(). Mounted once at the app root. */
export function ConfirmDialog() {
  const { open, options, respond } = useConfirmStore();

  // Esc cancels, Enter confirms — keyboard parity for a fast internal tool.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond(false);
      if (e.key === "Enter") respond(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, respond]);

  const danger = options?.danger ?? false;

  return (
    <AnimatePresence>
      {open && options && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => respond(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="relative w-full max-w-sm rounded-card border border-lineStrong bg-panel p-5 shadow-glowGreen backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  danger ? "bg-danger/12 text-danger" : "bg-greenSoft text-green"
                }`}
              >
                <AlertTriangle size={17} />
              </span>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-txt">{options.title}</h3>
                {options.message && (
                  <p className="mt-1 text-sm leading-relaxed text-txtDim">{options.message}</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => respond(false)}
                className="rounded-chip border border-line px-4 py-2 text-sm text-txtDim transition-colors hover:text-txt"
              >
                {options.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => respond(true)}
                autoFocus
                className={`rounded-chip px-4 py-2 text-sm font-medium transition-colors ${
                  danger
                    ? "bg-danger/15 text-danger hover:bg-danger/25"
                    : "bg-greenSoft text-green hover:bg-green/25"
                }`}
              >
                {options.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
