import { VehicleDiagram } from "./damage-map";

export function DamageMapPreview({ marks }: { marks: { vehicleView: string; xBasisPoints?: number; yBasisPoints?: number }[] }) {
  const views = marks.length ? [...new Set(marks.map((mark) => mark.vehicleView))] : ["top"];
  return <div className="print-damage-maps">{views.map((view) => <div className="print-damage-view" key={view}>
    <VehicleDiagram view={view} />
    {marks.map((mark, index) => mark.vehicleView === view && mark.xBasisPoints !== undefined && mark.yBasisPoints !== undefined ? <b key={index} style={{ left: `${mark.xBasisPoints / 100}%`, top: `${mark.yBasisPoints / 100}%` }}>{index + 1}</b> : null)}
  </div>)}</div>;
}
