import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ContaAmazon } from "../calc/types";
import { Field, inputClass, TextInput } from "./Field";
import { EASE } from "../theme/tokens";

// The linking flow, simulated end to end. It walks the same steps a real Amazon authorization
// does — consent → token exchange → fetch account details — so the screens, the wording and the
// stored shape are already right when the backend replaces `simular()` with a real redirect.
//
// Nothing here touches a network, and no token is invented: the mock produces only the public
// fields a seller would see anyway (seller id, marketplace).

const MARKETPLACES = [
  { id: "Amazon.com.br", regiao: "BR", label: "Amazon.com.br (Brasil)" },
  { id: "Amazon.com", regiao: "NA", label: "Amazon.com (Estados Unidos)" },
  { id: "Amazon.co.uk", regiao: "EU", label: "Amazon.co.uk (Reino Unido)" },
  { id: "Amazon.de", regiao: "EU", label: "Amazon.de (Alemanha)" },
  { id: "Amazon.es", regiao: "EU", label: "Amazon.es (Espanha)" },
];

/** What the app would ask Amazon for. Shown so the consent screen isn't a black box. */
const PERMISSOES = [
  "Ler pedidos e itens vendidos",
  "Ler taxas, comissões e reembolsos",
  "Ler inventário e anúncios",
  "Ler relatórios de anúncios (Ads)",
];

const ETAPAS = [
  "Redirecionando para a Amazon…",
  "Autorização concedida",
  "Trocando o código por um token",
  "Buscando dados da conta",
];

/** Seller IDs look like this: 13–14 upper-case alphanumerics starting with A. */
const sellerIdFalso = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "A";
  for (let i = 0; i < 13; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export function ConectarConta({
  aberto,
  onFechar,
  onConectada,
}: {
  aberto: boolean;
  onFechar: () => void;
  onConectada: (c: ContaAmazon) => void;
}) {
  const [apelido, setApelido] = useState("");
  const [marketplace, setMarketplace] = useState(MARKETPLACES[0].id);
  const [etapa, setEtapa] = useState(-1); // -1 = still on the consent screen

  const rodando = etapa >= 0;

  // Latest values without making them effect dependencies. The handshake below must run exactly
  // once per authorization: `onConectada` is a fresh closure on every parent render, so depending
  // on it would restart the sequence each time a connection is added — and add another, forever.
  const dados = useRef({ apelido, marketplace, onConectada });
  dados.current = { apelido, marketplace, onConectada };

  // reset whenever the modal is reopened, so a second connection starts clean
  useEffect(() => {
    if (aberto) {
      setApelido("");
      setMarketplace(MARKETPLACES[0].id);
      setEtapa(-1);
    }
  }, [aberto]);

  // the simulated handshake — one cancellable sequence, keyed only on whether it is running
  useEffect(() => {
    if (!rodando) return;
    let cancelado = false;
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      for (let i = 0; i < ETAPAS.length; i++) {
        await espera(i === 0 ? 900 : 650);
        if (cancelado) return;
        setEtapa(i + 1);
      }
      await espera(450);
      if (cancelado) return;

      const { apelido: nome, marketplace: mkId, onConectada: entregar } = dados.current;
      const mkt = MARKETPLACES.find((m) => m.id === mkId)!;
      const agora = new Date().toISOString();
      entregar({
        id: crypto.randomUUID(),
        apelido: nome.trim() || "Conta Amazon",
        sellerId: sellerIdFalso(),
        marketplace: mkt.id,
        regiao: mkt.regiao,
        status: "conectada",
        conectadaEm: agora,
        ultimaSync: agora,
        simulada: true,
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [rodando]);

  return (
    <AnimatePresence>
      {aberto && (
        // `key` is required: without it AnimatePresence can finish the fade but never unmount,
        // leaving an invisible full-screen overlay that swallows every click on the app.
        <motion.div
          key="conectar-conta"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
          onClick={() => !rodando && onFechar()}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-card border border-lineStrong bg-panel p-6 backdrop-blur-md"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-goldSoft">
                  <ShieldCheck size={18} className="text-gold" />
                </span>
                <div>
                  <p className="font-display text-base text-txt">Conectar conta Amazon</p>
                  <p className="font-mono text-[11px] text-txtFaint">Vendedor · SP-API</p>
                </div>
              </div>
              {!rodando && (
                <button onClick={onFechar} className="text-txtFaint transition-colors hover:text-txt">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* honest about what this is — this screen looks real and is not */}
            <p className="mb-5 rounded-chip border border-amber/40 bg-amberSoft px-3 py-2 font-mono text-[11px] leading-relaxed text-amber">
              Demonstração — nenhuma conta real é acessada. O fluxo abaixo simula a autorização da
              Amazon para você ver como ela vai funcionar.
            </p>

            {!rodando ? (
              <>
                <div className="flex flex-col gap-3">
                  <Field label="Apelido da conta" hint="Para diferenciar suas lojas">
                    <TextInput
                      value={apelido}
                      onChange={(e) => setApelido(e.target.value)}
                      placeholder="Loja Principal"
                    />
                  </Field>
                  <Field label="Marketplace">
                    <select
                      value={marketplace}
                      onChange={(e) => setMarketplace(e.target.value)}
                      className={inputClass}
                    >
                      {MARKETPLACES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-5 rounded-card border border-line bg-bgRaise/40 p-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
                    O Painel J vai poder
                  </span>
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {PERMISSOES.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm text-txtDim">
                        <Check size={14} className="shrink-0 text-green" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-txtFaint">
                    <Lock size={12} className="mt-0.5 shrink-0" />
                    Somente leitura. O Painel J nunca altera preços, estoque ou pedidos na Amazon.
                  </p>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={onFechar}
                    className="rounded-chip border border-line px-4 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setEtapa(0)}
                    className="rounded-chip border border-lineStrong bg-greenSoft px-4 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
                  >
                    Autorizar na Amazon
                  </button>
                </div>
              </>
            ) : (
              <ul className="flex flex-col gap-3 py-2">
                {ETAPAS.map((label, i) => {
                  const feita = etapa > i;
                  const atual = etapa === i;
                  return (
                    <li key={label} className="flex items-center gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          feita
                            ? "border-green/40 bg-greenSoft text-green"
                            : atual
                              ? "border-lineStrong text-txtDim"
                              : "border-line text-txtFaint"
                        }`}
                      >
                        {feita ? (
                          <Check size={13} />
                        ) : atual ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <span className="font-mono text-[10px]">{i + 1}</span>
                        )}
                      </span>
                      <span className={`text-sm ${feita || atual ? "text-txt" : "text-txtFaint"}`}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
