"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase } from "../../db/client";
import { serviceRecords } from "../../db/schema";
import { verifyMechanicAccess } from "../../server/mechanic-access";
import { addServicePhoto, getWorkOrder, saveDiagnosis, updateWorkOrderStatus } from "../../server/work-orders";
import { saveInspection } from "../../server/inspections";
import { enqueueVehicleReadyMessage, normalizeReadyRecipient } from "../../server/whatsapp";

async function context(form: FormData) {
  const token = String(form.get("mechanicToken") ?? "");
  const grant = await verifyMechanicAccess(token, process.env.BETTER_AUTH_SECRET ?? "");
  if (!grant) throw new Error("Este acesso expirou. Peça um novo link ao proprietário.");
  const order = await getWorkOrder(grant.workshopId, grant.serviceRecordId);
  if (!order || ["completed", "delivered", "cancelled"].includes(order.status)) throw new Error("Esta OS não permite mais alterações.");
  return { ...grant, token, order };
}

function refresh(serviceRecordId: string, token: string) {
  revalidatePath(`/ordens/${serviceRecordId}`);
  revalidatePath(`/mecanico/${token}`);
  revalidatePath("/ordens");
}

export async function saveMechanicWorkAction(form: FormData) {
  const { workshopId, serviceRecordId, token, order } = await context(form);
  const task = String(form.get("task") ?? "save");
  if (!["save", "start", "ready"].includes(task)) throw new Error("Ação inválida.");
  if (task === "ready" && order.status !== "in_progress") throw new Error("Inicie a execução antes de marcar como pronto.");
  if (task === "start" && order.status !== "approved") throw new Error("A OS precisa estar aprovada.");
  const odometerText = String(form.get("odometer") ?? "").trim();
  const odometer = odometerText ? Number(odometerText) : null;
  if (odometer !== null && (!Number.isInteger(odometer) || odometer < 0 || odometer > 10000000)) throw new Error("Quilometragem inválida.");
  if (["open", "diagnosis"].includes(order.status)) {
    const diagnosis = String(form.get("diagnosis") ?? "").trim();
    if (diagnosis) await saveDiagnosis({ workshopId, serviceRecordId, complaint: order.complaint ?? order.description, diagnosis: diagnosis.slice(0, 10000), notes: order.notes });
  }
  await getDatabase().update(serviceRecords).set({ mechanicNotes: String(form.get("mechanicNotes") ?? "").trim().slice(0, 10000), odometer, updatedAt: new Date() }).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId), inArray(serviceRecords.status, ["open", "diagnosis", "awaiting_approval", "approved", "in_progress", "ready"])));
  if (task === "ready") {
    if (order.status !== "in_progress") throw new Error("Inicie a execução antes de marcar como pronto.");
    await updateWorkOrderStatus(workshopId, serviceRecordId, "ready");
    const recipientPhone = normalizeReadyRecipient({ consent: order.customerWhatsappConsent, phone: order.customerPhone });
    if (recipientPhone) {
      try { await enqueueVehicleReadyMessage({ workshopId, serviceRecordId, customerId: order.customerId, customerName: order.customerName, workshopName: order.workshopName, vehicleLabel: order.vehicleLabel, recipientPhone }); }
      catch { console.error("Não foi possível programar o aviso de veículo pronto."); }
    }
  } else if (task === "start") {
    if (order.status !== "approved") throw new Error("A OS precisa estar aprovada.");
    await updateWorkOrderStatus(workshopId, serviceRecordId, "in_progress");
  }
  refresh(serviceRecordId, token);
}

export async function saveMechanicInspectionAction(form: FormData) {
  const { workshopId, serviceRecordId, token } = await context(form);
  const keys = ["frontPanel", "antenna", "speakers", "spareKey", "towHook", "jack", "extinguisher", "spareTire", "wheelKey", "documents"];
  const raw = String(form.get("inspectionOdometer") ?? "");
  const marks = JSON.parse(String(form.get("damageMarks") ?? "[]"));
  if (!Array.isArray(marks) || marks.length > 100) throw new Error("Mapa de avarias inválido.");
  await saveInspection({ workshopId, serviceRecordId, odometer: raw ? Number(raw) : null, fuelLevel: String(form.get("fuelLevel") ?? ""), tireCondition: String(form.get("tireCondition") ?? ""), observations: String(form.get("inspectionObservations") ?? "").slice(0, 10000), checklist: Object.fromEntries(keys.map((key) => [key, form.get(`check_${key}`) === "on"])), marks });
  refresh(serviceRecordId, token);
}

export async function uploadMechanicPhotoAction(form: FormData) {
  const { workshopId, serviceRecordId, token } = await context(form);
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > 2000000 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Use uma foto JPG, PNG ou WebP de até 2 MB.");
  await addServicePhoto({ workshopId, serviceRecordId, kind: "diagnosis", caption: String(form.get("caption") ?? "").slice(0, 200), fileName: photo.name, mimeType: photo.type, body: new Uint8Array(await photo.arrayBuffer()) });
  refresh(serviceRecordId, token);
}
