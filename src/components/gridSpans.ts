// Keeps dashboard rows full when cards are hidden: the survivors of a row grow to absorb the
// freed columns, so the grid never shows a gap. Pairs with <Ocultavel>.

/** Static class strings so Tailwind's JIT can see every span it might need. */
export const LG_SPAN: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

export type ItemLinha = { id: string; peso: number; visivel: boolean };

/**
 * Split 12 columns among a row's visible items, in proportion to their natural weights.
 * Uses largest-remainder rounding so the spans always total exactly 12 — a row is never
 * short (gap) nor over (wrap). Hidden items are simply absent from the result.
 */
export function distribuir(itens: ItemLinha[]): Record<string, number> {
  const visiveis = itens.filter((i) => i.visivel);
  const total = visiveis.reduce((s, i) => s + i.peso, 0);
  if (visiveis.length === 0 || total <= 0) return {};

  // every visible card keeps at least one column
  const partes = visiveis.map((i) => {
    const exato = (12 * i.peso) / total;
    return { id: i.id, span: Math.max(1, Math.floor(exato)), resto: exato - Math.floor(exato) };
  });

  let soma = partes.reduce((s, p) => s + p.span, 0);
  // hand out leftover columns to the biggest fractional remainders first
  const porResto = [...partes].sort((a, b) => b.resto - a.resto);
  for (let i = 0; soma < 12; i++, soma++) porResto[i % porResto.length].span += 1;
  // if rounding overshot (possible with many items), trim the smallest remainders
  while (soma > 12) {
    const alvo = [...partes].sort((a, b) => a.resto - b.resto).find((p) => p.span > 1);
    if (!alvo) break;
    alvo.span -= 1;
    soma -= 1;
  }

  return Object.fromEntries(partes.map((p) => [p.id, p.span]));
}

/** Convenience: the `lg:` span class for an id, defaulting to full width. */
export const spanClass = (mapa: Record<string, number>, id: string) => LG_SPAN[mapa[id] ?? 12];
