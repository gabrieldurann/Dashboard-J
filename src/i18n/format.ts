// pt-BR formatters (idea #12). R$ with comma decimals, percentages, dates.

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const num = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** R$ 1.234,56 */
export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0);
/** 1.234,5 */
export const number = (v: number) => num.format(Number.isFinite(v) ? v : 0);
/** 29,7% */
export const percent = (v: number) => pct.format(Number.isFinite(v) ? v : 0);

/** 03/10/2025 */
export const date = (iso?: string) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("pt-BR");
};

/** 03/10/2025 14:32 */
export const datetime = (iso?: string) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
