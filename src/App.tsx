import { HashRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Calculadora } from "./pages/Calculadora";
import { Conexoes } from "./pages/Conexoes";
import { Painel } from "./pages/Painel";
import { Pesquisa } from "./pages/Pesquisa";
import { ProdutoForm } from "./pages/ProdutoForm";
import { Produtos } from "./pages/Produtos";
import { Relatorios } from "./pages/Relatorios";
import { Vendas } from "./pages/Vendas";
import { VendasAvulsas } from "./pages/VendasAvulsas";

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Painel />} />
            <Route path="/pesquisa" element={<Pesquisa />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/produtos/novo" element={<ProdutoForm />} />
            <Route path="/produtos/:id" element={<ProdutoForm />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/vendas-avulsas" element={<VendasAvulsas />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/conexoes" element={<Conexoes />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
