import { FileDown } from "lucide-react";
import { useMemo } from "react";
import { calcularMetricas, totaisPortfolio } from "../calc/engine";
import { GlowCard } from "../components/GlowCard";
import { MetricTile } from "../components/MetricTile";
import { Screen } from "../components/Screen";
import { StatusDot } from "../components/StatusDot";
import { money, percent } from "../i18n/format";
import { gerarRelatorioHTML } from "../report/printable";
import { Coins, Landmark, Package, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "../store/useStore";

export function Relatorios() {
  const produtos = useStore((s) => s.produtos);

  const dados = useMemo(() => {
    const totais = totaisPortfolio(produtos);
    const comMetricas = produtos.map((p) => ({ p, m: calcularMetricas(p) }));
    const aprovados = comMetricas.filter((x) => x.m.aprovado).length;
    const toLinha = ({ p, m }: (typeof comMetricas)[number]) => ({
      nome: p.nome,
      precoVenda: p.precoVenda,
      margem: m.margem,
      lucroMensal: m.lucroMensal,
    });
    const melhores = [...comMetricas].sort((a, b) => b.m.margem - a.m.margem).slice(0, 5).map(toLinha);
    const reavaliar = comMetricas
      .filter((x) => x.m.statusCor === "vermelho")
      .sort((a, b) => a.m.margem - b.m.margem)
      .map(toLinha);
    return { totais, aprovados, melhores, reavaliar, comMetricas };
  }, [produtos]);

  const gerar = () => {
    const html = gerarRelatorioHTML({
      geradoEm: new Date(),
      totais: dados.totais,
      aprovados: dados.aprovados,
      melhores: dados.melhores,
      reavaliar: dados.reavaliar,
    });
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const t = dados.totais;

  return (
    <Screen
      eyebrow="Resumo"
      title="Relatórios"
      subtitle="Visão consolidada do que importa. Gere um PDF limpo com um clique."
      actions={
        <button
          onClick={gerar}
          className="flex items-center gap-2 rounded-chip border border-lineStrong bg-goldSoft px-4 py-2.5 font-mono text-sm text-txt transition-opacity hover:opacity-90"
        >
          <FileDown size={16} /> Gerar relatório (PDF)
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-4">
        <MetricTile label="Receita / mês" value={t.receitaMensal} format={money} icon={TrendingUp} accent="gold" delay={0} className="col-span-6 lg:col-span-3" />
        <MetricTile label="Lucro / mês" value={t.lucroMensal} format={money} icon={Coins} accent="green" delay={0.05} className="col-span-6 lg:col-span-3" />
        <MetricTile label="Custo / mês" value={t.custoMensal} format={money} icon={Package} delay={0.1} className="col-span-6 lg:col-span-3" />
        <MetricTile label="Imposto / mês" value={t.impostoMensal} format={money} icon={Landmark} delay={0.15} className="col-span-6 lg:col-span-3" />
        <MetricTile label="Capital em estoque" value={t.capitalEstoque} format={money} icon={Wallet} accent="gold" delay={0.2} className="col-span-6 lg:col-span-3" />
        <MetricTile label="Margem média" value={t.margemMedia} format={percent} icon={TrendingUp} accent="green" delay={0.25} className="col-span-6 lg:col-span-3" />

        {/* melhores margens */}
        <GlowCard className="col-span-12 lg:col-span-6" delay={0.3}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Melhores margens</span>
          <ul className="divide-y divide-line">
            {dados.melhores.map((l, i) => (
              <li key={i} className="flex items-center justify-between py-2.5">
                <span className="truncate pr-3 text-sm text-txt">{l.nome}</span>
                <span className="flex items-center gap-4 font-mono text-sm tabular-nums">
                  <span className="text-green">{percent(l.margem)}</span>
                  <span className="text-txtDim">{money(l.lucroMensal)}</span>
                </span>
              </li>
            ))}
          </ul>
        </GlowCard>

        {/* re-avaliar */}
        <GlowCard className="col-span-12 lg:col-span-6" delay={0.35}>
          <span className="mb-3 block font-mono text-[11.5px] uppercase tracking-[0.1em] text-txtDim">Para re-avaliar</span>
          {dados.reavaliar.length === 0 ? (
            <p className="py-6 text-center text-sm text-txtDim">Tudo dentro da meta. <span className="text-green">✓</span></p>
          ) : (
            <ul className="divide-y divide-line">
              {dados.reavaliar.map((l, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2.5">
                    <StatusDot cor="vermelho" />
                    <span className="truncate text-sm text-txt">{l.nome}</span>
                  </span>
                  <span className="font-mono text-sm tabular-nums text-danger">{percent(l.margem)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>
      </div>
    </Screen>
  );
}
