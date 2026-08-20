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

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "jun" from a `YYYY-MM` key. */
export const mesCurto = (chave: string) => MESES[Number(chave.split("-")[1]) - 1] ?? chave;
/** "jun 2026" from a `YYYY-MM` key. */
export const labelMes = (chave: string) => `${mesCurto(chave)} ${chave.split("-")[0]}`;
/** "17 jun" from a `YYYY-MM-DD` key. */
export const labelDia = (chave: string) => {
  const [, m, d] = chave.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};
/** "15–21 jun", or "29 jun – 5 jul" when the week crosses a month. Key is the week's Monday. */
export const labelSemana = (chave: string) => {
  const [a, m, d] = chave.split("-").map(Number);
  const fim = new Date(a, m - 1, d + 6);
  const mesmoMes = fim.getMonth() === m - 1;
  return mesmoMes
    ? `${d}–${fim.getDate()} ${MESES[m - 1]}`
    : `${d} ${MESES[m - 1]} – ${fim.getDate()} ${MESES[fim.getMonth()]}`;
};
