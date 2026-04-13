import React from "react";

interface CalculatorFieldProps {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode: "numeric" | "decimal";
  help?: string;
}

export function CalculatorField({
  id,
  label,
  suffix,
  value,
  onChange,
  placeholder,
  inputMode,
  help,
}: CalculatorFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <div className="mt-1.5 flex items-center rounded-xl border border-neutral-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl bg-transparent px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        <span className="pr-4 text-sm font-medium text-neutral-500">
          {suffix}
        </span>
      </div>
      {help ? <p className="mt-1.5 text-xs text-neutral-500">{help}</p> : null}
    </div>
  );
}
