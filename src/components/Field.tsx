import type { ReactNode } from "react";

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

/**
 * Numeric input that keeps focus stable while typing. Reports parsed number (or undefined when
 * blanked, if `allowEmpty`). An optional unit (R$, %) is shown as a leading/trailing adornment.
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
        placeholder={placeholder}
        value={value === undefined || Number.isNaN(value) ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onValue(allowEmpty ? undefined : 0);
            return;
          }
          const n = parseFloat(raw);
          onValue(Number.isNaN(n) ? (allowEmpty ? undefined : 0) : n);
        }}
        className={`${inputClass} ${unit ? "pl-9" : ""}`}
      />
    </div>
  );
}
