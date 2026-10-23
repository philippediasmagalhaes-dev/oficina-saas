import { saveInspectionAction } from "../app/actions";
import { DamageMap } from "./damage-map";
import type { DamageMarkInput } from "../domain/inspection";

type InspectionDefaults = {
  odometer: number | null;
  fuelLevel: string | null;
  tireCondition: string | null;
  checklist: Record<string, boolean>;
  observations: string | null;
  marks: DamageMarkInput[];
} | null;

const checklist = [
  ["frontPanel", "Frente do som"], ["antenna", "Antena"], ["speakers", "Alto-falantes"],
  ["spareKey", "Chave reserva"], ["towHook", "Reboque"], ["jack", "Macaco"],
  ["extinguisher", "Extintor"], ["spareTire", "Estepe"], ["wheelKey", "Chave de roda"],
  ["documents", "Documentos"],
] as const;

export function IntakeInspectionForm({ serviceRecordId, defaults }: { serviceRecordId: string; defaults: InspectionDefaults }) {
  return <form action={saveInspectionAction} className="form-grid inspection-form">
    <input type="hidden" name="serviceRecordId" value={serviceRecordId} />
    <label>Quilometragem<input name="inspectionOdometer" type="number" min="0" defaultValue={defaults?.odometer ?? ""} /></label>
    <label>Combustível<select name="fuelLevel" defaultValue={defaults?.fuelLevel ?? "half"}><option value="reserve">Reserva</option><option value="quarter">1/4</option><option value="half">1/2</option><option value="three_quarters">3/4</option><option value="full">Cheio</option></select></label>
    <label>Pneus<select name="tireCondition" defaultValue={defaults?.tireCondition ?? "good"}><option value="new">Novos</option><option value="good">Bons</option><option value="poor">Ruins</option></select></label>
    <fieldset className="checklist-field span-2"><legend>Acessórios e equipamentos</legend>{checklist.map(([name, label]) => <label className="check-row" key={name}><input name={`check_${name}`} type="checkbox" defaultChecked={defaults?.checklist[name] ?? false} />{label}</label>)}</fieldset>
    <label className="span-2">Observações da entrada<textarea name="inspectionObservations" rows={3} defaultValue={defaults?.observations ?? ""} /></label>
    <DamageMap initialMarks={defaults?.marks ?? []} />
    <button className="secondary-button" type="submit">Salvar vistoria</button>
  </form>;
}
