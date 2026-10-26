"use client";

import { useState } from "react";
import type { DamageMarkInput } from "../domain/inspection";

const views = { top: "Superior", left: "Lateral esquerda", right: "Lateral direita", front: "Dianteira", rear: "Traseira" } as const;
const types = { scratch: "Risco", dent: "Amassado", broken: "Quebrado", paint: "Pintura", other: "Outro" } as const;

export function VehicleDiagram({ view }: { view: string }) {
  return <svg viewBox="0 0 600 300" aria-hidden="true" className="damage-vehicle-svg" fill="none" stroke="currentColor" strokeWidth="3">
    {view === "top" ? <g>
      <path d="M170 70Q180 36 230 32H370Q420 36 430 70L446 223Q446 262 407 268H193Q154 262 154 223Z" fill="#e3e3e5" />
      <path d="M201 83Q208 63 238 62H362Q392 63 399 83L410 205Q411 232 386 237H214Q189 232 190 205Z" />
      <path d="M206 105L394 105L381 143H219Z" fill="#b4c2cb" /><path d="M219 154H381L397 206H203Z" fill="#b4c2cb" />
      <path d="M195 117L174 128M405 117L426 128M166 87H151V132H166M434 87H449V132H434M160 194H148V237H160M440 194H452V237H440" />
      <path d="M221 143V154M379 143V154M169 72H431M165 246H435" />
      <text x="300" y="23" textAnchor="middle" stroke="none" fill="currentColor" fontSize="15">FRENTE</text>
    </g> : view === "left" || view === "right" ? <g transform={view === "right" ? "translate(600 0) scale(-1 1)" : undefined}>
      <path d="M64 177L94 146L183 136L238 84Q251 75 280 75H365L431 130L512 148Q537 155 543 184V218H499Q491 176 452 176Q415 176 403 218H211Q201 176 163 176Q124 176 115 218H61Z" fill="#e3e3e5" />
      <path d="M211 131L248 91H291V131ZM305 91H359L404 131H305Z" fill="#b4c2cb" />
      <circle cx="163" cy="219" r="35" fill="#b8b8bd" /><circle cx="163" cy="219" r="20" /><circle cx="452" cy="219" r="35" fill="#b8b8bd" /><circle cx="452" cy="219" r="20" />
      <path d="M299 138V207M410 138L399 207M318 152H338M230 153H249M71 178H119M510 166H537" />
    </g> : <g>
      <path d="M153 144L184 73Q191 54 221 54H379Q409 54 416 73L447 144L465 173V235H135V173Z" fill="#e3e3e5" />
      <path d="M196 78H404L426 137H174Z" fill="#b4c2cb" />
      <rect x="148" y="235" width="46" height="28" rx="6" fill="#b8b8bd" /><rect x="406" y="235" width="46" height="28" rx="6" fill="#b8b8bd" />
      <path d="M149 164H222V190H148ZM378 164H451V190H378ZM245 170H355V210H245Z" fill={view === "rear" ? "#d8a1a8" : "#b4c2cb"} />
      <path d="M141 219H459M166 123H139V143H157M434 123H461V143H443" />
    </g>}
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
