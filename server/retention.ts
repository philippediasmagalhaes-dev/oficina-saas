import { and, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { customers } from "../db/schema";
import { forecastMaintenance } from "../domain/maintenance";
import { buildPageWindow, normalizePageRequest, type PagedResult } from "../domain/pagination";

type RecallRow = {
  id: string; customer_id: string; customer_name: string; phone: string | null;
  consent: boolean; vehicle_label: string; service_name: string; completed_at: string;
  odometer: number | null; previous_at: string | null; previous_odometer: number | null;
  interval_days: number | null; interval_km: number | null; next_due_at: string | null; total: number;
};

export type MaintenanceReturn = {
  id: string; serviceRecordId: string; customerId: string; customerName: string;
  phone: string | null; consent: boolean; vehicleLabel: string; serviceName: string;
  completedAt: Date; odometer: number | null;
} & ReturnType<typeof forecastMaintenance>;

export async function listMaintenanceReturns(workshopId: string, page?: string, reminderDate?: Date): Promise<PagedResult<MaintenanceReturn>> {
  const request = normalizePageRequest({ page });
  // All ranking and history selection happens in PostgreSQL; at most 24 rows reach the Worker.
  const result = await getDatabase().execute<RecallRow>(sql`
    with history_lines as (
      select distinct s.id, s.customer_id, s.vehicle_id,
        coalesce(i.service_catalog_id, s.service_catalog_id)::text as catalog_id,
        coalesce(i.description, s.description) as service_name,
        s.completed_at, coalesce(s.delivered_odometer, s.odometer) as odometer,
        s.next_due_at, s.return_interval_days,
        case when translate(lower(coalesce(i.description,s.description)), 'óâãíçé', 'oaaice') ~ '(troca.*oleo|oleo.*troca)'
          and translate(lower(coalesce(i.description,s.description)), 'óâãíçé', 'oaaice') !~ '(cambio|transmiss|diferencial|hidraul|freio)'
          then 'oil-change' else lower(coalesce(i.description, s.description)) end as service_key
      from service_records s
      left join work_order_items i on i.service_record_id=s.id and i.workshop_id=${workshopId} and i.type='service'
      where s.workshop_id=${workshopId} and s.status in ('completed','delivered') and s.completed_at is not null
    ), history as (
      select distinct on (id, case when service_key='oil-change' then service_key else coalesce(catalog_id,service_key) end) *
      from history_lines order by id, case when service_key='oil-change' then service_key else coalesce(catalog_id,service_key) end, catalog_id nulls last
    ), ranked as (
      select *, row_number() over w as rn,
        lead(completed_at) over w as previous_at,
        lead(odometer) over w as previous_odometer
      from history
      window w as (partition by coalesce(vehicle_id::text, customer_id::text), case when service_key='oil-change' then service_key else coalesce(catalog_id,service_key) end order by completed_at desc, id desc)
    ), latest as (
      select r.*, c.name as customer_name, c.phone, c.whatsapp_consent as consent,
        coalesce(concat(v.make,' ',v.model,' · ',v.plate),'veículo') as vehicle_label,
        coalesce(r.return_interval_days,sc.default_return_interval_days) as interval_days,
        sc.default_return_interval_km as interval_km
      from ranked r
      join customers c on c.id=r.customer_id and c.workshop_id=${workshopId}
      left join vehicles v on v.id=r.vehicle_id and v.workshop_id=${workshopId}
      left join service_catalog sc on sc.id::text=r.catalog_id and sc.workshop_id=${workshopId}
      where r.rn=1
    ), due as (
      select *, case when service_key!='oil-change' and next_due_at>completed_at then next_due_at else least(
        case when service_key='oil-change' then completed_at + interval '6 months' else completed_at + make_interval(days=>coalesce(interval_days,180)) end,
        case when interval_days>0 then completed_at + make_interval(days=>interval_days) end,
        case when next_due_at>completed_at then next_due_at end,
        case when service_key='oil-change' and odometer>previous_odometer and completed_at-previous_at>=interval '7 days'
          then completed_at + make_interval(days=>greatest(7,least(366,ceil(coalesce(interval_km,5000)::numeric * extract(epoch from completed_at-previous_at)/86400 / nullif(odometer-previous_odometer,0))))::integer) end
      ) end as calculated_due from latest
    )
    select *, count(*) over()::integer as total from due
    where ${reminderDate ? sql`(calculated_due at time zone 'America/Sao_Paulo')::date - (${reminderDate.toISOString()}::timestamptz at time zone 'America/Sao_Paulo')::date in (7,0,-14)` : sql`true`}
    order by calculated_due asc, id
    limit ${request.pageSize} offset ${(request.page - 1) * request.pageSize}
  `);
  const rows = result.rows;
  if (!rows.length && request.page > 1) return listMaintenanceReturns(workshopId, "1", reminderDate);
  const total = Number(rows[0]?.total ?? 0);
  const window = buildPageWindow({ ...request, total });
  return {
    ...window,
    items: rows.map((row) => {
      const completedAt = new Date(row.completed_at);
      const forecast = forecastMaintenance({
        serviceName: row.service_name, completedAt,
        odometer: row.odometer, previousAt: row.previous_at ? new Date(row.previous_at) : null,
        previousOdometer: row.previous_odometer, intervalDays: row.interval_days,
        intervalKm: row.interval_km, explicitDueAt: row.next_due_at ? new Date(row.next_due_at) : null,
      });
      return {
        id: `${row.id}:${row.service_name}`, serviceRecordId: row.id,
        customerId: row.customer_id, customerName: row.customer_name,
        phone: row.phone, consent: row.consent, vehicleLabel: row.vehicle_label,
        serviceName: row.service_name, completedAt, odometer: row.odometer, ...forecast,
      };
    }),
  };
}

export async function confirmExistingWhatsAppConsent(workshopId: string, confirmed: boolean) {
  if (!confirmed) throw new Error("Confirme que a oficina já possui autorização dos clientes.");
  // A prior opt-out is never overwritten by a batch declaration.
  const rows = await getDatabase().update(customers).set({
    whatsappConsent: true, whatsappConsentAt: new Date(),
    whatsappConsentSource: "declaração do proprietário: autorização prévia da base",
    updatedAt: new Date(),
  }).where(and(eq(customers.workshopId, workshopId), eq(customers.whatsappConsent, false), isNull(customers.whatsappOptOutAt))).returning({ id: customers.id });
  return rows.length;
}
