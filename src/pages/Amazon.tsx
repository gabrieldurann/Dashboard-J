import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Coins,
  Megaphone,
  Package,
  Plug,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { acos, chaveAds, chavePedido, pendenciasImportacao, resumoImportacao } from "../calc/engine";
import type { PendenciaImportacao } from "../calc/engine";
import type {
  AnuncioAds,
  ContaAmazon,
  ExecucaoSync,
  PedidoAmazon,
  Produto,
  RelatorioAds,
  ServicoAmazon,
  Venda,
} from "../calc/types";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { date, datetime, money, number, percent } from "../i18n/format";
import { EASE } from "../theme/tokens";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";

/**
 * Provenance page for one linked Amazon account.
 *
 * **Scope rule, and the reason this page is worth having:** it shows ONLY what arrived through
 * the connection. Nothing typed into the app appears here. Break that and it slowly becomes a
 * second copy of Vendas and Ads, and the two drift.
 *
 * So: no supplier cost, no operating costs, no purchases, and no figure the app worked out for
 * itself. What is here is what Amazon said, and what the app did with it.
 */

type Aba = "pedidos" | "anuncios" | "pendencias" | "historico";

const SERVICO: Record<ServicoAmazon, { nome: string; api: string }> = {
  "sp-api": { nome: "Vendas e estoque", api: "Selling Partner API" },
  "ads-api": { nome: "Anúncios", api: "Amazon Ads API" },
};

const STATUS_VENDA: Record<string, string> = {
  entregue: "text-green border-green/40 bg-greenSoft",
  enviado: "text-sky border-sky/40 bg-skySoft",
  pendente: "text-amber border-amber/40 bg-amberSoft",
  cancelado: "text-txtDim border-lineStrong bg-neutroSoft",
};

const mesCurto = (iso: string) => iso.slice(0, 7).split("-").reverse().join("/");

/**
 * The window a run covered, kept narrow: within one year the year is dropped, since the "Quando"
 * column right beside it already carries it. Full dates when the range really does straddle
 * years. Two extra characters here push the whole table past its budget at 1280.
 */
const janela = (de?: string, ate?: string) => {
  if (!de) return "—";
  const fim = ate ?? de;
  const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return de.slice(0, 4) === fim.slice(0, 4)
    ? `${curto(de)} → ${curto(fim)}`
    : `${date(de)} → ${date(fim)}`;
};

export function Amazon() {
  const contas = useStore((s) => s.contasAmazon);
  const vendas = useStore((s) => s.vendas);
  const anuncios = useStore((s) => s.anunciosAds);
  const produtos = useStore((s) => s.produtos);
  const execucoes = useStore((s) => s.execucoesSync);

  const [contaId, setContaId] = useState<string>("");
  const [aba, setAba] = useState<Aba>("pedidos");

  // one account selects itself; with several, the user picks (same pattern as Gestor Seller)
  const conta = contas.find((c) => c.id === contaId) ?? contas[0];

  if (!conta) return <SemConta />;

  return (
    <ConteudoAmazon
      key={conta.id}
      conta={conta}
      contas={contas}
      onTrocarConta={setContaId}
      vendas={vendas}
      anuncios={anuncios}
      produtos={produtos}
      execucoes={execucoes}
      aba={aba}
      setAba={setAba}
    />
  );
}

function ConteudoAmazon({
  conta,
  contas,
  onTrocarConta,
  vendas,
  anuncios,
  produtos,
  execucoes,
  aba,
  setAba,
}: {
  conta: ContaAmazon;
  contas: ContaAmazon[];
  onTrocarConta: (id: string) => void;
  vendas: Venda[];
  anuncios: AnuncioAds[];
  produtos: Produto[];
  execucoes: ExecucaoSync[];
  aba: Aba;
  setAba: (a: Aba) => void;
}) {
  const daConta = useMemo(
    () => execucoes.filter((e) => e.contaId === conta.id),
    [execucoes, conta.id],
  );

  const pedidosImportados = useMemo(
    () => vendas.filter((v) => v.origem === "amazon" && v.contaId === conta.id),
    [vendas, conta.id],
  );
  const anunciosImportados = useMemo(
    () => anuncios.filter((a) => a.origem === "amazon" && a.contaId === conta.id),
    [anuncios, conta.id],
  );
  const resumo = useMemo(
    () => resumoImportacao(vendas, anuncios, conta.id),
    [vendas, anuncios, conta.id],
  );
  const pendencias = useMemo(
    () => pendenciasImportacao(vendas, anuncios, produtos, conta.id),
    [vendas, anuncios, produtos, conta.id],
  );

  /**
   * Raw record per stored row, keyed exactly as the importer keys them. Runs are walked
   * oldest-first so the most recent payload wins — that is the one worth showing.
   */
  const cruPedidos = useMemo(() => {
    const m = new Map<string, PedidoAmazon>();
    for (const e of [...daConta].filter((x) => x.servico === "sp-api" && x.payload).reverse())
      for (const r of e.payload as PedidoAmazon[]) m.set(chavePedido(r.numeroPedido, r.sku), r);
    return m;
  }, [daConta]);

  const cruAnuncios = useMemo(() => {
    const m = new Map<string, RelatorioAds>();
    for (const e of [...daConta].filter((x) => x.servico === "ads-api" && x.payload).reverse())
      for (const r of e.payload as RelatorioAds[]) m.set(chaveAds(r.campanhaId, r.data, r.sku), r);
    return m;
  }, [daConta]);

  const ABAS: { id: Aba; label: string; n: number }[] = [
    { id: "pedidos", label: "Pedidos", n: pedidosImportados.length },
    { id: "anuncios", label: "Anúncios", n: anunciosImportados.length },
    { id: "pendencias", label: "Sem correspondência", n: pendencias.length },
    { id: "historico", label: "Histórico", n: daConta.length },
  ];

  return (
    <Screen
      eyebrow="Contas conectadas"
      title="Amazon"
      actions={
        contas.length > 1 && (
          <label className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Conta</span>
            <select
              value={conta.id}
              onChange={(e) => onTrocarConta(e.target.value)}
              className="bg-transparent font-mono text-sm text-txt outline-none"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apelido}
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      {/* The rule this page lives by, said once, where nobody can miss it. */}
      <p className="mb-4 rounded-card border border-line bg-bgRaise/40 px-4 py-3 text-sm text-txtDim">
        Só o que veio da Amazon. O que você digitou no Painel J fica nas páginas de origem.
      </p>

      <div className="grid grid-cols-12 gap-4">
        {/* ─── who we are looking at ─── */}
        <GlowCard accent="green" className="col-span-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                  <ShoppingCart size={15} className="text-green" strokeWidth={2} />
                </span>
                <span className="font-display text-base text-txt">{conta.apelido}</span>
                {conta.simulada && (
                  <span
                    className="rounded-full border border-lineStrong bg-neutroSoft px-2.5 py-1 font-mono text-[10px] text-txtDim"
                    title="Ligação de demonstração — sem acesso real à Amazon"
                  >
                    simulada
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] text-txtFaint">
                {conta.marketplace} · região {conta.regiao}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["sp-api", "ads-api"] as ServicoAmazon[]).map((sv) => {
                const cx = conta.conexoes.find((x) => x.servico === sv);
                return (
                  <div
                    key={sv}
                    className={`rounded-card border px-3 py-2 ${cx ? "border-line bg-bgRaise/40" : "border-line/60"}`}
                  >
                    <p className="font-mono text-[11px] text-txt">{SERVICO[sv].nome}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-txtFaint">
                      {cx ? `sincronizado ${datetime(cx.ultimaSync)}` : "não autorizado"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </GlowCard>

        {/* ─── what the connection actually brought in ─── */}
        <MetricTile
          className="col-span-6 h-full lg:col-span-3"
          label="Pedidos importados"
          value={resumo.pedidos}
          format={(v) => number(v)}
          icon={Receipt}
          dense
        />
        <MetricTile
          className="col-span-6 h-full lg:col-span-3"
          label="Faturamento importado"
          value={resumo.faturamento}
          format={money}
          icon={Wallet}
          dense
          delay={0.05}
        />
        <MetricTile
          className="col-span-6 h-full lg:col-span-3"
          label="Campanhas importadas"
          value={resumo.campanhas}
          format={(v) => number(v)}
          icon={Megaphone}
          dense
          delay={0.1}
        />
        <MetricTile
          className="col-span-6 h-full lg:col-span-3"
          label="Investimento importado"
          value={resumo.investimento}
          format={money}
          icon={Coins}
          accent="red"
          dense
          delay={0.15}
        />

        {/* The most useful number on the page, so it gets its own line rather than a fifth tile. */}
        <GlowCard className="col-span-12" delay={0.2}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {pendencias.length > 0 ? (
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
              ) : (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" />
              )}
              <div>
                <p className="font-display text-sm text-txt">
                  {pendencias.length === 0
                    ? "Nenhum SKU sem correspondência"
                    : `${pendencias.length} SKU${pendencias.length > 1 ? "s" : ""} sem custo cadastrado`}
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-txtDim">
                  {pendencias.length === 0
                    ? "Tudo o que foi importado tem produto e custo — a margem do período está apoiada em dados completos."
                    : "A receita entrou, o custo não. Enquanto isso não for resolvido, a margem do período aparece melhor do que é."}
                </p>
              </div>
            </div>
            {pendencias.length > 0 && (
              <button
                onClick={() => setAba("pendencias")}
                className="rounded-chip border border-lineStrong bg-amberSoft px-3 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
              >
                Resolver
              </button>
            )}
          </div>
        </GlowCard>
      </div>

      {/* ─── tabs: one per thing the APIs deliver, not one per app page ─── */}
      <div className="mb-4 mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
        {ABAS.map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`flex items-center gap-2 rounded-chip px-3 py-2 font-mono text-xs transition-colors ${
              aba === t.id
                ? "border border-lineStrong bg-greenSoft text-txt"
                : "border border-transparent text-txtDim hover:text-txt"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                t.id === "pendencias" && t.n > 0 ? "bg-amberSoft text-amber" : "bg-bgRaise text-txtFaint"
              }`}
            >
              {t.n}
            </span>
          </button>
        ))}
      </div>

      {aba === "pedidos" && <AbaPedidos linhas={pedidosImportados} cru={cruPedidos} />}
      {aba === "anuncios" && <AbaAnuncios linhas={anunciosImportados} cru={cruAnuncios} />}
      {aba === "pendencias" && <AbaPendencias pendencias={pendencias} conta={conta} produtos={produtos} />}
      {aba === "historico" && <AbaHistorico execucoes={daConta} />}
    </Screen>
  );
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

function AbaPedidos({ linhas, cru }: { linhas: Venda[]; cru: Map<string, PedidoAmazon> }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const ordenadas = useMemo(() => [...linhas].sort((a, b) => (a.data < b.data ? 1 : -1)), [linhas]);

  return (
    <>
      {/* said once, instead of leaving an unexplained empty column */}
      <p className="mb-3 font-mono text-[11px] leading-relaxed text-txtFaint">
        Sem coluna de cliente: nome e endereço do comprador exigem uma autorização à parte na
        Amazon, e esta conexão não a tem.
      </p>
      <Tabela
        vazio="Nenhum pedido importado ainda. Sincronize a conta em Conexões."
        colunas={[
          { k: "exp", l: "" },
          { k: "data", l: "Data" },
          { k: "pedido", l: "Pedido" },
          { k: "sku", l: "SKU" },
          { k: "produto", l: "Produto" },
          { k: "asin", l: "ASIN", cls: "hidden xl:table-cell" },
          { k: "qtd", l: "Qtd", cls: "hidden xl:table-cell" },
          { k: "valor", l: "Valor" },
          { k: "status", l: "Status" },
        ]}
        linhas={ordenadas}
        chave={(v) => v.id}
        aberta={aberta}
        onAbrir={setAberta}
        celulas={(v) => {
          const bruto = v.numeroPedido && v.codigoProduto
            ? cru.get(chavePedido(v.numeroPedido, v.codigoProduto))
            : undefined;
          return [
            <span className="whitespace-nowrap font-mono text-xs text-txtDim">{date(v.data)}</span>,
            <span className="block max-w-[105px] truncate font-mono text-xs text-txtDim" title={v.numeroPedido}>
              {v.numeroPedido ?? "—"}
            </span>,
            <span className="font-mono text-xs text-txtDim">{v.codigoProduto ?? "—"}</span>,
            <div className="max-w-[150px]">
              <span className="block truncate text-sm text-txt" title={v.produtoNome}>
                {v.produtoNome}
              </span>
              {!v.produtoId && (
                <span className="mt-0.5 inline-block rounded-full border border-amber/40 bg-amberSoft px-1.5 py-0.5 font-mono text-[9px] text-amber">
                  entrou como avulsa
                </span>
              )}
            </div>,
            <span className="font-mono text-xs text-txtFaint">{bruto?.asin ?? "—"}</span>,
            <span className="font-mono text-xs text-txtDim">{v.quantidade}</span>,
            <span className="whitespace-nowrap font-mono text-sm text-txt">{money(v.valorTotal)}</span>,
            <span className={`rounded-full border px-2 py-1 font-mono text-[10px] ${STATUS_VENDA[v.status] ?? ""}`}>
              {v.status}
            </span>,
          ];
        }}
        detalhe={(v) => (
          <Comparacao
            bruto={v.numeroPedido && v.codigoProduto ? cru.get(chavePedido(v.numeroPedido, v.codigoProduto)) : undefined}
            gravado={[
              ["Onde ficou", v.produtoId ? "Vendas · vinculada ao produto" : "Vendas · avulsa (sem produto)"],
              ["Produto", v.produtoNome],
              ["Quantidade", number(v.quantidade)],
              ["Valor unitário", money(v.valorUnitario)],
              ["Valor total", money(v.valorTotal)],
              ["Frete cobrado", v.frete !== undefined ? money(v.frete) : "—"],
              ["Canal", v.canal ?? "—"],
              ["País", v.pais ?? "—"],
              ["Status", v.status],
            ]}
          />
        )}
      />
    </>
  );
}

// ─── Anúncios ───────────────────────────────────────────────────────────────

function AbaAnuncios({ linhas, cru }: { linhas: AnuncioAds[]; cru: Map<string, RelatorioAds> }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const ordenadas = useMemo(() => [...linhas].sort((a, b) => (a.data < b.data ? 1 : -1)), [linhas]);

  return (
    <>
      <p className="mb-3 font-mono text-[11px] leading-relaxed text-txtFaint">
        A Ads API informa o que os anúncios fizeram — não quanto vendeu sem eles. As unidades
        orgânicas ficam em branco até serem preenchidas na página Ads.
      </p>
      <Tabela
        vazio="Nenhuma campanha importada ainda. Autorize a Ads API em Conexões."
        colunas={[
          { k: "exp", l: "" },
          { k: "mes", l: "Mês" },
          { k: "campanha", l: "Campanha" },
          { k: "sku", l: "SKU" },
          { k: "produto", l: "Produto" },
          { k: "custo", l: "Custo" },
          { k: "fat", l: "Fat. ads" },
          { k: "cliques", l: "Cliques", cls: "hidden xl:table-cell" },
          { k: "acos", l: "ACOS" },
        ]}
        linhas={ordenadas}
        chave={(a) => a.id}
        aberta={aberta}
        onAbrir={setAberta}
        celulas={(a) => {
          const bruto = a.campanhaId && a.sku ? cru.get(chaveAds(a.campanhaId, a.data, a.sku)) : undefined;
          const ac = acos(a.custo, a.faturamentoAds);
          return [
            <span className="whitespace-nowrap font-mono text-xs text-txtDim">{mesCurto(a.data)}</span>,
            <span className="block max-w-[110px] truncate text-sm text-txt xl:max-w-[150px]" title={bruto?.campanha ?? a.observacao}>
              {bruto?.campanha ?? a.observacao ?? "—"}
            </span>,
            <span className="font-mono text-xs text-txtDim">{a.sku ?? "—"}</span>,
            <span className="block max-w-[100px] truncate text-sm text-txt xl:max-w-[140px]" title={a.produtoNome}>
              {a.produtoNome}
            </span>,
            <span className="whitespace-nowrap font-mono text-sm text-danger">{money(a.custo)}</span>,
            <span className="whitespace-nowrap font-mono text-sm text-txt">{money(a.faturamentoAds)}</span>,
            <span className="font-mono text-xs text-txtDim">
              {a.cliques !== undefined ? number(a.cliques) : "—"}
            </span>,
            <span className="whitespace-nowrap font-mono text-sm text-txt">{ac === null ? "—" : percent(ac)}</span>,
          ];
        }}
        detalhe={(a) => (
          <Comparacao
            bruto={a.campanhaId && a.sku ? cru.get(chaveAds(a.campanhaId, a.data, a.sku)) : undefined}
            gravado={[
              ["Onde ficou", a.produtoId ? "Ads · vinculada ao produto" : "Ads · sem produto vinculado"],
              ["Produto", a.produtoNome],
              ["Período", mesCurto(a.data)],
              ["Custo", money(a.custo)],
              ["Faturamento via ads", money(a.faturamentoAds)],
              ["Unidades via ads", number(a.unidadesAds)],
              [
                "Unidades orgânicas",
                a.unidadesOrganicas === undefined ? "não informado pela API" : number(a.unidadesOrganicas),
              ],
              ["Cliques", a.cliques !== undefined ? number(a.cliques) : "—"],
            ]}
          />
        )}
      />
    </>
  );
}

// ─── Sem correspondência ────────────────────────────────────────────────────

/**
 * The tab worth keeping if everything else were cut.
 *
 * An imported sale with no cost behind it puts revenue in the month and nothing against it, so
 * the margin reads better than it is — and nothing anywhere else in the app says so. This lists
 * exactly those SKUs, biggest first, with the two ways out.
 */
function AbaPendencias({
  pendencias,
  conta,
  produtos,
}: {
  pendencias: PendenciaImportacao[];
  conta: ContaAmazon;
  produtos: Produto[];
}) {
  if (pendencias.length === 0)
    return (
      <GlowCard>
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 size={24} className="text-green" />
          <p className="font-display text-lg text-txt">Nada pendente</p>
          <p className="max-w-md text-sm text-txtDim">
            Todo SKU importado desta conta tem produto e custo cadastrados, então a margem do
            período está apoiada em dados completos.
          </p>
        </div>
      </GlowCard>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] leading-relaxed text-txtFaint">
        Ordenado pelo dinheiro em jogo. O custo do fornecedor nunca vem da Amazon — é sempre você
        quem informa, e é exatamente por isso que estes casos existem.
      </p>
      {pendencias.map((p, i) => (
        <Pendencia key={p.sku} p={p} conta={conta} produtos={produtos} delay={0.04 * i} />
      ))}
    </div>
  );
}

function Pendencia({
  p,
  conta,
  produtos,
  delay,
}: {
  p: PendenciaImportacao;
  conta: ContaAmazon;
  produtos: Produto[];
  delay: number;
}) {
  const vincular = useStore((s) => s.vincularSkuImportado);
  const [vinculando, setVinculando] = useState(false);
  const [escolhido, setEscolhido] = useState("");

  const confirmar = async () => {
    const produto = produtos.find((x) => x.id === escolhido);
    if (!produto) return;
    const ok = await confirmAction({
      title: `Vincular ${p.sku} a "${produto.nome}"?`,
      message: produto.codigoProduto
        ? `As linhas já importadas passam a apontar para este produto. O código do produto continua "${produto.codigoProduto}", então as próximas sincronizações ainda não vão reconhecer ${p.sku} sozinhas.`
        : `As linhas já importadas passam a apontar para este produto, e o código "${p.sku}" fica gravado nele — as próximas sincronizações passam a reconhecê-lo automaticamente.`,
      confirmLabel: "Vincular",
    });
    if (!ok) return;
    const n = vincular(p.sku, produto.id, conta.id);
    setVinculando(false);
    setEscolhido("");
    toast.success(n === 1 ? "1 linha vinculada" : `${n} linhas vinculadas`);
  };

  return (
    <GlowCard delay={delay}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-txt">{p.sku}</span>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                p.motivo === "sem_produto"
                  ? "border-amber/40 bg-amberSoft text-amber"
                  : "border-sky/40 bg-skySoft text-sky"
              }`}
            >
              {p.motivo === "sem_produto" ? "produto não cadastrado" : "produto sem custo"}
            </span>
          </div>
          <p className="mt-1 text-sm text-txt">{p.titulo}</p>
          <p className="mt-1.5 font-mono text-[11px] text-txtFaint">
            {p.pedidos > 0 && `${p.pedidos} ${p.pedidos === 1 ? "pedido" : "pedidos"} · ${number(p.unidades)} un · ${money(p.valor)}`}
            {p.pedidos > 0 && p.anuncios > 0 && " · "}
            {p.anuncios > 0 && `${p.anuncios} ${p.anuncios === 1 ? "campanha" : "campanhas"}`}
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-txtDim">
            {p.motivo === "sem_produto"
              ? "Entrou como venda avulsa: a receita conta, o custo não existe — o lucro deste SKU aparece inteiro."
              : "O produto existe, mas está sem custo unitário, então a venda entra como se não custasse nada."}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {p.motivo === "sem_custo" && p.produtoId ? (
            <Link
              to={`/produtos/${p.produtoId}`}
              className="rounded-chip border border-lineStrong bg-greenSoft px-3 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
            >
              Informar custo
            </Link>
          ) : (
            <>
              <Link
                to={`/produtos/novo?nome=${encodeURIComponent(p.titulo)}&sku=${encodeURIComponent(p.sku)}`}
                className="rounded-chip border border-lineStrong bg-greenSoft px-3 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
              >
                Cadastrar produto
              </Link>
              {!vinculando ? (
                <button
                  onClick={() => setVinculando(true)}
                  className="rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt"
                >
                  Vincular a um produto
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <select
                    value={escolhido}
                    onChange={(e) => setEscolhido(e.target.value)}
                    className="rounded-chip border border-line bg-panel px-3 py-2 font-mono text-xs text-txt outline-none"
                  >
                    <option value="">Escolha um produto…</option>
                    {produtos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={confirmar}
                    disabled={!escolhido}
                    className="rounded-chip border border-lineStrong bg-greenSoft px-3 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Vincular
                  </button>
                  <button
                    onClick={() => {
                      setVinculando(false);
                      setEscolhido("");
                    }}
                    className="rounded-chip border border-line px-3 py-2 font-mono text-xs text-txtDim transition-colors hover:text-txt"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </GlowCard>
  );
}

// ─── Histórico ──────────────────────────────────────────────────────────────

function AbaHistorico({ execucoes }: { execucoes: ExecucaoSync[] }) {
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <>
      <p className="mb-3 font-mono text-[11px] leading-relaxed text-txtFaint">
        Uma linha por sincronização. <span className="text-txtDim">Duplicados</span> não é erro: um
        sync real relê a mesma janela de datas e reencontra o que já entrou.
      </p>
      <Tabela
        vazio="Nenhuma sincronização registrada ainda."
        colunas={[
          { k: "exp", l: "" },
          { k: "quando", l: "Quando" },
          { k: "servico", l: "Serviço" },
          { k: "janela", l: "Janela", cls: "hidden xl:table-cell" },
          { k: "recebidos", l: "Recebidos" },
          { k: "importados", l: "Importados" },
          // the "nothing happened" number — first to go when space runs out, and repeated
          // in the expander so it is never actually lost
          { k: "duplicados", l: "Duplicados", cls: "hidden xl:table-cell" },
          { k: "sem", l: "S/ corresp." },
          { k: "status", l: "Status" },
        ]}
        linhas={execucoes}
        chave={(e) => e.id}
        aberta={aberta}
        onAbrir={setAberta}
        celulas={(e) => [
          <span className="whitespace-nowrap font-mono text-xs text-txtDim">{datetime(e.iniciadaEm)}</span>,
          <span className="whitespace-nowrap text-sm text-txt">{SERVICO[e.servico].nome}</span>,
          <span
            className="whitespace-nowrap font-mono text-xs text-txtFaint"
            title={e.periodoDe ? `${date(e.periodoDe)} → ${date(e.periodoAte ?? e.periodoDe)}` : undefined}
          >
            {janela(e.periodoDe, e.periodoAte)}
          </span>,
          <span className="font-mono text-sm text-txt">{e.recebidos}</span>,
          <span className="font-mono text-sm text-green">{e.importados}</span>,
          <span className="font-mono text-sm text-txtDim">{e.duplicados}</span>,
          <span className={`font-mono text-sm ${e.semCorrespondencia > 0 ? "text-amber" : "text-txtDim"}`}>
            {e.semCorrespondencia}
          </span>,
          <span
            className={`rounded-full border px-2 py-1 font-mono text-[10px] ${
              e.status === "sucesso"
                ? "text-green border-green/40 bg-greenSoft"
                : e.status === "parcial"
                  ? "text-amber border-amber/40 bg-amberSoft"
                  : "text-danger border-danger/40 bg-danger/12"
            }`}
          >
            {e.status}
          </span>,
        ]}
        detalhe={(e) => (
          <div>
            <p className="mb-3 font-mono text-[11px] text-txtDim">
              {e.recebidos} recebidos · {e.importados} importados · {e.duplicados} já existiam ·{" "}
              {e.semCorrespondencia} sem correspondência · janela{" "}
              {e.periodoDe ? `${date(e.periodoDe)} → ${date(e.periodoAte ?? e.periodoDe)}` : "—"}
            </p>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">
              Resposta como chegou · {SERVICO[e.servico].api}
            </p>
            {e.payload ? (
              <Cru dados={e.payload} />
            ) : (
              <p className="rounded-card border border-line bg-bgRaise/40 px-3 py-4 text-xs text-txtDim">
                A resposta crua desta execução já foi descartada — guardamos o conteúdo apenas das
                sincronizações mais recentes. Os números acima continuam valendo.
              </p>
            )}
            {e.erro && <p className="mt-2 font-mono text-xs text-danger">{e.erro}</p>}
          </div>
        )}
      />
    </>
  );
}

// ─── shared pieces ──────────────────────────────────────────────────────────

/** "Veio assim" beside "virou isto" — the pairing that makes the page checkable, not just another summary. */
function Comparacao({ bruto, gravado }: { bruto?: unknown; gravado: [string, string][] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Veio assim</p>
        {bruto ? (
          <Cru dados={bruto} />
        ) : (
          <p className="rounded-card border border-line bg-bgRaise/40 px-3 py-4 text-xs text-txtDim">
            Registro cru indisponível — guardamos a resposta apenas das sincronizações mais
            recentes.
          </p>
        )}
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Virou isto</p>
        <dl className="rounded-card border border-line bg-bgRaise/40 px-3 py-2.5">
          {gravado.map(([t, v]) => (
            <div key={t} className="flex justify-between gap-4 border-b border-line/50 py-1.5 last:border-0">
              <dt className="font-mono text-[11px] text-txtFaint">{t}</dt>
              <dd className="text-right font-mono text-xs text-txt">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Cru({ dados }: { dados: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-card border border-line bg-bgRaise/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-txtDim">
      {JSON.stringify(dados, null, 2)}
    </pre>
  );
}

type Coluna = { k: string; l: string; cls?: string };

/**
 * The one table shape all four tabs share: expandable rows over a fixed column budget.
 * `Screen` caps content at ~1074px, so low-value columns drop below `xl` rather than letting
 * `overflow-x-auto` clip them.
 */
function Tabela<T>({
  colunas,
  linhas,
  chave,
  celulas,
  detalhe,
  aberta,
  onAbrir,
  vazio,
}: {
  colunas: Coluna[];
  linhas: T[];
  chave: (t: T) => string;
  celulas: (t: T) => ReactNode[];
  detalhe: (t: T) => ReactNode;
  aberta: string | null;
  onAbrir: (id: string | null) => void;
  vazio: string;
}) {
  return (
    <GlowCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {colunas.map((c) => (
                <th
                  key={c.k}
                  className={`whitespace-nowrap px-2 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint xl:px-3 ${c.cls ?? ""}`}
                >
                  {c.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={colunas.length} className="px-4 py-12 text-center text-sm text-txtDim">
                  {vazio}
                </td>
              </tr>
            ) : (
              linhas.map((t) => {
                const id = chave(t);
                const abertaAqui = aberta === id;
                return (
                  <Fragment key={id}>
                    <tr
                      onClick={() => onAbrir(abertaAqui ? null : id)}
                      className="cursor-pointer border-b border-line/60 transition-colors hover:bg-greenSoft/20"
                    >
                      <td className="w-8 px-2 py-3 xl:px-3">
                        <ChevronDown
                          size={14}
                          className={`text-txtFaint transition-transform ${abertaAqui ? "rotate-180" : ""}`}
                        />
                      </td>
                      {celulas(t).map((c, i) => (
                        <td key={i} className={`px-2 py-3 xl:px-3 ${colunas[i + 1]?.cls ?? ""}`}>
                          {c}
                        </td>
                      ))}
                    </tr>
                    <AnimatePresence initial={false}>
                      {abertaAqui && (
                        <motion.tr key={`${id}-detalhe`} className="border-b border-line/60">
                          <td colSpan={colunas.length} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="bg-bgRaise/30 px-4 py-4">{detalhe(t)}</div>
                            </motion.div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </GlowCard>
  );
}

function SemConta() {
  return (
    <Screen eyebrow="Contas conectadas" title="Amazon">
      <GlowCard accent="gold" grid>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-chip bg-goldSoft">
            <Plug size={24} className="text-gold" />
          </span>
          <p className="font-display text-2xl text-txt">Nenhuma conta conectada</p>
          <p className="max-w-md text-sm text-txtDim">
            Esta página mostra o que a Amazon entregou para cada conta ligada. Conecte uma conta
            para começar.
          </p>
          <Link
            to="/conexoes"
            className="mt-1 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
          >
            <Package size={15} /> Ir para Conexões
          </Link>
        </div>
      </GlowCard>
    </Screen>
  );
}

