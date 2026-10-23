"use client";

import { useState } from "react";
import type { DamageMarkInput } from "../domain/inspection";

export function DamageMap({ initialMarks = [] }: { initialMarks?: DamageMarkInput[] }) {
  const [marks, setMarks] = useState(initialMarks);
  const [damageType, setDamageType] = useState("scratch");
  return <div className="damage-map-field span-2">
    <div className="damage-map-toolbar"><strong>Mapa de avarias</strong><select value={damageType} onChange={(event) => setDamageType(event.target.value)}><option value="scratch">Risco</option><option value="dent">Amassado</option><option value="broken">Quebrado</option><option value="paint">Pintura</option><option value="other">Outro</option></select><small>Clique no desenho para marcar.</small></div>
    <div className="vehicle-damage-map" role="application" aria-label="Mapa de avarias do veículo" onClick={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const xBasisPoints = Math.round(((event.clientX - bounds.left) / bounds.width) * 10000);
      const yBasisPoints = Math.round(((event.clientY - bounds.top) / bounds.height) * 10000);
      setMarks((current) => [...current, { vehicleView: "top", xBasisPoints, yBasisPoints, damageType, note: null }]);
    }}>
      <div className="vehicle-silhouette"><i /><b /><span /></div>
      {marks.map((mark, index) => <button key={`${mark.xBasisPoints}-${mark.yBasisPoints}-${index}`} type="button" className={`damage-mark damage-${mark.damageType}`} style={{ left: `${mark.xBasisPoints / 100}%`, top: `${mark.yBasisPoints / 100}%` }} aria-label={`Remover avaria ${index + 1}`} onClick={(event) => { event.stopPropagation(); setMarks((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>×</button>)}
    </div>
    <input type="hidden" name="damageMarks" value={JSON.stringify(marks)} />
  </div>;
}
