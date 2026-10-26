"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; serviceRecordId: string; orderNumber: number | null; customerName: string };

export function ApprovalNotifications({ workshopName }: { workshopName: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const storageKey = `approval-notifications:${workshopName}`;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    try { setDismissed(JSON.parse(localStorage.getItem(storageKey) ?? "[]")); } catch { /* Storage can be unavailable. */ }
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notificacoes", { cache: "no-store", signal: controller.signal });
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const result = await response.json();
          if (active && Array.isArray(result)) setItems(result);
        }
      } catch { /* The next visible refresh retries. */ }
    }
    void load();
    const interval = setInterval(load, 60000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, [storageKey]);
  const pending = items.filter((item) => !dismissed.includes(item.id));
  if (!pending.length) return null;
  return <aside className="approval-notice" role="status" aria-live="polite">
    <strong>{pending.length === 1 ? "Orçamento aprovado" : `${pending.length} orçamentos aprovados`}</strong>
    {pending.slice(0, 3).map((item) => <a href={`/ordens/${item.serviceRecordId}`} key={item.id}>OS {item.orderNumber ?? ""} · {item.customerName}</a>)}
    <button className="text-button" onClick={() => { const ids = [...new Set([...dismissed, ...items.map((item) => item.id)])].slice(-200); setDismissed(ids); try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch {} }}>Marcar como visto</button>
  </aside>;
}
