import type { ContaAmazon, PedidoAmazon } from "../calc/types";

// ⚠️ SIMULATED marketplace responses. This module stands in for the SP-API call a sync will make;
// `pedidosDaConta` is the single seam to replace with the real request.
//
// The orders are dated inside the demo's current month on purpose: importing them adds to June
// rather than opening a new, nearly-empty month, which would otherwise make the Painel's headline
// figures jump to a month with sales but no matching costs.

const PEDIDOS_BR: Omit<PedidoAmazon, "numeroPedido">[] = [
  {
    data: "2026-06-20T11:24",
    sku: "DEMO-001",
    titulo: "Mini Projetor Portátil",
    quantidade: 4,
    valorUnitario: 119.9,
    valorTotal: 479.6,
    frete: 0,
    cliente: "Cliente Amazon 1",
    cidade: "São Paulo",
    uf: "SP",
    pais: "BR",
    status: "entregue",
  },
  {
    data: "2026-06-22T09:03",
    sku: "DEMO-002",
    titulo: "Garrafa Térmica Inox 1L",
    quantidade: 12,
    valorUnitario: 49.9,
    valorTotal: 598.8,
    frete: 33.9,
    cliente: "Cliente Amazon 2",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    pais: "BR",
    status: "entregue",
  },
  {
    data: "2026-06-24T16:41",
    sku: "DEMO-004",
    titulo: "Suporte de Copo Veicular",
    quantidade: 24,
    valorUnitario: 29.9,
    valorTotal: 717.6,
    frete: 45.2,
    cliente: "Cliente Amazon 3",
    cidade: "Belo Horizonte",
    uf: "MG",
    pais: "BR",
    status: "enviado",
  },
  {
    data: "2026-06-26T13:15",
    sku: "DEMO-003",
    titulo: "Organizador de Cabos (kit 5)",
    quantidade: 12,
    valorUnitario: 39.9,
    valorTotal: 478.8,
    frete: 22.6,
    cliente: "Cliente Amazon 4",
    cidade: "Curitiba",
    uf: "PR",
    pais: "BR",
    status: "entregue",
  },
  {
    // deliberately a SKU the catalog doesn't know — imports as avulsa, which is what a real
    // sync does when you sell something that was never registered in the app
    data: "2026-06-27T08:52",
    sku: "SKU-NAO-CADASTRADO",
    titulo: "Cabo USB-C 2m (não cadastrado)",
    quantidade: 10,
    valorUnitario: 24.9,
    valorTotal: 249,
    frete: 14.1,
    cliente: "Cliente Amazon 5",
    cidade: "Fortaleza",
    uf: "CE",
    pais: "BR",
    status: "entregue",
  },
];

const PEDIDOS_INTERNACIONAIS: Omit<PedidoAmazon, "numeroPedido">[] = [
  {
    data: "2026-06-21T15:30",
    sku: "DEMO-001",
    titulo: "Mini Projetor Portátil",
    quantidade: 6,
    valorUnitario: 119.9,
    valorTotal: 719.4,
    frete: 0,
    cliente: "Amazon Customer",
    cidade: "Austin",
    pais: "US",
    status: "entregue",
  },
  {
    data: "2026-06-25T10:12",
    sku: "DEMO-002",
    titulo: "Garrafa Térmica Inox 1L",
    quantidade: 9,
    valorUnitario: 49.9,
    valorTotal: 449.1,
    frete: 0,
    cliente: "Amazon Customer",
    cidade: "Seattle",
    pais: "US",
    status: "enviado",
  },
];

/**
 * What a sync would find for this account.
 *
 * Order numbers are derived from the account id so two linked accounts never collide — and so
 * they stay stable across syncs, which is what makes re-syncing idempotent rather than a
 * duplicate factory.
 */
export function pedidosDaConta(conta: ContaAmazon): PedidoAmazon[] {
  const base = conta.regiao === "BR" ? PEDIDOS_BR : PEDIDOS_INTERNACIONAIS;
  const prefixo = conta.id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "AMZN";
  return base.map((p, i) => ({
    ...p,
    numeroPedido: `701-${prefixo}-${String(i + 1).padStart(4, "0")}`,
  }));
}
