import { processWhatsAppOutbox, scheduleMaintenanceReminders } from "../../../../server/whatsapp";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const queued = await scheduleMaintenanceReminders();
  const delivery = await processWhatsAppOutbox();
  return Response.json({ queued, ...delivery }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = POST;
