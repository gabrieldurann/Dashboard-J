import { useEffect, useRef, useState, type ReactNode } from "react";

export const inputClass =
  "w-full rounded-chip border border-line bg-bgRaise/60 px-3 py-2 font-mono text-sm text-txt outline-none transition-colors placeholder:text-txtFaint focus:border-green";

/** Labelled form field wrapper. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-txtDim">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block font-mono text-[10px] text-txtFaint">{hint}</span>}
    </label>
  );
}

/** Text input. */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={inputClass} />;
}

/** An empty box shows nothing — a leftover 0 is noise the user has to type around. */
const paraTexto = (v?: number) => (v === undefined || Number.isNaN(v) || v === 0 ? "" : String(v));

/** Sensible "Ex.: …" hint per unit, so the field is never just a blank rectangle. */
const exemploPara = (unit?: string) => (unit === "%" ? "Ex.: 15" : unit === "R$" ? "Ex.: 22,50" : "Ex.: 100");

/**
 * Numeric input that keeps focus stable while typing. It holds the typed text locally so the
 * box can be genuinely empty (reporting 0 upward) instead of snapping back to a stuck "0";
 * props only overwrite the text when the value changes from outside (loading a record, reset).
 * Reports the parsed number, or undefined when blanked if `allowEmpty`.
 */
export function NumberInput({
  value,
  onValue,
  unit,
  step = "any",
  allowEmpty = false,
  placeholder,
}: {
  value: number | undefined;
  onValue: (v: number | undefined) => void;
  unit?: string;
  step?: string;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(() => paraTexto(value));
  // what we last reported upward — lets us tell our own echo from a genuine external change
  const reportado = useRef<number | undefined>(value);

  useEffect(() => {
    if (value !== reportado.current) {
      setTexto(paraTexto(value));
      reportado.current = value;
    }
  }, [value]);

  const aoDigitar = (raw: string) => {
    setTexto(raw);
    const n = raw.trim() === "" ? NaN : parseFloat(raw.replace(",", "."));
    const val = Number.isNaN(n) ? (allowEmpty ? undefined : 0) : n;
    reportado.current = val;
    onValue(val);
  };

  return (
    <div className="relative">
      {unit && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-txtFaint">
          {unit}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        placeholder={placeholder ?? exemploPara(unit)}
        value={texto}
        onChange={(e) => aoDigitar(e.target.value)}
        className={`${inputClass} ${unit ? "pl-9" : ""}`}
      />
    </div>
  );
}
