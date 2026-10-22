import { buildPhotoStorageKey, type PhotoStorage } from "./photo-storage";

export type LegacyPhotoRow = {
  id: string;
  workshopId: string;
  serviceRecordId: string;
  mimeType: string;
  dataBase64: string | null;
  storageKey: string | null;
  sizeBytes?: number | null;
};

export type PhotoMigrationRepository = {
  listLegacyPhotos(input: {
    afterId: string | null;
    limit: number;
  }): Promise<LegacyPhotoRow[]>;
  markMigrated(input: {
    id: string;
    storageKey: string;
    sizeBytes: number;
  }): Promise<boolean>;
};

export type PhotoMigrationResult = {
  candidate: number;
  migrated: number;
  skipped: number;
  failed: number;
};

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function cleanupUploadedObject(storage: PhotoStorage, storageKey: string) {
  try {
    await storage.delete(storageKey);
  } catch {
    // Cleanup is best effort; the row still points to the intact legacy data.
  }
}

export async function migrateLegacyPhotos(input: {
  repository: PhotoMigrationRepository;
  storage: PhotoStorage;
  batchSize?: number;
  dryRun?: boolean;
  log?: (message: string) => void;
}): Promise<PhotoMigrationResult> {
  const batchSize = input.batchSize ?? 25;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("O tamanho do lote deve ser um inteiro positivo.");
  }

  const result: PhotoMigrationResult = {
    candidate: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
  };
  const log = input.log ?? (() => undefined);
  let afterId: string | null = null;

  while (true) {
    const rows = await input.repository.listLegacyPhotos({
      afterId,
      limit: batchSize,
    });
    if (rows.length === 0) break;

    for (const photo of rows) {
      afterId = photo.id;

      if (photo.storageKey || !photo.dataBase64) {
        result.skipped += 1;
        log(`photo ${photo.id}: skipped`);
        continue;
      }

      result.candidate += 1;
      if (input.dryRun) {
        log(`photo ${photo.id}: candidate`);
        continue;
      }

      const storageKey = buildPhotoStorageKey({
        workshopId: photo.workshopId,
        serviceRecordId: photo.serviceRecordId,
        photoId: photo.id,
        mimeType: photo.mimeType,
      });
      let uploaded = false;

      try {
        const body = decodeBase64(photo.dataBase64);
        await input.storage.put(storageKey, body, photo.mimeType);
        uploaded = true;

        const stored = await input.storage.get(storageKey);
        if (!stored || stored.body.byteLength !== body.byteLength) {
          throw new Error("O tamanho do objeto salvo não confere.");
        }

        const updated = await input.repository.markMigrated({
          id: photo.id,
          storageKey,
          sizeBytes: body.byteLength,
        });
        if (!updated) {
          await cleanupUploadedObject(input.storage, storageKey);
          result.skipped += 1;
          log(`photo ${photo.id}: skipped`);
          continue;
        }

        result.migrated += 1;
        log(`photo ${photo.id}: migrated`);
      } catch {
        if (uploaded) await cleanupUploadedObject(input.storage, storageKey);
        result.failed += 1;
        log(`photo ${photo.id}: failed`);
      }
    }
  }

  return result;
}
