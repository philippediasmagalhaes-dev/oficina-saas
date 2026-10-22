import {
  buildPhotoStorageKey,
  type PhotoStorage,
} from "./photo-storage";

export type PhotoKind = "intake" | "diagnosis" | "completion";

export type PhotoMetadata = {
  id: string;
  workshopId: string;
  serviceRecordId: string;
  kind: PhotoKind;
  caption: string | null;
  fileName: string;
  mimeType: string;
  dataBase64: string | null;
  storageKey: string | null;
  sizeBytes: number | null;
};

export type NewPhotoMetadata = PhotoMetadata;

export type PhotoRepository = {
  findOrder(
    workshopId: string,
    serviceRecordId: string,
  ): Promise<{ id: string } | null>;
  insertPhoto(input: NewPhotoMetadata): Promise<void>;
  findPhoto(
    workshopId: string,
    photoId: string,
  ): Promise<PhotoMetadata | null>;
};

export type PhotoReadResult =
  | {
      status: "found";
      body: Uint8Array;
      mimeType: string;
      fileName: string;
    }
  | { status: "missing" }
  | { status: "unavailable" };

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function createPhotoService(input: {
  storage: PhotoStorage;
  repository: PhotoRepository;
  createId?: () => string;
}) {
  const createId = input.createId ?? (() => crypto.randomUUID());

  return {
    async upload(photo: {
      workshopId: string;
      serviceRecordId: string;
      kind: PhotoKind;
      caption: string | null;
      fileName: string;
      mimeType: string;
      body: Uint8Array;
    }) {
      const order = await input.repository.findOrder(
        photo.workshopId,
        photo.serviceRecordId,
      );
      if (!order) throw new Error("Ordem de serviço não encontrada.");

      const id = createId();
      const storageKey = buildPhotoStorageKey({
        workshopId: photo.workshopId,
        serviceRecordId: photo.serviceRecordId,
        photoId: id,
        mimeType: photo.mimeType,
      });

      await input.storage.put(storageKey, photo.body, photo.mimeType);
      try {
        await input.repository.insertPhoto({
          id,
          workshopId: photo.workshopId,
          serviceRecordId: photo.serviceRecordId,
          kind: photo.kind,
          caption: photo.caption,
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          dataBase64: null,
          storageKey,
          sizeBytes: photo.body.byteLength,
        });
      } catch (error) {
        try {
          await input.storage.delete(storageKey);
        } catch {
          // The database error is the actionable failure. Orphan cleanup is best effort.
        }
        throw error;
      }

      return { id, storageKey };
    },

    async read(workshopId: string, photoId: string): Promise<PhotoReadResult> {
      const photo = await input.repository.findPhoto(workshopId, photoId);
      if (!photo) return { status: "missing" };

      if (photo.storageKey) {
        try {
          const stored = await input.storage.get(photo.storageKey);
          if (!stored) return { status: "unavailable" };
          return {
            status: "found",
            body: stored.body,
            mimeType: photo.mimeType,
            fileName: photo.fileName,
          };
        } catch {
          return { status: "unavailable" };
        }
      }

      if (!photo.dataBase64) return { status: "unavailable" };
      try {
        return {
          status: "found",
          body: decodeBase64(photo.dataBase64),
          mimeType: photo.mimeType,
          fileName: photo.fileName,
        };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}
