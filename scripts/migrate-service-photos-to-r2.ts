import { neonConfig, Pool } from "@neondatabase/serverless";
import { and, asc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { servicePhotos } from "../db/schema";
import {
  migrateLegacyPhotos,
  type PhotoMigrationRepository,
} from "../server/photo-migration";
import {
  createR2PhotoStorage,
  readPhotoStorageConfig,
} from "../server/photo-storage";

neonConfig.webSocketConstructor = ws;

async function main() {
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--dry-run");
  if (unknownArguments.length > 0) {
    throw new Error("Argumento desconhecido.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Configuração pendente: DATABASE_URL");

  const storageConfig = readPhotoStorageConfig(process.env);
  if (!storageConfig.configured) {
    throw new Error(`Configuração pendente: ${storageConfig.missing.join(", ")}`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzle({ client: pool });
  const repository: PhotoMigrationRepository = {
    async listLegacyPhotos({ afterId, limit }) {
      return database
        .select({
          id: servicePhotos.id,
          workshopId: servicePhotos.workshopId,
          serviceRecordId: servicePhotos.serviceRecordId,
          mimeType: servicePhotos.mimeType,
          dataBase64: servicePhotos.dataBase64,
          storageKey: servicePhotos.storageKey,
          sizeBytes: servicePhotos.sizeBytes,
        })
        .from(servicePhotos)
        .where(
          and(
            isNull(servicePhotos.storageKey),
            isNotNull(servicePhotos.dataBase64),
            afterId ? gt(servicePhotos.id, afterId) : undefined,
          ),
        )
        .orderBy(asc(servicePhotos.id))
        .limit(limit);
    },

    async markMigrated({ id, storageKey, sizeBytes }) {
      const updated = await database
        .update(servicePhotos)
        .set({ storageKey, sizeBytes })
        .where(
          and(
            eq(servicePhotos.id, id),
            isNull(servicePhotos.storageKey),
            isNotNull(servicePhotos.dataBase64),
          ),
        )
        .returning({ id: servicePhotos.id });
      return updated.length === 1;
    },
  };

  try {
    const result = await migrateLegacyPhotos({
      repository,
      storage: createR2PhotoStorage(storageConfig.values),
      dryRun: process.argv.includes("--dry-run"),
      log: (message) => console.log(message),
    });
    console.log(
      `candidate=${result.candidate} migrated=${result.migrated} skipped=${result.skipped} failed=${result.failed}`,
    );
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error("Falha ao executar a migração de fotos. Verifique a configuração e tente novamente.");
  process.exitCode = 1;
});
