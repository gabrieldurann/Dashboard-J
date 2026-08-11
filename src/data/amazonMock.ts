import type { ContaAmazon, PedidoAmazon, RelatorioAds } from "../calc/types";

// ⚠️ SIMULATED marketplace responses. This module stands in for the two API calls a sync makes:
// `pedidosDaConta` → Selling Partner API, `relatoriosAdsDaConta` → Amazon Ads API. Those two
// functions are the only seams to replace with real requests.
//
// What is deliberately ABSENT is as important as what is here: no buyer names, no addresses.
// That is restricted data behind a separate authorization, so a first working integration will
// not have it and the demo must not imply otherwise.
//
// The orders are dated inside the demo's current month on purpose: importing them adds to June
// rather than opening a new, nearly-empty month, which would otherwise make the Painel's headline
// figures jump to a month with sales but no matching costs.

const PEDIDOS_BR: Omit<PedidoAmazon, "numeroPedido">[] = [
  {
    data: "2026-06-20T11:24",
    sku: "DEMO-001",
    asin: "B0CDEMO001",
    titulo: "Mini Projetor Portátil",
    quantidade: 4,
    valorUnitario: 119.9,
    valorTotal: 479.6,
    frete: 0,
    pais: "BR",
    status: "entregue",
  },
  {
    data: "2026-06-22T09:03",
    sku: "DEMO-002",
    asin: "B0CDEMO002",
    titulo: "Garrafa Térmica Inox 1L",
    quantidade: 12,
    valorUnitario: 49.9,
    valorTotal: 598.8,
    frete: 33.9,
    pais: "BR",
    status: "entregue",
  },
  {
    data: "2026-06-24T16:41",
    sku: "DEMO-004",
    asin: "B0CDEMO004",
    titulo: "Suporte de Copo Veicular",
    quantidade: 24,
    valorUnitario: 29.9,
    valorTotal: 717.6,
    frete: 45.2,
    pais: "BR",
    status: "enviado",
  },
  {
    data: "2026-06-26T13:15",
    sku: "DEMO-003",
    asin: "B0CDEMO003",
    titulo: "Organizador de Cabos (kit 5)",
    quantidade: 12,
    valorUnitario: 39.9,
    valorTotal: 478.8,
    frete: 22.6,
    pais: "BR",
    status: "entregue",
  },
  {
    // deliberately a SKU the catalog doesn't know — imports as avulsa, which is what a real
    // sync does when you sell something that was never registered in the app
    data: "2026-06-27T08:52",
    sku: "CABO-USBC-2M",
    asin: "B0CDEMO9X1",
    titulo: "Cabo USB-C 2m",
    quantidade: 10,
    valorUnitario: 24.9,
    valorTotal: 249,
    frete: 14.1,
    pais: "BR",
    status: "entregue",
  },
];

const PEDIDOS_INTERNACIONAIS: Omit<PedidoAmazon, "numeroPedido">[] = [
  {
    data: "2026-06-21T15:30",
    sku: "DEMO-001",
    asin: "B0CDEMO001",
    titulo: "Mini Projetor Portátil",
    quantidade: 6,
    valorUnitario: 119.9,
    valorTotal: 719.4,
    frete: 0,
    pais: "US",
    status: "entregue",
  },
  {
    data: "2026-06-25T10:12",
    sku: "DEMO-002",
    asin: "B0CDEMO002",
    titulo: "Garrafa Térmica Inox 1L",
    quantidade: 9,
    valorUnitario: 49.9,
    valorTotal: 449.1,
    frete: 0,
    pais: "US",
    status: "enviado",
  },
];

// ─── Identifiers ────────────────────────────────────────────────────────────
//
// Both ids are derived from the account id, so two linked accounts never collide and — more
// importantly — an id stays the same on every sync, which is what makes re-importing idempotent
// instead of a duplicate factory.
//
// They are EXPORTED because the demo seed has to produce exactly the same ids: the seeded June
// campaigns describe the same campaigns `relatoriosAdsDaConta` reports, so if the two halves ever
// drift apart a sync silently re-imports spend that was already in the ledger. One function,
// two callers — that is the guarantee they cannot drift.

const prefixoConta = (contaId: string) =>
  contaId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "AMZN";

/** Amazon Order ID for the nth order of an account (1-based). */
export const numeroPedidoAmazon = (contaId: string, indice: number) =>
  `701-${prefixoConta(contaId)}-${String(indice).padStart(4, "0")}`;

/** Ads API campaign id for the nth campaign of an account (1-based). */
export const idCampanhaAmazon = (contaId: string, indice: number) =>
  `CAMP-${prefixoConta(contaId)}-${String(indice).padStart(3, "0")}`;

/** What a sync would find for this account. */
export function pedidosDaConta(conta: ContaAmazon): PedidoAmazon[] {
  const base = conta.regiao === "BR" ? PEDIDOS_BR : PEDIDOS_INTERNACIONAIS;
  return base.map((p, i) => ({ ...p, numeroPedido: numeroPedidoAmazon(conta.id, i + 1) }));
}

/**
 * Ads API report rows. A different API, a different authorization — which is exactly why syncing
 * the Ads service is a separate action from syncing orders.
 *
 * Note what is missing: **organic units**. The Ads API reports what the ads did; it has no idea
 * how much sold without them. That number has to come from the order data or from the user, so
 * the mock must not invent it.
 */
const RELATORIOS_BR: Omit<RelatorioAds, "campanhaId">[] = [
  {
    campanha: "SP · Projetor · Auto",
    data: "2026-06-30",
    sku: "DEMO-001",
    titulo: "Mini Projetor Portátil",
    custo: 310,
    faturamentoAds: 2_997,
    unidadesAds: 12,
    cliques: 470,
    impressoes: 28_400,
  },
  {
    campanha: "SP · Garrafa · Manual",
    data: "2026-06-30",
    sku: "DEMO-002",
    titulo: "Garrafa Térmica Inox 1L",
    custo: 155,
    faturamentoAds: 998,
    unidadesAds: 10,
    cliques: 310,
    impressoes: 19_100,
  },
  {
    campanha: "SP · Suporte · Auto",
    data: "2026-06-30",
    sku: "DEMO-004",
    titulo: "Suporte de Copo Veicular",
    custo: 215,
    faturamentoAds: 538,
    unidadesAds: 18,
    cliques: 360,
    impressoes: 24_700,
  },
];

const RELATORIOS_INTERNACIONAIS: Omit<RelatorioAds, "campanhaId">[] = [
  {
    campanha: "SP · Projector · Auto",
    data: "2026-06-30",
    sku: "DEMO-001",
    titulo: "Mini Projetor Portátil",
    custo: 270,
    faturamentoAds: 2_398,
    unidadesAds: 10,
    cliques: 405,
    impressoes: 21_300,
  },
];

/** What an Ads API report pull would return for this account. */
export function relatoriosAdsDaConta(conta: ContaAmazon): RelatorioAds[] {
  const base = conta.regiao === "BR" ? RELATORIOS_BR : RELATORIOS_INTERNACIONAIS;
  return base.map((r, i) => ({ ...r, campanhaId: idCampanhaAmazon(conta.id, i + 1) }));
}
