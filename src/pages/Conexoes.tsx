import { Megaphone, Plug, ShoppingBag, ShoppingCart, Store } from "lucide-react";
import { GlowCard } from "../components/GlowCard";
import { Screen } from "../components/Screen";

const INTEGRACOES = [
  { nome: "Amazon", desc: "Importar pedidos e vendas automaticamente.", icon: ShoppingCart },
  { nome: "Shopify", desc: "Sincronizar produtos, estoque e vendas da loja.", icon: ShoppingBag },
  { nome: "Meta Ads", desc: "Acompanhar gastos e conversões de anúncios.", icon: Megaphone },
  { nome: "Mercado Livre", desc: "Puxar vendas e status de envio.", icon: Store },
];

export function Conexoes() {
  return (
    <Screen
      eyebrow="Integrações"
      title="Conexões"
      subtitle="Conecte plataformas externas para importar vendas, estoque e anúncios automaticamente — sem digitar à mão."
    >
      <GlowCard accent="gold" grid className="mb-4">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-chip bg-goldSoft">
            <Plug size={24} className="text-gold" />
          </span>
          <p className="font-display text-2xl text-txt">Em Breve</p>
          <p className="max-w-md text-sm text-txtDim">
            Em breve você poderá conectar Amazon, Shopify, Meta Ads e outras plataformas para
            adicionar vendas e dados ao painel automaticamente.
          </p>
        </div>
      </GlowCard>

      <div className="grid grid-cols-12 gap-4">
        {INTEGRACOES.map((it, i) => {
          const Icon = it.icon;
          return (
            <GlowCard key={it.nome} delay={0.05 * i} className="col-span-12 opacity-70 sm:col-span-6 lg:col-span-3">
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
    </Screen>
  );
}
