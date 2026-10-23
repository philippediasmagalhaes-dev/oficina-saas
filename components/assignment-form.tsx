import { assignCollaboratorAction, removeCollaboratorAssignmentAction } from "../app/actions";

type CollaboratorOption = { id: string; name: string };
type Assignment = { id: string; collaboratorId: string; collaboratorName: string; participationBasisPoints: number };

export function AssignmentForm({ serviceRecordId, workOrderItemId, collaborators, assignments }: { serviceRecordId: string; workOrderItemId: string; collaborators: CollaboratorOption[]; assignments: Assignment[] }) {
  return <div className="assignment-panel">
    {assignments.length ? <div className="assignment-list">{assignments.map((assignment) => <form action={removeCollaboratorAssignmentAction} key={assignment.id}><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="serviceRecordId" value={serviceRecordId} /><span>{assignment.collaboratorName} · {(assignment.participationBasisPoints / 100).toLocaleString("pt-BR")}%</span><button className="icon-button" type="submit" aria-label={`Remover ${assignment.collaboratorName}`}>×</button></form>)}</div> : <small>Nenhum colaborador atribuído.</small>}
    {collaborators.length ? <form action={assignCollaboratorAction} className="inline-form"><input type="hidden" name="serviceRecordId" value={serviceRecordId} /><input type="hidden" name="workOrderItemId" value={workOrderItemId} /><select name="collaboratorId" required defaultValue=""><option value="" disabled>Colaborador</option>{collaborators.map((collaborator) => <option value={collaborator.id} key={collaborator.id}>{collaborator.name}</option>)}</select><input name="participationPercent" type="number" min="0.01" max="100" step="0.01" defaultValue="100" aria-label="Participação em porcentagem" /><button className="secondary-button" type="submit">Atribuir</button></form> : <small>Cadastre colaboradores para distribuir a mão de obra.</small>}
  </div>;
}
