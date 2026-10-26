import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
const sql = neon(databaseUrl);
const [counts] = await sql`
  select
    (select count(*)::integer from customers) as customers,
    (select count(*)::integer from service_records) as service_records,
    (select count(*)::integer from workshops) as workshops,
    (select count(*)::integer from financial_entries) as financial_entries
`;
const [migration] = await sql`
  select
    to_regclass('public.financial_accounts') is not null as financial_accounts,
    to_regclass('public.financial_settlements') is not null as financial_settlements,
    to_regclass('public.cash_sessions') is not null as cash_sessions,
    exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'financial_status' and e.enumlabel = 'partial'
    ) as partial_status
`;
console.log(JSON.stringify({ counts, migration }));
