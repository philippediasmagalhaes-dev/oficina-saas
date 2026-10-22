import { describe, expect, it } from "vitest";
import {
  createPhotoService,
  type PhotoMetadata,
  type PhotoRepository,
} from "./photo-service";
import type { PhotoStorage } from "./photo-storage";

const uploadInput = {
  workshopId: "workshop-a",
  serviceRecordId: "order-b",
  kind: "diagnosis" as const,
  caption: "Antes do reparo",
  fileName: "motor.jpg",
  mimeType: "image/jpeg",
  body: new Uint8Array([1, 2, 3]),
};

function setup(overrides?: {
  put?: PhotoStorage["put"];
  get?: PhotoStorage["get"];
  delete?: PhotoStorage["delete"];
  insertPhoto?: PhotoRepository["insertPhoto"];
  findPhoto?: PhotoRepository["findPhoto"];
  findOrder?: PhotoRepository["findOrder"];
}) {
  const events: string[] = [];
  const inserted: PhotoMetadata[] = [];
  const deleted: string[] = [];
  const storage: PhotoStorage = {
    put:
      overrides?.put ??
      (async () => {
        events.push("put");
      }),
    get: overrides?.get ?? (async () => null),
    delete:
      overrides?.delete ??
      (async (key) => {
        events.push("delete");
        deleted.push(key);
      }),
  };
  const repository: PhotoRepository = {
    findOrder: overrides?.findOrder ?? (async () => ({ id: "order-b" })),
    insertPhoto:
      overrides?.insertPhoto ??
      (async (input) => {
        events.push("insert");
        inserted.push(input);
      }),
    findPhoto: overrides?.findPhoto ?? (async () => null),
  };
  const service = createPhotoService({
    storage,
    repository,
    createId: () => "photo-c",
  });
  return { service, events, inserted, deleted };
}

describe("photo lifecycle service", () => {
  it("uploads bytes before inserting tenant-scoped metadata", async () => {
    const { service, events, inserted } = setup();

    await expect(service.upload(uploadInput)).resolves.toEqual({
      id: "photo-c",
      storageKey: "workshops/workshop-a/orders/order-b/photo-c.jpg",
    });

    expect(events).toEqual(["put", "insert"]);
    expect(inserted).toEqual([
      {
        id: "photo-c",
        workshopId: "workshop-a",
        serviceRecordId: "order-b",
        kind: "diagnosis",
        caption: "Antes do reparo",
        fileName: "motor.jpg",
        mimeType: "image/jpeg",
        dataBase64: null,
        storageKey: "workshops/workshop-a/orders/order-b/photo-c.jpg",
        sizeBytes: 3,
      },
    ]);
  });

  it("does not insert metadata when storage upload fails", async () => {
    let insertCount = 0;
    const { service } = setup({
      put: async () => {
        throw new Error("R2 indisponível");
      },
      insertPhoto: async () => {
        insertCount += 1;
      },
    });

    await expect(service.upload(uploadInput)).rejects.toThrow("R2 indisponível");
    expect(insertCount).toBe(0);
  });

  it("deletes the uploaded object when metadata persistence fails", async () => {
    const databaseError = new Error("Neon indisponível");
    const { service, deleted } = setup({
      insertPhoto: async () => {
        throw databaseError;
      },
    });

    await expect(service.upload(uploadInput)).rejects.toBe(databaseError);
    expect(deleted).toEqual([
      "workshops/workshop-a/orders/order-b/photo-c.jpg",
    ]);
  });

  it("keeps the original database error when cleanup also fails", async () => {
    const databaseError = new Error("Neon indisponível");
    const { service } = setup({
      insertPhoto: async () => {
        throw databaseError;
      },
      delete: async () => {
        throw new Error("Falha ao limpar R2");
      },
    });

    await expect(service.upload(uploadInput)).rejects.toBe(databaseError);
  });

  it("reads an R2-backed photo", async () => {
    const metadata: PhotoMetadata = {
      id: "photo-c",
      workshopId: "workshop-a",
      serviceRecordId: "order-b",
      kind: "diagnosis",
      caption: "Antes do reparo",
      fileName: "motor.jpg",
      mimeType: "image/jpeg",
      dataBase64: null,
      storageKey: "workshops/workshop-a/orders/order-b/photo-c.jpg",
      sizeBytes: 3,
    };
    const { service } = setup({
      findPhoto: async () => metadata,
      get: async () => ({ body: new Uint8Array([4, 5]), contentType: "image/jpeg" }),
    });

    await expect(service.read("workshop-a", "photo-c")).resolves.toEqual({
      status: "found",
      body: new Uint8Array([4, 5]),
      mimeType: "image/jpeg",
      fileName: "motor.jpg",
    });
  });

  it("decodes a legacy Base64 photo", async () => {
    const metadata: PhotoMetadata = {
      id: "legacy-photo",
      workshopId: "workshop-a",
      serviceRecordId: "order-b",
      kind: "intake",
      caption: null,
      fileName: "entrada.png",
      mimeType: "image/png",
      dataBase64: "AQID",
      storageKey: null,
      sizeBytes: null,
    };
    const { service } = setup({ findPhoto: async () => metadata });

    await expect(service.read("workshop-a", "legacy-photo")).resolves.toEqual({
      status: "found",
      body: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      fileName: "entrada.png",
    });
  });

  it("reports a known row with a missing R2 object as unavailable", async () => {
    const metadata: PhotoMetadata = {
      id: "photo-c",
      workshopId: "workshop-a",
      serviceRecordId: "order-b",
      kind: "diagnosis",
      caption: null,
      fileName: "motor.webp",
      mimeType: "image/webp",
      dataBase64: null,
      storageKey: "workshops/workshop-a/orders/order-b/photo-c.webp",
      sizeBytes: 3,
    };
    const { service } = setup({ findPhoto: async () => metadata });

    await expect(service.read("workshop-a", "photo-c")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("does not distinguish a foreign-workshop photo from a missing photo", async () => {
    const { service } = setup({ findPhoto: async () => null });

    await expect(service.read("workshop-b", "photo-c")).resolves.toEqual({
      status: "missing",
    });
  });
});
