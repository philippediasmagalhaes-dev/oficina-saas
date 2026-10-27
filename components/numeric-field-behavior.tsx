"use client";

import { useEffect } from "react";

export function NumericFieldBehavior() {
  useEffect(() => {
    const select = (event: FocusEvent) => {
      const input = event.target;
      if (input instanceof HTMLInputElement &&
        (input.type === "number" || input.inputMode === "decimal" || input.inputMode === "numeric")) {
        input.select();
      }
    };
    document.addEventListener("focusin", select);
    return () => document.removeEventListener("focusin", select);
  }, []);
  return null;
}
