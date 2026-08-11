import {
  AlertTriangle,
  Megaphone,
  Plug,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Store,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { importarAnuncios, importarPedidos } from "../calc/engine";
import type { ConexaoServico, ContaAmazon, ServicoAmazon, StatusConexao } from "../calc/types";
import { pedidosDaConta, relatoriosAdsDaConta } from "../data/amazonMock";
import { ConectarConta } from "../components/ConectarConta";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { datetime } from "../i18n/format";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useStore } from "../store/useStore";

const INTEGRACOES = [
  { nome: "Shopify", desc: "Sincronizar produtos, estoque e vendas da loja.", icon: ShoppingBag },
  { nome: "Meta Ads", desc: "Acompanhar gastos e conversões de anúncios.", icon: Megaphone },
  { nome: "Mercado Livre", desc: "Puxar vendas e status de envio.", icon: Store },
];

const STATUS: Record<StatusConexao, { label: string; cls: string }> = {
  conectada: { label: "Conectada", cls: "text-green border-green/40 bg-greenSoft" },
  expirada: { label: "Expirada", cls: "text-amber border-amber/40 bg-amberSoft" },
  revogada: { label: "Revogada", cls: "text-txtDim border-lineStrong bg-neutroSoft" },
};

/** What each API is called and what it brings in — shown per connection, not per account. */
const SERVICO: Record<ServicoAmazon, { nome: string; api: string; traz: string }> = {
  "sp-api": { nome: "Vendas e estoque", api: "Selling Partner API", traz: "Pedidos → Vendas" },
  "ads-api": { nome: "Anúncios", api: "Amazon Ads API", traz: "Campanhas → Ads" },
};

/** Seller IDs are semi-sensitive, so only the ends are shown. */
const mascarar = (id: string) => (id.length <= 6 ? id : `${id.slice(0, 4)}••••${id.slice(-4)}`);

export function Conexoes() {
  const contas = useStore((s) => s.contasAmazon);
  const addConta = useStore((s) => s.addContaAmazon);
  const updateConta = useStore((s) => s.updateContaAmazon);
  const removeConta = useStore((s) => s.removeContaAmazon);
  const vendas = useStore((s) => s.vendas);
  const produtos = useStore((s) => s.produtos);
  const anuncios = useStore((s) => s.anunciosAds);
  const importarVendas = useStore((s) => s.importarVendas);
  const importarAds = useStore((s) => s.importarAnunciosAds);
  const registrarExecucao = useStore((s) => s.registrarExecucaoSync);

  const [modal, setModal] = useState(false);
  const [sincronizando, setSincronizando] = useState<string | null>(null);

  const conectada = (c: ContaAmazon) => {
    addConta(c);
    setModal(false);
    toast.success(`${c.apelido} conectada`);
  };

  /**
   * Simulated refresh of ONE service. `pedidosDaConta` / `relatoriosAdsDaConta` stand in for the
   * two API calls; everything after them — matching by SKU, skipping what's already there,
   * writing to the ledgers — is the real logic and stays untouched when the APIs arrive.
   *
   * Every run also leaves an `ExecucaoSync` behind. That record, not the ledger rows, is what
   * makes an odd figure traceable later on the Amazon page.
   */
  const sincronizar = (c: ContaAmazon, servico: ServicoAmazon) => {
    const chave = `${c.id}·${servico}`;
    const iniciadaEm = new Date().toISOString();
    setSincronizando(chave);
    setTimeout(() => {
      let quantos = 0;
      let oQue = "";
      let recebidos = 0;
      let semCorrespondencia = 0;
      let payload: unknown[] = [];

      if (servico === "sp-api") {
        const pedidos = pedidosDaConta(c);
        const novas = importarPedidos(pedidos, vendas, produtos, c);
        if (novas.length > 0) importarVendas(novas);
        payload = pedidos;
        recebidos = pedidos.length;
        quantos = novas.length;
        // counted over what actually went in: a re-sync that imports nothing has nothing new
        // left uncosted, and reporting it again would double-count the same problem
        semCorrespondencia = novas.filter((v) => !v.produtoId).length;
        oQue = quantos === 1 ? "pedido importado" : "pedidos importados";
      } else {
        const relatorios = relatoriosAdsDaConta(c);
        const novos = importarAnuncios(relatorios, anuncios, produtos, c);
        if (novos.length > 0) importarAds(novos);
        payload = relatorios;
        recebidos = relatorios.length;
        quantos = novos.length;
        semCorrespondencia = novos.filter((a) => !a.produtoId).length;
        oQue = quantos === 1 ? "campanha importada" : "campanhas importadas";
      }

      const datas = payload.map((r) => (r as { data: string }).data).sort();
      registrarExecucao({
        id: crypto.randomUUID(),
        contaId: c.id,
        servico,
        iniciadaEm,
        concluidaEm: new Date().toISOString(),
        status: "sucesso",
        // the window the returned records cover — with a mock this is the honest version of
        // "what did we ask for", since there is no real query range to report
        periodoDe: datas[0],
        periodoAte: datas[datas.length - 1],
        recebidos,
        importados: quantos,
        duplicados: recebidos - quantos,
        semCorrespondencia,
        payload,
      });

      atualizarConexao(c, servico, { ultimaSync: new Date().toISOString(), status: "conectada" });
      setSincronizando(null);
      toast.success(quantos === 0 ? "Nada novo para importar" : `${quantos} ${oQue}`);
    }, 1100);
  };

  /** Patch one service's connection without touching the account's other authorization. */
  const atualizarConexao = (c: ContaAmazon, servico: ServicoAmazon, patch: Partial<ConexaoServico>) =>
    updateConta(c.id, {
      conexoes: c.conexoes.map((x) => (x.servico === servico ? { ...x, ...patch } : x)),
    });

  /** Authorizing a second API on an account that already has one. */
  const conectarServico = (c: ContaAmazon, servico: ServicoAmazon) => {
    updateConta(c.id, {
      conexoes: [...c.conexoes, { servico, status: "conectada", conectadaEm: new Date().toISOString() }],
    });
    toast.success(`${SERVICO[servico].nome} autorizado`);
  };

  const desconectarServico = async (c: ContaAmazon, servico: ServicoAmazon) => {
    const ok = await confirmAction({
      title: `Revogar ${SERVICO[servico].nome}?`,
      message: `A conta continua conectada, mas ${SERVICO[servico].api} deixa de sincronizar. Os dados já importados permanecem.`,
      confirmLabel: "Revogar",
      danger: true,
    });
    if (!ok) return;
    updateConta(c.id, { conexoes: c.conexoes.filter((x) => x.servico !== servico) });
    toast.success("Autorização revogada");
  };

  const desconectar = async (c: ContaAmazon) => {
    const ok = await confirmAction({
      title: "Desconectar conta?",
      message: `"${c.apelido}" deixará de sincronizar. Os dados já importados continuam no Painel J.`,
      confirmLabel: "Desconectar",
      danger: true,
    });
    if (!ok) return;
    removeConta(c.id);
    toast.success("Conta desconectada");
  };

  return (
    <Screen
      eyebrow="Integrações"
      title="Conexões"
      actions={
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Conectar conta
        </button>
      }
    >
      {/* the whole page is a preview — say so once, plainly, at the top */}
      <div className="mb-4 flex items-start gap-2.5 rounded-card border border-amber/40 bg-amberSoft px-4 py-3">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />
        <p className="text-sm leading-relaxed text-txtDim">
          <strong className="text-amber">Prévia da integração.</strong> As conexões abaixo são
          simuladas — nenhuma conta real é acessada e nenhum dado vem da Amazon ainda. Serve para
          validar o fluxo antes de ligarmos a API de verdade.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {contas.length === 0 ? (
          <GlowCard accent="gold" grid className="col-span-12">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-chip bg-goldSoft">
                <Plug size={24} className="text-gold" />
              </span>
              <p className="font-display text-2xl text-txt">Nenhuma conta conectada</p>
              <p className="max-w-md text-sm text-txtDim">
                Conecte uma conta de vendedor Amazon para que os pedidos, as taxas e os anúncios
                entrem no Painel J automaticamente.
              </p>
              <button
                onClick={() => setModal(true)}
                className="mt-1 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
              >
                <Plus size={15} /> Conectar conta
              </button>
            </div>
          </GlowCard>
        ) : (
          contas.map((c, i) => (
            <GlowCard key={c.id} accent="green" delay={0.05 * i} className="col-span-12 lg:col-span-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                      <ShoppingCart size={15} className="text-green" strokeWidth={2} />
                    </span>
                    <span className="font-display text-base text-txt">{c.apelido}</span>
                    {c.simulada && (
                      <span
                        className="rounded-full border border-lineStrong bg-neutroSoft px-2.5 py-1 font-mono text-[10px] text-txtDim"
                        title="Ligação de demonstração — sem acesso real à Amazon"
                      >
                        simulada
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2">
                    <Dado termo="Marketplace" valor={c.marketplace} />
                    <Dado termo="Região" valor={c.regiao} />
                    <Dado termo="Seller ID" valor={mascarar(c.sellerId)} />
                  </dl>
                </div>
              </div>

              {/* one row per API — each is its own authorization, with its own sync */}
              <div className="mt-4 flex flex-col gap-2">
                {(["sp-api", "ads-api"] as ServicoAmazon[]).map((sv) => {
                  const conexao = c.conexoes.find((x) => x.servico === sv);
                  const chave = `${c.id}·${sv}`;
                  const carregando = sincronizando === chave;
                  return (
                    <div key={sv} className="rounded-card border border-line bg-bgRaise/40 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm text-txt">{SERVICO[sv].nome}</span>
                        <span className="font-mono text-[10px] text-txtFaint">{SERVICO[sv].api}</span>
                        {conexao ? (
                          <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${STATUS[conexao.status].cls}`}>
                            {STATUS[conexao.status].label}
                          </span>
                        ) : (
                          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtFaint">
                            Não autorizado
                          </span>
                        )}
                      </div>

                      {conexao ? (
                        <>
                          <p className="mt-2 font-mono text-[11px] text-txtFaint">
                            {SERVICO[sv].traz} · última sincronização{" "}
                            {conexao.ultimaSync ? datetime(conexao.ultimaSync) : "nunca"}
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <button
                              onClick={() => sincronizar(c, sv)}
                              disabled={carregando}
                              className="flex items-center gap-2 rounded-chip border border-line px-3 py-1.5 font-mono text-xs text-txtDim transition-colors hover:text-txt disabled:opacity-50"
                            >
                              <RefreshCw size={13} className={carregando ? "animate-spin" : ""} />
                              {carregando ? "Sincronizando…" : "Sincronizar"}
                            </button>
                            <button
                              onClick={() => desconectarServico(c, sv)}
                              className="flex items-center gap-2 rounded-chip border border-line px-3 py-1.5 font-mono text-xs text-txtDim transition-colors hover:text-danger"
                            >
                              <Unplug size={13} /> Revogar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="mt-2 font-mono text-[11px] leading-relaxed text-txtFaint">
                            Aprovação separada na Amazon. Sem ela, {SERVICO[sv].traz.toLowerCase()} não entra.
                          </p>
                          <button
                            onClick={() => conectarServico(c, sv)}
                            className="mt-2.5 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-3 py-1.5 font-mono text-xs text-txt transition-opacity hover:opacity-90"
                          >
                            <Plus size={13} /> Autorizar
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => desconectar(c)}
                className="mt-3 flex items-center gap-2 font-mono text-xs text-txtFaint transition-colors hover:text-danger"
              >
                <Unplug size={13} /> Remover conta
              </button>
            </GlowCard>
          ))
        )}
      </div>

      {/* platforms that aren't even simulated yet */}
      <p className="mb-3 mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-txtFaint">
        Outras plataformas
      </p>
      <div className="grid grid-cols-12 gap-4">
        {INTEGRACOES.map((it, i) => {
          const Icon = it.icon;
          return (
            <GlowCard key={it.nome} delay={0.05 * i} className="col-span-12 opacity-70 sm:col-span-6 lg:col-span-4">
              <div className="flex items-center gap-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
                  <Icon size={15} className="text-green" strokeWidth={2} />
                </span>
                <span className="font-display text-sm text-txt">{it.nome}</span>
              </div>
              <p className="mt-3 text-xs text-txtDim">{it.desc}</p>
              <span className="mt-3 inline-block rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-txtFaint">
                Em breve
              </span>
            </GlowCard>
          );
        })}
      </div>

      <ConectarConta aberto={modal} onFechar={() => setModal(false)} onConectada={conectada} />
    </Screen>
  );
}

function Dado({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">{termo}</dt>
      <dd className="truncate font-mono text-sm text-txt" title={valor}>
        {valor}
      </dd>
    </div>
  );
}
