"use client";

import { useId, useState } from "react";
import type { DamageMarkInput } from "../domain/inspection";

const views = { top: "Superior", left: "Lateral esquerda", right: "Lateral direita", front: "Dianteira", rear: "Traseira" } as const;
const types = { scratch: "Risco", dent: "Amassado", broken: "Quebrado", paint: "Pintura", other: "Outro" } as const;

// Crops reference the original, unmodified five-view inspection image.
const diagramCrops: Record<string, string> = {
  top: "8 0 230 117",
  front: "246 8 121 106",
  rear: "368 8 119 106",
  left: "8 119 231 99",
  right: "247 119 240 99",
};

export function VehicleDiagram({ view }: { view: string }) {
  const clipId = useId();
  const crop = diagramCrops[view] ?? diagramCrops.top;
  const [x, y, width, height] = crop.split(" ").map(Number);
  return <svg viewBox={crop} aria-hidden="true" className="damage-vehicle-svg" preserveAspectRatio="xMidYMid meet">
    <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height} /></clipPath></defs>
    <image href="/vehicle-inspection-reference.png" width="487" height="218" clipPath={`url(#${clipId})`} />
  </svg>;
}
export function DamageMap({ initialMarks = [] }: { initialMarks?: DamageMarkInput[] }) {
  const [marks, setMarks] = useState(initialMarks);
  const [view, setView] = useState("top");
  const [damageType, setDamageType] = useState("scratch");
  const add = (x: number, y: number) => setMarks((current) => current.length >= 100 ? current : [...current, { vehicleView: view, xBasisPoints: Math.max(0, Math.min(10000, Math.round(x))), yBasisPoints: Math.max(0, Math.min(10000, Math.round(y))), damageType, note: null }]);
  return <div className="damage-map-field span-2">
    <div className="damage-map-toolbar"><strong>Mapa de avarias</strong><select aria-label="Vista do veículo" value={view} onChange={(event) => setView(event.target.value)}>{Object.entries(views).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Tipo de avaria" value={damageType} onChange={(event) => setDamageType(event.target.value)}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="vehicle-damage-map illustrated-damage-map" role="button" tabIndex={0} aria-label="Adicionar avaria no desenho. Enter adiciona no centro." onKeyDown={(event) => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); add(5000, 5000); } }} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); add((event.clientX - bounds.left) / bounds.width * 10000, (event.clientY - bounds.top) / bounds.height * 10000); }}>
      <VehicleDiagram view={view} />
      {marks.map((mark, index) => mark.vehicleView === view ? <button key={index} type="button" className={`damage-mark damage-${mark.damageType}`} style={{ left: `${mark.xBasisPoints / 100}%`, top: `${mark.yBasisPoints / 100}%` }} aria-label={`Remover avaria ${index + 1}`} onClick={(event) => { event.stopPropagation(); setMarks((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>{index + 1}</button> : null)}
    </div>
    <small className="field-hint">Clique na parte do veículo para marcar; clique no número para remover.</small>
    {marks.map((mark, index) => <label key={index} className="damage-note">{index + 1}. {views[mark.vehicleView as keyof typeof views] ?? mark.vehicleView} · {types[mark.damageType as keyof typeof types] ?? mark.damageType}<input placeholder="Observação da avaria" value={mark.note ?? ""} onChange={(event) => setMarks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} /></label>)}
    <input type="hidden" name="damageMarks" value={JSON.stringify(marks)} />
  </div>;
}
