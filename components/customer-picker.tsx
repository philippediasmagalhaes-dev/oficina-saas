"use client";

import { useEffect, useState } from "react";

type CustomerOption = { id: string; name: string; phone?: string | null };

export function CustomerPicker({ customers, defaultCustomerId = "", onChange }: {
  customers: CustomerOption[]; defaultCustomerId?: string; onChange?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState(customers.slice(0, 24));
  const [selectedId, setSelectedId] = useState(defaultCustomerId);
  const [selected, setSelected] = useState(customers.find((item) => item.id === defaultCustomerId));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!query.trim()) { setOptions(customers.slice(0, 24)); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/clientes/opcoes?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error();
        setOptions(rows); setError("");
      } catch { if (!controller.signal.aborted) setError("Não foi possível buscar. Tente novamente."); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, customers]);
  const displayed = selected && !options.some((item) => item.id === selected.id) ? [selected, ...options] : options;
  return <div className="customer-picker span-2">
    <label>Pesquisar cliente<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, telefone ou documento" /></label>
    <label>Cliente<select name="customerId" required value={selectedId} onChange={(event) => { const id = event.target.value; setSelectedId(id); setSelected(displayed.find((item) => item.id === id)); onChange?.(id); }}><option value="" disabled>Selecione o cliente</option>{displayed.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
    {error ? <small role="status">{error}</small> : null}
  </div>;
}
