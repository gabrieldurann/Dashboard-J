import { Globe, Landmark, LayoutGrid, Moon, Plus, RotateCcw, Store, Sun, Trash2, Truck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { CONFIG_PADRAO, IMPOSTO_POR_PAIS, type Configuracoes as Cfg } from "../calc/constants";
import { calcularMetricas } from "../calc/engine";
import { Field, NumberInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { PAISES } from "../data/countries";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, percent } from "../i18n/format";
import { confirmAction } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useConfig } from "../store/useConfig";
import { useStore } from "../store/useStore";

// Rates change often (and differ by marketplace/country), so they live here instead of in code.
// Everything on this page feeds the calc engine, so edits reprice the whole app immediately.

/** A percentage stored as a fraction (0.04) but edited as a number (4). */
function PercentField({
  label,
  hint,
  valor,
  onValor,
}: {
  label: string;
  hint?: string;
  valor: number;
  onValor: (v: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <NumberInput value={Math.round(valor * 10000) / 100} onValue={(v) => onValor((v ?? 0) / 100)} unit="%" mostrarZero />
    </Field>
  );
}

function Secao({
  icone: Icone,
  titulo,
  descricao,
  children,
  className = "",
  delay = 0,
}: {
  icone: typeof Landmark;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <GlowCard className={className} delay={delay}>
      <div className="flex items-center gap-2">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-greenSoft">
          <Icone size={15} className="text-green" strokeWidth={2} />
        </span>
        <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">{titulo}</span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-txtFaint">{descricao}</p>
      <div className="mt-4">{children}</div>
    </GlowCard>
  );
}

export function Configuracoes() {
  const cfg = useConfig();
  const setCfg = useStore((s) => s.setConfiguracoes);
  const resetCfg = useStore((s) => s.resetConfiguracoes);
  const tema = useStore((s) => s.tema);
  const setTema = useStore((s) => s.setTema);
  const cardsOcultos = useStore((s) => s.cardsOcultos);
  const mostrarCards = useStore((s) => s.mostrarCards);
  const produtos = useStore((s) => s.produtos);
  const pesquisas = useStore((s) => s.pesquisas);
  const aplicarTaxasPadrao = useStore((s) => s.aplicarTaxasPadrao);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg({ [k]: v } as Partial<Cfg>);

  // items still carrying a rate of their own that differs from the current default
  const desatualizados = [...produtos, ...pesquisas].filter(
    (p) => p.imposto !== cfg.imposto || p.comissao !== cfg.comissao,
  ).length;

  const aplicarATodos = async () => {
    const ok = await confirmAction({
      title: "Aplicar as taxas a todos os itens?",
      message: `${desatualizados} produto(s)/pesquisa(s) passarão a usar imposto ${percent(cfg.imposto)} e comissão ${percent(
        cfg.comissao,
      )}. As taxas próprias que eles tinham serão substituídas.`,
      confirmLabel: "Aplicar",
    });
    if (!ok) return;
    aplicarTaxasPadrao();
    toast.success("Taxas aplicadas a todos os itens");
  };

  const alterado = (Object.keys(CONFIG_PADRAO) as (keyof Cfg)[]).filter((k) => cfg[k] !== CONFIG_PADRAO[k]);

  // live preview: a reference product priced with the current rates, so the effect is visible
  const exemplo = useMemo(
    () =>
      calcularMetricas(
        { id: "ex", nome: "Exemplo", precoVenda: 50, vendasMes: 30, custoUnit: 20, qtdCaixa: 100, imposto: cfg.imposto, comissao: cfg.comissao },
        cfg,
      ),
    [cfg],
  );

  const bandasInvalidas = cfg.margemVermelho > cfg.margemAmarelo;

  const restaurar = async () => {
    const ok = await confirmAction({
      title: "Restaurar padrões?",
      message: "As taxas voltam aos valores originais da planilha. Seus produtos e vendas não são alterados.",
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    resetCfg();
    toast.success("Configurações restauradas");
  };

  return (
    <Screen
      eyebrow="Ajustes"
      title="Configurações"
      actions={
        alterado.length > 0 && (
          <button
            onClick={restaurar}
            className="flex items-center gap-2 rounded-chip border border-line px-3 py-2.5 font-mono text-sm text-txtDim transition-colors hover:text-txt"
          >
            <RotateCcw size={15} /> Restaurar padrões
          </button>
        )
      }
    >
      <div className="grid grid-cols-12 gap-4">
        {alterado.length > 0 && (
          <GlowCard accent="gold" className="col-span-12">
            <p className="font-mono text-xs text-txtDim">
              <span className="text-gold">{alterado.length}</span> valor(es) diferente(s) do padrão da planilha. As
              mudanças valem para <span className="text-txt">todos os cálculos</span>, inclusive os históricos.
            </p>
          </GlowCard>
        )}

        {/* appearance */}
        <Secao
          icone={tema === "claro" ? Sun : Moon}
          titulo="Aparência"
          descricao="O tema fica salvo neste navegador — cada pessoa escolhe o seu."
          className="col-span-12"
        >
          <div className="flex flex-wrap gap-3">
            {(
              [
                { id: "escuro", label: "Escuro", desc: "O HUD original, para uso prolongado", Icone: Moon },
                { id: "claro", label: "Claro", desc: "Melhor sob luz forte ou para projetar", Icone: Sun },
              ] as const
            ).map(({ id, label, desc, Icone }) => {
              const ativo = tema === id;
              return (
                <button
                  key={id}
                  onClick={() => setTema(id)}
                  className={`flex min-w-[210px] flex-1 items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${
                    ativo ? "border-lineStrong bg-greenSoft" : "border-line hover:border-lineStrong"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${
                      ativo ? "bg-greenSoft text-green" : "bg-bgRaise text-txtDim"
                    }`}
                  >
                    <Icone size={17} strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm ${ativo ? "text-txt" : "text-txtDim"}`}>{label}</span>
                    <span className="block font-mono text-[10.5px] text-txtFaint">{desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Secao>

        <Secao
          icone={Store}
          titulo="Lojas"
          descricao="Cada venda, compra, custo e devolução pertence a uma loja. O seletor na barra lateral filtra o app inteiro."
          className="col-span-12"
          delay={0.05}
        >
          <GerenciarLojas />
        </Secao>

        <Secao
          icone={Globe}
          titulo="Imposto por país de destino"
          descricao="A venda é tributada onde ela chegou: o país vence a taxa do produto. Deixe em branco para usar a taxa do produto."
          className="col-span-12"
          delay={0.07}
        >
          <ImpostosPorPais cfg={cfg} onChange={setCfg} />
        </Secao>

        {/* taxes & commission */}
        <Secao
          icone={Landmark}
          titulo="Impostos e comissão"
          descricao="Padrão para novos produtos e pesquisas — cada produto guarda a sua própria taxa."
          className="col-span-12 lg:col-span-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <PercentField label="Imposto padrão" hint="Planilha: 4%" valor={cfg.imposto} onValor={(v) => set("imposto", v)} />
            <PercentField label="Comissão padrão" hint="Planilha: 15%" valor={cfg.comissao} onValor={(v) => set("comissao", v)} />
          </div>

          {/* the rates above only seed NEW items — this pushes them onto what already exists */}
          <div className="mt-4 border-t border-line pt-3">
            {desatualizados === 0 ? (
              <p className="font-mono text-[11px] text-txtFaint">
                Todos os {produtos.length + pesquisas.length} itens já usam estas taxas.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] text-txtFaint">
                  <span className="text-gold">{desatualizados}</span> item(ns) ainda usam taxas próprias diferentes.
                </p>
                <button
                  onClick={aplicarATodos}
                  className="rounded-chip border border-lineStrong bg-goldSoft px-3 py-1.5 font-mono text-[11px] text-gold transition-opacity hover:opacity-90"
                >
                  Aplicar a todos
                </button>
              </div>
            )}
          </div>
        </Secao>

        {/* freight */}
        <Secao
          icone={Truck}
          titulo="Frete"
          descricao="Regra global: cobrado por unidade, grátis acima do valor definido."
          className="col-span-12 lg:col-span-6"
          delay={0.05}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Frete por unidade" hint="Planilha: R$ 5,65 · 0 = sem frete">
              <NumberInput value={cfg.freteUnit} onValue={(v) => set("freteUnit", v ?? 0)} unit="R$" mostrarZero />
            </Field>
            <Field label="Frete grátis acima de" hint="Planilha: R$ 79,00">
              <NumberInput value={cfg.freteGratisAcima} onValue={(v) => set("freteGratisAcima", v ?? 0)} unit="R$" mostrarZero />
            </Field>
          </div>
        </Secao>

        {/* health bands */}
        <Secao
          icone={TriangleAlert}
          titulo="Faixas de margem"
          descricao="Definem quando um produto aparece como ruim, mediano ou bom em todo o app."
          className="col-span-12 lg:col-span-7"
          delay={0.1}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PercentField label="Ruim abaixo de" valor={cfg.margemVermelho} onValor={(v) => set("margemVermelho", v)} />
            <PercentField label="Mediano até" valor={cfg.margemAmarelo} onValor={(v) => set("margemAmarelo", v)} />
            <PercentField label="Aprovar a partir de" hint="Verdito automático" valor={cfg.margemAprovacao} onValor={(v) => set("margemAprovacao", v)} />
          </div>
          {bandasInvalidas && (
            <p className="mt-3 font-mono text-[11px] text-danger">
              A faixa &quot;ruim&quot; está acima da &quot;mediana&quot; — nenhum produto ficará amarelo.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3">
            <span className="flex items-center gap-2">
              <StatusDot cor="vermelho" />
              <span className="font-mono text-[11px] text-txtFaint">&lt; {percent(cfg.margemVermelho)}</span>
            </span>
            <span className="flex items-center gap-2">
              <StatusDot cor="amarelo" />
              <span className="font-mono text-[11px] text-txtFaint">
                {percent(cfg.margemVermelho)} – {percent(cfg.margemAmarelo)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <StatusDot cor="verde" />
              <span className="font-mono text-[11px] text-txtFaint">&gt; {percent(cfg.margemAmarelo)}</span>
            </span>
          </div>
        </Secao>

        {/* live preview so the numbers aren't abstract */}
        <GlowCard accent="green" grid className="col-span-12 lg:col-span-5" delay={0.15}>
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Prévia</span>
          <p className="mt-1 font-mono text-[11px] text-txtFaint">
            Produto de exemplo: venda {money(50)} · custo {money(20)}
          </p>
          <div className="mt-4 flex items-end justify-between border-b border-line pb-3">
            <div>
              <div className="eyebrow mb-1">Margem</div>
              <span className="font-mono text-3xl font-semibold tabular-nums text-txt">{percent(exemplo.margem)}</span>
            </div>
            <StatusDot cor={exemplo.statusCor} label />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
            {[
              ["Valor líquido", money(exemplo.valorLiquido)],
              ["Frete / un", exemplo.freteUnit === 0 ? "Grátis" : money(exemplo.freteUnit)],
              ["Lucro / un", money(exemplo.lucroUnit)],
              ["Aprovado", exemplo.aprovado ? "Sim" : "Não"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2">
                <dt className="text-txtFaint">{k}</dt>
                <dd className="tabular-nums text-txt">{v}</dd>
              </div>
            ))}
          </dl>
        </GlowCard>

        {/* dashboard display */}
        <Secao
          icone={LayoutGrid}
          titulo="Exibição do Painel"
          descricao="Os cards que você escondeu com o ícone de olho ficam guardados aqui."
          className="col-span-12"
          delay={0.2}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-txt">
              {cardsOcultos.length === 0
                ? "Nenhum card oculto."
                : `${cardsOcultos.length} card(s) oculto(s) no Painel.`}
            </span>
            {cardsOcultos.length > 0 && (
              <button
                onClick={() => {
                  mostrarCards(cardsOcultos);
                  toast.success("Todos os cards foram restaurados");
                }}
                className="rounded-chip border border-lineStrong bg-greenSoft px-4 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90"
              >
                Mostrar todos os cards
              </button>
            )}
          </div>
        </Secao>
      </div>
    </Screen>
  );
}

/**
 * Add, rename and remove storefronts.
 *
 * Removing one is the dangerous direction: its sales, purchases, costs and returns would be left
 * pointing at a store that no longer exists — visible only under "Todas", and silently missing
 * from every scoped figure. So a store that still owns records cannot be deleted; the count says
 * what is in the way.
 */
function GerenciarLojas() {
  const lojas = useStore((s) => s.lojas);
  const addLoja = useStore((s) => s.addLoja);
  const updateLoja = useStore((s) => s.updateLoja);
  const removeLoja = useStore((s) => s.removeLoja);
  const vendas = useStore((s) => s.vendas);
  const compras = useStore((s) => s.compras);
  const devolucoes = useStore((s) => s.devolucoes);
  const custos = useStore((s) => s.custosOperacionais);
  const anuncios = useStore((s) => s.anunciosAds);
  const [nova, setNova] = useState("");

  const registrosDe = (id: string) =>
    [vendas, compras, devolucoes, custos, anuncios].reduce(
      (total, colecao) => total + colecao.filter((r) => r.lojaId === id).length,
      0,
    );

  const criar = () => {
    const nome = nova.trim();
    if (!nome) return;
    addLoja({ id: crypto.randomUUID(), nome });
    setNova("");
    toast.success("Loja criada");
  };

  const excluir = async (id: string, nome: string) => {
    const n = registrosDe(id);
    if (n > 0) {
      await confirmAction({
        title: "Não dá para excluir esta loja",
        message: `"${nome}" ainda tem ${n} ${n === 1 ? "registro" : "registros"}. Mova ou exclua esses registros primeiro — sem isso eles ficariam apontando para uma loja que não existe mais.`,
        confirmLabel: "Entendi",
      });
      return;
    }
    const ok = await confirmAction({
      title: "Excluir loja?",
      message: `"${nome}" será removida. Nenhum registro pertence a ela.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeLoja(id);
    toast.success("Loja excluída");
  };

  return (
    <div className="flex flex-col gap-2">
      {lojas.map((l) => {
        const n = registrosDe(l.id);
        return (
          <div key={l.id} className="flex items-center gap-3 rounded-chip border border-line px-3 py-2">
            <Store size={14} className="shrink-0 text-txtFaint" />
            <input
              value={l.nome}
              onChange={(e) => updateLoja(l.id, { nome: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm text-txt outline-none"
            />
            <span className="shrink-0 font-mono text-[11px] text-txtFaint">
              {n} {n === 1 ? "registro" : "registros"}
            </span>
            <button
              onClick={() => excluir(l.id, l.nome)}
              title={n > 0 ? `${n} registros ainda apontam para esta loja` : "Excluir loja"}
              className={`shrink-0 transition-colors ${n > 0 ? "text-txtFaint" : "text-txtDim hover:text-danger"}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}

      <div className="mt-1 flex items-center gap-2">
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
          placeholder="Nome da nova loja"
          className="min-w-0 flex-1 rounded-chip border border-line bg-panel px-3 py-2 text-sm text-txt outline-none placeholder:text-txtFaint"
        />
        <button
          onClick={criar}
          disabled={!nova.trim()}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-3 py-2 font-mono text-xs text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>
    </div>
  );
}

/**
 * Destination tax rates, one row per country the app knows about.
 *
 * Editable because the correct number depends on the regime, the marketplace and the product
 * category — the app ships defaults, not truths. An empty box means "no country rule", and the
 * sale falls back to the product's own rate.
 */
function ImpostosPorPais({ cfg, onChange }: { cfg: Cfg; onChange: (patch: Partial<Cfg>) => void }) {
  const tabela = cfg.impostosPorPais ?? IMPOSTO_POR_PAIS;
  const set = (code: string, valor: number | undefined) => {
    const proxima = { ...tabela };
    if (valor === undefined) delete proxima[code];
    else proxima[code] = valor / 100;
    onChange({ impostosPorPais: proxima });
  };
  const padrao = JSON.stringify(tabela) === JSON.stringify(IMPOSTO_POR_PAIS);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {PAISES.map((p) => (
          <label key={p.code} className="flex items-center gap-2 rounded-chip border border-line px-2.5 py-1.5 [&_input]:w-[88px]">
            <span className="shrink-0 text-base leading-none">{p.flag}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-txtDim" title={p.nome}>
              {p.nome}
            </span>
            <NumberInput
              value={tabela[p.code] !== undefined ? +(tabela[p.code] * 100).toFixed(2) : undefined}
              onValue={(v) => set(p.code, v === undefined || v === null ? undefined : v)}
              unit="%"
              allowEmpty
              mostrarZero
            />
          </label>
        ))}
      </div>
      {!padrao && (
        <button
          onClick={() => onChange({ impostosPorPais: { ...IMPOSTO_POR_PAIS } })}
          className="w-fit rounded-chip border border-line px-3 py-1.5 font-mono text-xs text-txtDim transition-colors hover:text-txt"
        >
          Restaurar taxas padrão
        </button>
      )}
    </div>
  );
}
