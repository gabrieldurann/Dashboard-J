import { Calculator, ClipboardList, FileText, LayoutDashboard, Package, Pencil, Plug, Receipt } from "lucide-react";
import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/pesquisa", label: "Pesquisa", icon: ClipboardList, end: false },
  { to: "/produtos", label: "Produtos", icon: Package, end: false },
  { to: "/vendas", label: "Vendas", icon: Receipt, end: false },
  { to: "/vendas-avulsas", label: "Vendas avulsas", icon: Pencil, end: false },
  { to: "/calculadora", label: "Calculadora", icon: Calculator, end: false },
  { to: "/relatorios", label: "Relatórios", icon: FileText, end: false },
];

export function Sidebar() {
  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-line bg-bgRaise/60 px-4 py-6">
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

      <div className="mt-auto pt-6">
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
