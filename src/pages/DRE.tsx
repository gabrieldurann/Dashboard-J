import { AlertTriangle, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { dre, mesesComVendas, type DRE as TipoDRE, type LinhaDRE } from "../calc/engine";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";
import { money, percent } from "../i18n/format";
import { abrirImpressao, dreHTML } from "../report/printable";
import { useConfig } from "../store/useConfig";
import { useStore } from "../store/useStore";
import { useEscopo } from "../store/useEscopo";

/**
 * Demonstração do resultado, one month at a time.
 *
 * Everything here is realized: it reorganises the deductions the app already applies per order,
 * so the bottom line is the same figure the Painel shows. Nothing is projected — a statement
 * built partly on "if every product sold at its registered pace" would be worthless to the person
 * who has to sign it.
 */

const nomeMes = (mes: string) => {
  const [ano, m] = mes.split("-");
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${nomes[Number(m) - 1]} de ${ano}`;
};

/** Deductions read as negatives on a statement, even though they are stored as magnitudes. */
const sinal = (l: LinhaDRE) =>
  l.tipo === "deducao" || l.tipo === "custo" || l.tipo === "despesa" ? -1 : 1;

export function DRE() {
  const cfg = useConfig();
  // scoped to the selected storefront — see useEscopo
  const escopo = useEscopo();
  const vendas = escopo.vendas;
  const produtos = useStore((s) => s.produtos);
  const devolucoes = escopo.devolucoes;
  const custosOperacionais = escopo.custosOperacionais;
  const anuncios = escopo.anunciosAds;

  const meses = useMemo(() => mesesComVendas(vendas), [vendas]);
  const [mes, setMes] = useState<string>("");
  const mesAtivo = meses.includes(mes) ? mes : meses[0];

  const fontes = useMemo(
    () => ({ vendas, produtos, devolucoes, custosOperacionais, anuncios }),
    [vendas, produtos, devolucoes, custosOperacionais, anuncios],
  );

  const atual = useMemo(
    () => (mesAtivo ? dre(fontes, mesAtivo, cfg) : null),
    [fontes, mesAtivo, cfg],
  );
  // the month immediately before the one on screen — a statement is read against something
  const anterior = useMemo(() => {
    if (!mesAtivo) return null;
    const i = meses.indexOf(mesAtivo);
    const anteriorChave = meses[i + 1];
    return anteriorChave ? dre(fontes, anteriorChave, cfg) : null;
  }, [fontes, meses, mesAtivo, cfg]);

  if (!atual)
    return (
      <Screen eyebrow="Financeiro" title="DRE">
        <GlowCard>
          <p className="py-12 text-center text-sm text-txtDim">
            Nenhuma venda registrada ainda — sem movimento não há resultado a demonstrar.
          </p>
        </GlowCard>
      </Screen>
    );

  const gerar = () => abrirImpressao(dreHTML(atual, anterior, new Date()));

  return (
    <Screen
      eyebrow="Financeiro"
      title="DRE"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-chip border border-line bg-panel px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txtFaint">Mês</span>
            <select
              value={mesAtivo}
              onChange={(e) => setMes(e.target.value)}
              className="bg-transparent font-mono text-sm text-txt outline-none"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={gerar}
            className="flex items-center gap-2 rounded-chip border border-lineStrong bg-goldSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
          >
            <FileDown size={16} /> Gerar PDF
          </button>
        </div>
      }
    >
      {atual.receitaSemCusto > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-amber/40 bg-amberSoft px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-sm leading-relaxed text-txtDim">
            <strong className="text-amber">{money(atual.receitaSemCusto)}</strong> de receita sem
            produto vinculado. Esse faturamento entrou, mas nenhum custo foi deduzido por ele — o
            lucro bruto abaixo está superestimado nesse valor.
          </p>
        </div>
      )}

      <GlowCard accent="green" className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <p className="font-display text-base text-txt">{nomeMes(atual.mes)}</p>
          <p className="mt-0.5 font-mono text-[11px] text-txtFaint">
            {atual.pedidos} {atual.pedidos === 1 ? "pedido" : "pedidos"} · AV = participação sobre a
            receita bruta{anterior && ` · comparado com ${nomeMes(anterior.mes)}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {/* the comparison column must be absent, not empty — the body only emits that
                    cell when there IS a previous month, and a stray <th> desynchronises the
                    table (head 4 cells, body 3) on the oldest month in the ledger */}
                {["Descrição", "Valor", "AV", ...(anterior ? ["vs. mês anterior"] : [])].map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-txtFaint ${
                      i > 0 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {atual.linhas.map((l) => (
                <Linha key={l.chave} l={l} anterior={anterior} />
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-txtFaint">
        O frete entra abaixo do lucro bruto, junto com anúncios e despesas — é custo de{" "}
        <em>vender</em>, não de <em>comprar</em>, então a margem bruta continua comparável entre
        produtos com fretes diferentes. O lucro líquido é o mesmo número do Painel.
      </p>
    </Screen>
  );
}

function Linha({ l, anterior }: { l: LinhaDRE; anterior: TipoDRE | null }) {
  const resultado = l.tipo === "resultado";
  // nesting, not sign, decides the shape of a row: level 0 is a headline or a subtotal
  const cabeca = l.nivel === 0;
  const valor = l.valor * sinal(l);

  const antes = anterior?.linhas.find((x) => x.chave === l.chave);
  const variacao =
    antes && antes.valor !== 0 ? (l.valor - antes.valor) / Math.abs(antes.valor) : null;

  // On a result line, up is good. On a cost line, up is bad — so the colour follows meaning,
  // not arithmetic sign.
  const bomSubir = l.tipo === "receita" || l.tipo === "resultado" || l.tipo === "ganho";
  const corVariacao =
    variacao === null || variacao === 0
      ? "text-txtFaint"
      : variacao > 0 === bomSubir
        ? "text-green"
        : "text-danger";

  const corValor = resultado
    ? valor < 0
      ? "text-danger"
      : l.chave === "lucroLiquido"
        ? "text-green"
        : "text-txt"
    : l.tipo === "ganho"
      ? "text-green"
      : "text-txtDim";

  return (
    <tr
      className={`border-b border-line/60 ${cabeca ? "bg-bgRaise/40" : ""} ${
        l.chave === "lucroLiquido" ? "border-b-0" : ""
      }`}
    >
      <td className={`px-3 py-2.5 ${cabeca ? "" : "pl-8"}`}>
        <span className={cabeca ? "font-display text-sm text-txt" : "text-sm text-txtDim"}>
          {!cabeca && <span className="mr-1.5 text-txtFaint">{sinal(l) < 0 ? "(−)" : "(+)"}</span>}
          {l.label}
        </span>
        {l.nota && <span className="ml-2 font-mono text-[10px] text-txtFaint">{l.nota}</span>}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums ${corValor} ${
          cabeca ? "text-base" : "text-sm"
        }`}
      >
        {money(valor)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs tabular-nums text-txtFaint">
        {percent(l.vertical)}
      </td>
      {anterior && (
        <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs tabular-nums ${corVariacao}`}>
          {variacao === null ? "—" : `${variacao > 0 ? "+" : ""}${percent(variacao)}`}
        </td>
      )}
    </tr>
  );
}
