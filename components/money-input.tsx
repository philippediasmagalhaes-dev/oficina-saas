"use client";

import { useState, type InputHTMLAttributes } from "react";

export function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 15) || "0";
  const padded = digits.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${integer},${padded.slice(-2)}`;
}

export function selectMoneyInputValue(input: Pick<HTMLInputElement, "select">) {
  input.select();
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "inputMode"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function MoneyInput({ value, defaultValue = "0,00", onValueChange, onFocus, ...props }: Props) {
  const [internal, setInternal] = useState(() => formatMoneyInput(defaultValue));
  const shown = value === undefined ? internal : formatMoneyInput(value);
  return <input
    {...props}
    inputMode="numeric"
    value={shown}
    onFocus={(event) => {
      selectMoneyInputValue(event.currentTarget);
      onFocus?.(event);
    }}
    onChange={(event) => {
      const formatted = formatMoneyInput(event.target.value);
      if (value === undefined) setInternal(formatted);
      onValueChange?.(formatted);
    }}
  />;
}

