import { AnimatePresence, motion } from "framer-motion";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DuplicatePrompt } from "./components/DuplicatePrompt";
import { Sidebar } from "./components/Sidebar";
import { Toaster } from "./components/Toaster";
import { EASE } from "./theme/tokens";
import { useAplicarTema } from "./theme/useCores";
import { Calculadora } from "./pages/Calculadora";
import { Conexoes } from "./pages/Conexoes";
import { Configuracoes } from "./pages/Configuracoes";
import { CustosOperacionais } from "./pages/CustosOperacionais";
import { Devolucoes } from "./pages/Devolucoes";
import { Graficos } from "./pages/Graficos";
import { Painel } from "./pages/Painel";
import { Pesquisa } from "./pages/Pesquisa";
import { ProdutoForm } from "./pages/ProdutoForm";
import { Produtos } from "./pages/Produtos";
import { Relatorios } from "./pages/Relatorios";
import { Simulacoes } from "./pages/Simulacoes";
import { Vendas } from "./pages/Vendas";
import { VendasAvulsas } from "./pages/VendasAvulsas";

/** Subtle cross-fade between routes (PLAN.md §9 Phase 1 #5). */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        <Routes location={location}>
          <Route path="/" element={<Painel />} />
          <Route path="/pesquisa" element={<Pesquisa />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/produtos/novo" element={<ProdutoForm />} />
          <Route path="/produtos/:id" element={<ProdutoForm />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/vendas-avulsas" element={<VendasAvulsas />} />
          <Route path="/devolucoes" element={<Devolucoes />} />
          <Route path="/calculadora" element={<Calculadora />} />
          <Route path="/simulacoes" element={<Simulacoes />} />
          <Route path="/graficos" element={<Graficos />} />
          <Route path="/custos-operacionais" element={<CustosOperacionais />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/conexoes" element={<Conexoes />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  useAplicarTema();
  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">
          <AnimatedRoutes />
        </main>
      </div>
      <Toaster />
      <ConfirmDialog />
      <DuplicatePrompt />
    </HashRouter>
  );
}
