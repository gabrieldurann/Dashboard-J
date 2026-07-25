import { Calculator, ClipboardList, FolderOpen, Package, Save, Trash2, TriangleAlert } from "lucide-react";
import { Tooltip } from "../components/Tooltip";
import { useMemo, useState } from "react";
import type { Configuracoes } from "../calc/constants";
import { calcularMetricas, capitalParaEstoque, mesmoNome, precoParaMargem } from "../calc/engine";
import type { CalculoSalvo, Pesquisa, Produto } from "../calc/types";
import { Field, NumberInput, TextInput } from "../components/Field";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { date, money, percent } from "../i18n/format";

import { useStore } from "../store/useStore";
import { confirmAction } from "../store/useConfirm";
import { askDuplicate } from "../store/useDuplicatePrompt";
import { toast } from "../store/useToast";
import { useConfig } from "../store/useConfig";
import { useStatusCores } from "../theme/useCores";

/** Common shape extracted from the calculator (current form or a saved calc) to seed a Produto/Pesquisa. */
type DadosCalc = {
  nome: string;
  fornecedor?: string;
  custoUnit: number;
  imposto: number;
  comissao: number;
  custoEmbalagem: number;
  qtdCaixa: number;
  precoSugerido: number;
};

type Form = {
  nome: string;
  fornecedor: string;
  custoUnit: number;
  imposto: number;
  comissao: number;
  custoEmbalagem: number;
  qtdCaixa: number;
  margemDesejada: number; // mode "precoDaMargem"
  room: number;
  precoVenda: number; // mode "margemDoPreco"
};

const inicial = (cfg: Configuracoes): Form => ({
  nome: "",
  fornecedor: "",
  custoUnit: 0,
  imposto: cfg.imposto,
  comissao: cfg.comissao,
  custoEmbalagem: 0,
  qtdCaixa: 0,
  margemDesejada: 0.15,
  room: 0.03,
  precoVenda: 0,
});

type Modo = "precoDaMargem" | "margemDoPreco";

export function Calculadora() {
  const statusCores = useStatusCores();
  const cfg = useConfig();
  const [f, setF] = useState<Form>(() => inicial(cfg));
  const [modo, setModo] = useState<Modo>("precoDaMargem");
  const calculos = useStore((s) => s.calculosSalvos);
  const addCalculo = useStore((s) => s.addCalculo);
  const removeCalculo = useStore((s) => s.removeCalculo);
  const produtos = useStore((s) => s.produtos);
  const pesquisas = useStore((s) => s.pesquisas);
  const addProduto = useStore((s) => s.addProduto);
  const removeProduto = useStore((s) => s.removeProduto);
  const addPesquisa = useStore((s) => s.addPesquisa);
  const removePesquisa = useStore((s) => s.removePesquisa);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // Save the calculator's product to Produtos or Pesquisas (ideas #9/#10), prompting on a duplicate name.
  const salvarEm = async (destino: "produtos" | "pesquisas", dados: DadosCalc) => {
    const nome = dados.nome.trim();
    if (!nome) {
      toast.error("Dê um nome ao produto antes de salvar");
      return;
    }
    const lista = destino === "produtos" ? produtos : pesquisas;
    const dups = mesmoNome(lista, nome);
    if (dups.length > 0) {
      const escolha = await askDuplicate({
        nome,
        destino: destino === "produtos" ? "Produtos" : "Pesquisas",
        quantidade: dups.length,
      });
      if (escolha === "cancelar") return;
      if (escolha === "substituir") {
        const remover = destino === "produtos" ? removeProduto : removePesquisa;
        dups.forEach((d) => remover(d.id));
      }
    }
    const base = {
      nome,
      fornecedor: dados.fornecedor?.trim() || undefined,
      precoVenda: +dados.precoSugerido.toFixed(2),
      vendasMes: 0,
      custoUnit: dados.custoUnit,
      qtdCaixa: dados.qtdCaixa,
      imposto: dados.imposto,
      comissao: dados.comissao,
      aprovadoManual: null as boolean | null,
    };
    if (destino === "produtos") {
      const novo: Produto = {
        id: crypto.randomUUID(),
        ...base,
        custoEmbalagem: dados.custoEmbalagem || undefined,
      };
      addProduto(novo);
      toast.success("Salvo em Produtos");
    } else {
      const nova: Pesquisa = {
        id: crypto.randomUUID(),
        ...base,
        dataPesquisa: new Date().toISOString().slice(0, 10),
      };
      addPesquisa(nova);
      toast.success("Salvo em Pesquisas");
    }
  };

  const dadosDoForm = (): DadosCalc => ({
    nome: f.nome,
    fornecedor: f.fornecedor,
    custoUnit: f.custoUnit,
    imposto: f.imposto,
    comissao: f.comissao,
    custoEmbalagem: f.custoEmbalagem,
    qtdCaixa: f.qtdCaixa,
    precoSugerido: precoFinal,
  });

  const dadosDoCalc = (c: CalculoSalvo): DadosCalc => ({
    nome: c.nome,
    fornecedor: c.fornecedor,
    custoUnit: c.custoUnit,
    imposto: c.imposto,
    comissao: c.comissao,
    custoEmbalagem: c.custoEmbalagem,
    qtdCaixa: 0,
    precoSugerido: c.precoSugerido,
  });

  // mode "precoDaMargem": solve the price for a target margin
  const r = useMemo(
    () =>
      precoParaMargem(
        {
          custoUnit: f.custoUnit,
          margemDesejada: f.margemDesejada,
          imposto: f.imposto,
          comissao: f.comissao,
          custoEmbalagem: f.custoEmbalagem,
          room: f.room,
        },
        cfg,
      ),
    [f, cfg],
  );
  // mode "margemDoPreco": given a price, what's the resulting margin? (auto-recalcs as inputs change)
  const m = useMemo(
    () =>
      calcularMetricas(
        {
          id: "calc",
          nome: f.nome,
          precoVenda: f.precoVenda,
          vendasMes: 0,
          custoUnit: f.custoUnit,
          qtdCaixa: f.qtdCaixa,
          imposto: f.imposto,
          comissao: f.comissao,
          custoEmbalagem: f.custoEmbalagem,
          aprovadoManual: null,
        },
        cfg,
      ),
    [f, cfg],
  );
  const capital = capitalParaEstoque(f.custoUnit, f.qtdCaixa);

  // the price/margin to use depends on the active mode
  const precoFinal = modo === "precoDaMargem" ? r.precoSugerido : f.precoVenda;
  const margemFinal = modo === "precoDaMargem" ? f.margemDesejada : m.margem;
  const valido =
    f.custoUnit > 0 &&
    (modo === "precoDaMargem" ? Number.isFinite(r.precoSugerido) : f.precoVenda > 0);

  const salvar = () => {
    if (!valido) return;
    const c: CalculoSalvo = {
      id: crypto.randomUUID(),
      nome: f.nome.trim() || "Cálculo sem nome",
      custoUnit: f.custoUnit,
      fornecedor: f.fornecedor || undefined,
      imposto: f.imposto,
      comissao: f.comissao,
      custoEmbalagem: f.custoEmbalagem,
      margemDesejada: margemFinal,
      precoSugerido: precoFinal,
      criadoEm: new Date().toISOString(),
    };
    addCalculo(c);
    toast.success("Cálculo salvo");
  };

  const excluirCalculo = async (c: CalculoSalvo) => {
    const ok = await confirmAction({
      title: "Excluir cálculo?",
      message: `"${c.nome}" será removido dos cálculos salvos.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    removeCalculo(c.id);
    toast.success("Cálculo excluído");
  };

  const carregar = (c: CalculoSalvo) =>
    setF((p) => ({
      ...p,
      nome: c.nome,
      fornecedor: c.fornecedor ?? "",
      custoUnit: c.custoUnit,
      imposto: c.imposto,
      comissao: c.comissao,
      custoEmbalagem: c.custoEmbalagem,
      margemDesejada: c.margemDesejada,
      precoVenda: c.precoSugerido,
    }));

  return (
    <Screen
      eyebrow="Precificação"
      title="Calculadora de Margem"
      subtitle="Calcule o preço a partir da margem, ou a margem a partir do preço. Não altera seus produtos."
    >
      <div className="grid grid-cols-12 gap-4">
        {/* inputs */}
        <div className="col-span-12 lg:col-span-7">
          <GlowCard>
            {/* mode toggle */}
            <div className="mb-4">
              <div className="flex gap-1 rounded-chip border border-line p-1">
                <button
                  onClick={() => setModo("precoDaMargem")}
                  className={`flex-1 rounded-chip px-3 py-2 font-mono text-xs transition-colors ${
                    modo === "precoDaMargem" ? "bg-greenSoft text-txt" : "text-txtDim hover:text-txt"
                  }`}
                >
                  Preço a partir da margem
                </button>
                <button
                  onClick={() => setModo("margemDoPreco")}
                  className={`flex-1 rounded-chip px-3 py-2 font-mono text-xs transition-colors ${
                    modo === "margemDoPreco" ? "bg-greenSoft text-txt" : "text-txtDim hover:text-txt"
                  }`}
                >
                  Margem a partir do preço
                </button>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-txtFaint">
                {modo === "precoDaMargem"
                  ? "Defina a margem desejada → a calculadora sugere o preço de venda (com folga e impacto do frete)."
                  : "Defina o preço de venda → a calculadora mostra a margem resultante e a saúde (verde/amarelo/vermelho). Recalcula sozinho ao alterar."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Nome do produto" hint="Opcional — só para salvar">
                  <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Mini ventilador USB" />
                </Field>
              </div>
              <Field label="Fornecedor">
                <TextInput value={f.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
              </Field>
              <Field label="Custo fornecedor (un)">
                <NumberInput value={f.custoUnit} onValue={(v) => set("custoUnit", v ?? 0)} unit="R$" />
              </Field>
              {modo === "precoDaMargem" ? (
                <>
                  <Field label="Margem desejada">
                    <NumberInput
                      value={Math.round(f.margemDesejada * 1000) / 10}
                      onValue={(v) => set("margemDesejada", (v ?? 0) / 100)}
                      unit="%"
                    />
                  </Field>
                  <Field label="Folga ±" hint="Faixa de preço sugerida">
                    <NumberInput
                      value={Math.round(f.room * 1000) / 10}
                      onValue={(v) => set("room", (v ?? 0) / 100)}
                      unit="%"
                    />
                  </Field>
                </>
              ) : (
                <Field label="Preço de venda" hint="Quanto você quer cobrar">
                  <NumberInput value={f.precoVenda} onValue={(v) => set("precoVenda", v ?? 0)} unit="R$" />
                </Field>
              )}
              <Field label="Imposto" hint="Padrão 4%">
                <NumberInput value={Math.round(f.imposto * 1000) / 10} onValue={(v) => set("imposto", (v ?? 0) / 100)} unit="%"
                  mostrarZero />
              </Field>
              <Field label="Comissão categoria" hint="11–15%">
                <NumberInput value={Math.round(f.comissao * 1000) / 10} onValue={(v) => set("comissao", (v ?? 0) / 100)} unit="%"
                  mostrarZero />
              </Field>
              <Field label="Custo embalagem/branding (un)" hint="Opcional">
                <NumberInput value={f.custoEmbalagem} onValue={(v) => set("custoEmbalagem", v ?? 0)} unit="R$" />
              </Field>
              <Field label="Qtd. por caixa" hint="Para o capital de estoque">
                <NumberInput value={f.qtdCaixa} onValue={(v) => set("qtdCaixa", v ?? 0)} />
              </Field>
            </div>

            <button
              onClick={salvar}
              disabled={!valido}
              className="mt-6 flex items-center gap-2 rounded-chip border border-lineStrong bg-greenSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={15} /> Salvar cálculo
            </button>
          </GlowCard>
        </div>

        {/* result */}
        <div className="col-span-12 lg:col-span-5">
          <GlowCard accent="gold" grid className="lg:sticky lg:top-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-chip bg-goldSoft">
                <Calculator size={15} className="text-gold" strokeWidth={2} />
              </span>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">
                {modo === "precoDaMargem" ? "Preço sugerido" : "Margem resultante"}
              </span>
            </div>

            {!valido ? (
              <div className="flex items-start gap-2 py-6 text-sm text-txtDim">
                <TriangleAlert size={16} className="mt-0.5 text-amber" />
                <span>
                  {modo === "precoDaMargem"
                    ? "Informe um custo válido. A soma imposto + comissão + margem precisa ser menor que 100%."
                    : "Informe um custo e um preço de venda válidos."}
                </span>
              </div>
            ) : (
              <>
                {modo === "precoDaMargem" ? (
                  <>
                    <div className="border-b border-line pb-4">
                      <span className="font-mono text-5xl font-semibold tabular-nums text-gold">{money(r.precoSugerido)}</span>
                      <p className="mt-2 font-mono text-xs text-txtDim">
                        Faixa: <span className="text-txt">{money(r.faixaMin)}</span> — <span className="text-txt">{money(r.faixaMax)}</span>
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <Row label="Margem alvo" value={percent(f.margemDesejada)} accent />
                      <Row label="Preço sem frete" value={money(r.precoSemFrete)} />
                      <Row label="Impacto do frete" value={`+ ${money(r.impactoFrete)}`} />
                      <Row label="Capital p/ 1 caixa" value={money(capital)} />
                    </div>
                    <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] leading-relaxed text-txtFaint">
                      O frete acrescenta {money(r.impactoFrete)} ao preço para manter a margem. Acima de R$79 o frete é
                      grátis — por isso o "preço sem frete".
                    </p>
                  </>
                ) : (
                  <>
                    <div className="border-b border-line pb-4">
                      <span className="font-mono text-5xl font-semibold tabular-nums" style={{ color: statusCores[m.statusCor] }}>
                        {percent(m.margem)}
                      </span>
                      <p className="mt-2 font-mono text-xs text-txtDim">
                        {m.statusCor === "verde" ? "Margem saudável" : m.statusCor === "amarelo" ? "Pode melhorar" : "Abaixo do ideal"} ·
                        lucro {money(m.lucroUnit)}/un
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <Row label="Preço de venda" value={money(f.precoVenda)} accent />
                      <Row label="Lucro / unidade" value={money(m.lucroUnit)} />
                      <Row label="Valor líquido" value={money(m.valorLiquido)} />
                      <Row label="Frete embutido" value={money(m.freteUnit)} />
                      <Row label="Lucro / caixa" value={money(m.lucroCaixa)} />
                      <Row label="Capital p/ 1 caixa" value={money(capital)} />
                    </div>
                    <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] leading-relaxed text-txtFaint">
                      Margem = lucro por unidade ÷ preço de venda. Bandas: vermelho &lt; 11% · amarelo 11–15% · verde &gt; 15%.
                    </p>
                  </>
                )}

                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => salvarEm("produtos", dadosDoForm())}
                      className="flex flex-1 items-center justify-center gap-2 rounded-chip border border-green/40 bg-greenSoft px-3 py-2 font-mono text-xs text-green transition-opacity hover:opacity-90"
                    >
                      <Package size={14} /> Salvar em Produtos
                    </button>
                    <button
                      onClick={() => salvarEm("pesquisas", dadosDoForm())}
                      className="flex flex-1 items-center justify-center gap-2 rounded-chip border border-gold/40 bg-goldSoft px-3 py-2 font-mono text-xs text-gold transition-opacity hover:opacity-90"
                    >
                      <ClipboardList size={14} /> Salvar em Pesquisas
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-txtFaint">
                    <span className="text-green">Produtos</span> = catálogo que você já vende (entra no estoque).{" "}
                    <span className="text-gold">Pesquisas</span> = candidato ainda em avaliação. Se o nome já existir,
                    você decide substituir ou manter os dois.
                  </p>
                </div>
              </>
            )}
          </GlowCard>
        </div>

        {/* saved */}
        <div className="col-span-12">
          <GlowCard delay={0.1}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Cálculos salvos</span>
              <span className="font-mono text-xs text-txtFaint">{calculos.length} salvos</span>
            </div>
            {calculos.length === 0 ? (
              <p className="py-6 text-center text-sm text-txtDim">Nenhum cálculo salvo ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {calculos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-txt">{c.nome}</div>
                      <div className="font-mono text-[11px] text-txtFaint">
                        custo {money(c.custoUnit)} · margem {percent(c.margemDesejada)} · {date(c.criadoEm)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <span className="font-mono text-sm tabular-nums text-gold">{money(c.precoSugerido)}</span>
                      <Tooltip label="Salvar em Produtos">
                        <button
                          onClick={() => salvarEm("produtos", dadosDoCalc(c))}
                          className="text-txtDim transition-colors hover:text-green"
                          aria-label="Salvar em Produtos"
                        >
                          <Package size={15} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Salvar em Pesquisas">
                        <button
                          onClick={() => salvarEm("pesquisas", dadosDoCalc(c))}
                          className="text-txtDim transition-colors hover:text-gold"
                          aria-label="Salvar em Pesquisas"
                        >
                          <ClipboardList size={15} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Abrir cálculo">
                        <button
                          onClick={() => carregar(c)}
                          className="text-txtDim transition-colors hover:text-green"
                          aria-label="Abrir cálculo"
                        >
                          <FolderOpen size={15} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Excluir">
                        <button
                          onClick={() => excluirCalculo(c)}
                          className="text-txtDim transition-colors hover:text-danger"
                          aria-label="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Tooltip>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlowCard>
        </div>
      </div>
    </Screen>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-txtFaint">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${accent ? "text-green" : "text-txt"}`}>{value}</div>
    </div>
  );
}
