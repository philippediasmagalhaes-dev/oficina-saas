import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { createDatabase, runDatabaseTransactionForUrl } from "../db/client";
import {
  legacyImportMappings,
  serviceRecords,
  workshops,
} from "../db/schema";
import {
  assertLegacySourceHash,
  buildLegacyOrderDateRepairs,
  safeLegacyImportError,
} from "../server/legacy-shoficina-import";

const SOURCE_SYSTEM = "SHOficina";

type LegacyDataset = {
  sourceHash: string;
  orders: Array<{ CODIGO: unknown; ENTRADA?: unknown }>;
};

function parseArguments(argv: string[]) {
  let zipPath = "";
  let workshopId: string | undefined;
  let commit = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--zip") zipPath = argv[++index] ?? "";
    else if (argv[index] === "--workshop-id") workshopId = argv[++index];
    else if (argv[index] === "--commit") commit = true;
    else throw new Error(`Argumento desconhecido: ${argv[index]}`);
  }
  if (!zipPath) throw new Error("Informe --zip com o caminho do SHBackup.zip.");
  return { zipPath: resolve(zipPath), workshopId, commit };
}

function extractDataset(zipPath: string): LegacyDataset {
  const workDirectory = mkdtempSync(join(tmpdir(), "shoficina-date-repair-"));
  const outputPath = join(workDirectory, "dataset.json");
  try {
    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        resolve("scripts/extract-shoficina-backup.ps1"),
        "-ZipPath",
        zipPath,
        "-OutputPath",
        outputPath,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0)
      throw new Error("Não foi possível ler o backup aprovado.");
    const dataset = JSON.parse(readFileSync(outputPath, "utf8")) as LegacyDataset;
    const sourceHash = createHash("sha256")
      .update(readFileSync(zipPath))
      .digest("hex")
      .toUpperCase();
    if (dataset.sourceHash !== sourceHash)
      throw new Error("O hash do backup mudou durante a leitura.");
    assertLegacySourceHash(dataset.sourceHash);
    return dataset;
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("Defina DATABASE_URL somente nesta sessão antes da reparação.");

  const dataset = extractDataset(options.zipPath);
  const database = createDatabase(databaseUrl);
  const availableWorkshops = await database
    .select({ id: workshops.id, name: workshops.name })
    .from(workshops);
  const selected = options.workshopId
    ? availableWorkshops.find((workshop) => workshop.id === options.workshopId)
    : availableWorkshops.length === 1
      ? availableWorkshops[0]
      : undefined;
  if (!selected)
    throw new Error("Informe --workshop-id para selecionar a oficina correta.");

  const mappings = await database
    .select({
      legacyId: legacyImportMappings.legacyId,
      targetId: legacyImportMappings.targetId,
    })
    .from(legacyImportMappings)
    .where(
      and(
        eq(legacyImportMappings.workshopId, selected.id),
        eq(legacyImportMappings.sourceSystem, SOURCE_SYSTEM),
        eq(legacyImportMappings.entityType, "work_order"),
      ),
    );
  const repairs = buildLegacyOrderDateRepairs(
    dataset.orders,
    new Map(mappings.map((mapping) => [mapping.legacyId, mapping.targetId])),
  );
  if (repairs.length !== dataset.orders.length)
    throw new Error("A reparação foi bloqueada porque existem OS sem mapeamento legado.");

  const report = {
    mode: options.commit ? "commit" : "dry-run",
    workshop: selected.name,
    total: repairs.length,
    knownEntryDates: repairs.filter((repair) => repair.intakeAt !== null).length,
    unknownEntryDates: repairs.filter((repair) => repair.intakeAt === null).length,
  };
  if (!options.commit) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const payload = JSON.stringify(
    repairs.map((repair) => ({
      target_id: repair.targetId,
      intake_at: repair.intakeAt?.toISOString() ?? null,
    })),
  );
  await runDatabaseTransactionForUrl(databaseUrl, async (transaction) => {
    await transaction.execute(sql`
      with source as (
        select target_id::uuid as target_id, intake_at::timestamptz as intake_at
        from jsonb_to_recordset(${payload}::jsonb)
          as values_to_apply(target_id text, intake_at text)
      )
      update service_records
      set intake_at = source.intake_at
      from source
      where service_records.id = source.target_id
        and service_records.workshop_id = ${selected.id}::uuid
    `);
  });

  const [audit] = await database
    .select({
      total: sql<number>`count(*)::int`,
      unknownEntryDates: sql<number>`count(*) filter (where ${serviceRecords.intakeAt} is null)::int`,
      october2026: sql<number>`count(*) filter (where date_trunc('month', ${serviceRecords.intakeAt} at time zone 'America/Sao_Paulo') = date '2026-10-01')::int`,
    })
    .from(serviceRecords)
    .innerJoin(
      legacyImportMappings,
      and(
        eq(legacyImportMappings.targetId, serviceRecords.id),
        eq(legacyImportMappings.workshopId, selected.id),
        eq(legacyImportMappings.sourceSystem, SOURCE_SYSTEM),
        eq(legacyImportMappings.entityType, "work_order"),
      ),
    );
  if (
    audit.total !== report.total ||
    audit.unknownEntryDates !== report.unknownEntryDates
  )
    throw new Error("A auditoria final não confirmou todas as datas reparadas.");

  console.log(JSON.stringify({ ...report, committed: true, audit }, null, 2));
}

main().catch((error) => {
  console.error(safeLegacyImportError(error));
  process.exitCode = 1;
});

