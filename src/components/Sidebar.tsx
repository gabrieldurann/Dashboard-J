import { Store,
  ChevronDown, Megaphone, BarChart3, Building2, ShoppingCart, Calculator, ClipboardList, FileText, LayoutDashboard, Package, Pencil, Plug, Receipt, RotateCcw, Scale, Settings, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { EASE } from "../theme/tokens";
import { TODAS_LOJAS } from "../calc/engine";
import { useStore } from "../store/useStore";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/pesquisa", label: "Pesquisa", icon: ClipboardList, end: false },
  { to: "/produtos", label: "Produtos", icon: Package, end: false },
  { to: "/vendas", label: "Vendas", icon: Receipt, end: false },
  { to: "/vendas-avulsas", label: "Vendas avulsas", icon: Pencil, end: false },
  { to: "/compras", label: "Compras", icon: ShoppingCart, end: false },
  { to: "/devolucoes", label: "Devoluções", icon: RotateCcw, end: false },
  { to: "/calculadora", label: "Calculadora", icon: Calculator, end: false },
  { to: "/simulacoes", label: "Simulações", icon: SlidersHorizontal, end: false },
  { to: "/graficos", label: "Gráficos", icon: BarChart3, end: false },
  { to: "/ads", label: "Ads", icon: Megaphone, end: false },
  { to: "/custos-operacionais", label: "Custos op.", icon: Building2, end: false },
  { to: "/dre", label: "DRE", icon: Scale, end: false },
  { to: "/relatorios", label: "Relatórios", icon: FileText, end: false },
];

/** Same shape as a NAV entry, so both lists render through one styling rule. */
const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-chip px-3 py-2.5 font-mono text-[13px] tracking-wide transition-colors ${
    isActive
      ? "border border-lineStrong bg-greenSoft text-txt"
      : "border border-transparent text-txtDim hover:text-txt"
  }`;

/** One item per linked platform. Mercado Livre and Shopify join this list, nothing else changes. */
const CONTAS_NAV = [{ to: "/contas/amazon", label: "Amazon", icon: ShoppingCart }];

/**
 * Collapsible "Contas conectadas" group.
 *
 * These pages are for checking where a number came from, not for daily work, so the group folds
 * away by default-choice rather than sitting open forever — and it is where every future
 * marketplace lands, which is exactly why it needs to collapse at all.
 */
function ContasConectadas() {
  const aberta = useStore((s) => s.contasAbertas);
  const setAberta = useStore((s) => s.setContasAbertas);
  const { pathname } = useLocation();
  const naSecao = pathname.startsWith("/contas");

  // Landing on one of these pages opens the group: an active item you cannot see reads as a bug.
  useEffect(() => {
    if (naSecao) setAberta(true);
  }, [naSecao, setAberta]);

  return (
    <div className="mt-7">
      <button
        onClick={() => setAberta(!aberta)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-2 rounded-chip px-3 py-2 transition-colors hover:bg-greenSoft/20"
      >
        {/* tighter than the default .eyebrow tracking: at 0.22em the label wraps to two lines
            once the chevron takes its share of a 230px sidebar */}
        <span className={`eyebrow whitespace-nowrap !tracking-[0.1em] ${naSecao ? "text-txtDim" : ""}`}>
          Contas conectadas
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-txtFaint transition-transform duration-200 ${aberta ? "" : "-rotate-90"}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {aberta && (
          // keyed: an unkeyed conditional motion.div has left an invisible click-eating
          // overlay behind before (see the connect-account modal)
          <motion.div
            key="contas-conectadas"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <nav className="flex flex-col gap-1 pt-1">
              {CONTAS_NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={itemClass}>
                  <Icon size={17} strokeWidth={2} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Which storefront the whole app is looking at.
 *
 * It lives in the sidebar rather than in each page's header so that one control scopes every
 * page at once — the Painel, the ledgers, the DRE and the charts all read through `useEscopo`.
 * "Todas" is the default and reproduces the company-wide figures exactly.
 */
function SeletorLoja() {
  const lojas = useStore((s) => s.lojas);
  const lojaAtiva = useStore((s) => s.lojaAtiva);
  const setLojaAtiva = useStore((s) => s.setLojaAtiva);
  // with a single storefront there is nothing to choose between, and the control would only be
  // one more thing on screen
  if (lojas.length < 2) return null;

  const escopoNomeado = lojaAtiva !== TODAS_LOJAS;
  return (
    <label className="mb-6 block px-1">
      <span className="eyebrow mb-1.5 block !tracking-[0.1em]">Loja</span>
      <div
        className={`flex items-center gap-2 rounded-chip border px-2.5 py-2 transition-colors ${
          escopoNomeado ? "border-green/40 bg-greenSoft" : "border-line bg-panel"
        }`}
      >
        <Store size={14} className={escopoNomeado ? "shrink-0 text-green" : "shrink-0 text-txtFaint"} />
        <select
          value={lojaAtiva}
          onChange={(e) => setLojaAtiva(e.target.value)}
          title="Filtra o app inteiro por loja"
          className="w-full min-w-0 bg-transparent font-mono text-xs text-txt outline-none"
        >
          <option value={TODAS_LOJAS}>Todas as lojas</option>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export function Sidebar() {
  // The section only exists once something is connected — an empty "Contas conectadas" heading
  // would promise a place that has nothing to show.
  const temConta = useStore((s) => s.contasAmazon.length > 0);

  return (
    <aside className="sticky top-0 flex h-screen w-[230px] shrink-0 flex-col overflow-y-auto border-r border-line bg-bgRaise/60 px-4 py-6">
      <div className="mb-9 flex items-center gap-2.5 px-2">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-chip bg-greenSoft">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green shadow-glowGreen" />
        </span>
        <div className="leading-tight">
          <div className="font-display text-base font-semibold text-txt">
            Painel <span className="text-gold">J</span>
          </div>
          <div className="eyebrow">Estoque & Vendas</div>
        </div>
      </div>

      <SeletorLoja />

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-chip px-3 py-2.5 font-mono text-[13px] tracking-wide transition-colors ${
                isActive
                  ? "border border-lineStrong bg-greenSoft text-txt"
                  : "border border-transparent text-txtDim hover:text-txt"
              }`
            }
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      {temConta && <ContasConectadas />}

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-chip px-3 py-2.5 font-mono text-[13px] tracking-wide transition-colors ${
              isActive
                ? "border border-lineStrong bg-greenSoft text-txt"
                : "border border-transparent text-txtDim hover:text-txt"
            }`
          }
        >
          <Settings size={17} strokeWidth={2} />
          Configurações
        </NavLink>
        <NavLink
          to="/conexoes"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-chip px-3 py-2.5 font-mono text-[13px] tracking-wide transition-colors ${
              isActive
                ? "border border-lineStrong bg-greenSoft text-txt"
                : "border border-line text-txtDim hover:text-txt"
            }`
          }
        >
          <Plug size={17} strokeWidth={2} />
          Conexões
        </NavLink>
      </div>
    </aside>
  );
}
