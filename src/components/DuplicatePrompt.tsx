import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { CopyCheck } from "lucide-react";
import { EASE } from "../theme/tokens";
import { useDuplicatePromptStore } from "../store/useDuplicatePrompt";

/** Global 3-way duplicate-name dialog, driven by askDuplicate(). Mounted once at the app root. */
export function DuplicatePrompt() {
  const { open, options, respond } = useDuplicatePromptStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond("cancelar");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, respond]);

  const muitos = (options?.quantidade ?? 1) > 1;

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
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={() => respond("cancelar")} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="relative w-full max-w-md rounded-card border border-lineStrong bg-panel p-5 shadow-glowGreen backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-goldSoft text-gold">
                <CopyCheck size={17} />
              </span>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-txt">Nome duplicado em {options.destino}</h3>
                <p className="mt-1 text-sm leading-relaxed text-txtDim">
                  Já {muitos ? `existem ${options.quantidade} itens` : "existe um item"} com o nome{" "}
                  <span className="text-txt">“{options.nome}”</span>. Para manter tudo organizado, o que deseja fazer?
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => respond("substituir")}
                className="rounded-chip bg-greenSoft px-4 py-2.5 text-left text-sm font-medium text-green transition-colors hover:bg-green/25"
              >
                Substituir {muitos ? "os antigos" : "o antigo"}
                <span className="block font-mono text-[11px] font-normal text-txtFaint">
                  remove {muitos ? "os existentes" : "o existente"} e mantém só o novo
                </span>
              </button>
              <button
                onClick={() => respond("manter")}
                className="rounded-chip border border-line px-4 py-2.5 text-left text-sm text-txtDim transition-colors hover:text-txt"
              >
                Manter os dois
                <span className="block font-mono text-[11px] text-txtFaint">adiciona como entrada separada</span>
              </button>
              <button
                onClick={() => respond("cancelar")}
                className="rounded-chip px-4 py-2 text-center text-sm text-txtFaint transition-colors hover:text-txt"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
