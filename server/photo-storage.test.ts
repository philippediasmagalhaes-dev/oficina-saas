import { describe, expect, it } from "vitest";
import * as photoStorageModule from "./photo-storage";

type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

type PhotoStorageApi = {
  readPhotoStorageConfig(env: Record<string, string | undefined>):
    | { configured: false; missing: string[] }
    | { configured: true; values: StorageConfig };
  buildPhotoStorageKey(input: {
    workshopId: string;
    serviceRecordId: string;
    photoId: string;
    mimeType: string;
  }): string;
  createR2PhotoStorage(config: StorageConfig, fetcher?: typeof fetch): {
    put(key: string, body: Uint8Array, contentType: string): Promise<void>;
    get(key: string): Promise<{ body: Uint8Array; contentType: string | null } | null>;
    delete(key: string): Promise<void>;
  };
};

const storageApi = photoStorageModule as unknown as PhotoStorageApi;
const config: StorageConfig = {
  accountId: "account-123",
  accessKeyId: "access-123",
  secretAccessKey: "secret-123",
  bucketName: "private-photos",
};

function fakeFetch(
  response: (request: Request) => Response | Promise<Response>,
) {
  const requests: Request[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    return response(request);
  };
  return { requests, fetcher: fetcher as typeof fetch };
}

describe("private photo storage", () => {
  it("reports every missing R2 setting without exposing values", () => {
    expect(storageApi.readPhotoStorageConfig({})).toEqual({
      configured: false,
      missing: [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
      ],
    });
  });

  it("accepts a complete R2 configuration", () => {
    expect(
      storageApi.readPhotoStorageConfig({
        R2_ACCOUNT_ID: "account-123",
        R2_ACCESS_KEY_ID: "access-123",
        R2_SECRET_ACCESS_KEY: "secret-123",
        R2_BUCKET_NAME: "private-photos",
      }),
    ).toEqual({ configured: true, values: config });
  });

  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("builds a tenant-scoped key for %s", (mimeType, extension) => {
    expect(
      storageApi.buildPhotoStorageKey({
        workshopId: "workshop-a",
        serviceRecordId: "order-b",
        photoId: "photo-c",
        mimeType,
      }),
    ).toBe(`workshops/workshop-a/orders/order-b/photo-c.${extension}`);
  });

  it("encodes every identifier and rejects unsupported content types", () => {
    expect(
      storageApi.buildPhotoStorageKey({
        workshopId: "workshop/a",
        serviceRecordId: "order b",
        photoId: "photo#c",
        mimeType: "image/png",
      }),
    ).toBe("workshops/workshop%2Fa/orders/order%20b/photo%23c.png");

    expect(() =>
      storageApi.buildPhotoStorageKey({
        workshopId: "workshop-a",
        serviceRecordId: "order-b",
        photoId: "photo-c",
        mimeType: "image/svg+xml",
      }),
    ).toThrow("Tipo de imagem não permitido");
  });

  it("uploads bytes to the private bucket with a signed content type", async () => {
    const { fetcher, requests } = fakeFetch(() => new Response(null, { status: 200 }));
    const storage = storageApi.createR2PhotoStorage(config, fetcher);

    await storage.put("workshops/a/orders/b/photo.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("PUT");
    expect(requests[0].url).toBe(
      "https://account-123.r2.cloudflarestorage.com/private-photos/workshops/a/orders/b/photo.jpg",
    );
    expect(requests[0].headers.get("content-type")).toBe("image/jpeg");
    expect(requests[0].headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
  });

  it("downloads bytes and maps an absent object to null", async () => {
    const first = fakeFetch(() =>
      new Response(new Uint8Array([7, 8]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      }),
    );
    await expect(storageApi.createR2PhotoStorage(config, first.fetcher).get("photo.webp")).resolves.toEqual({
      body: new Uint8Array([7, 8]),
      contentType: "image/webp",
    });

    const absent = fakeFetch(() => new Response(null, { status: 404 }));
    await expect(storageApi.createR2PhotoStorage(config, absent.fetcher).get("missing.webp")).resolves.toBeNull();
  });

  it("treats delete as idempotent and redacts provider diagnostics", async () => {
    const absent = fakeFetch(() => new Response(null, { status: 404 }));
    await expect(storageApi.createR2PhotoStorage(config, absent.fetcher).delete("missing.jpg")).resolves.toBeUndefined();

    const failed = fakeFetch(() =>
      new Response("secret-123 provider diagnostic", { status: 503 }),
    );
    await expect(storageApi.createR2PhotoStorage(config, failed.fetcher).get("broken.jpg")).rejects.toThrow(
      "Falha ao ler foto no armazenamento (503)",
    );
    await expect(storageApi.createR2PhotoStorage(config, failed.fetcher).get("broken.jpg")).rejects.not.toThrow(
      /secret-123|provider diagnostic/,
    );
  });
});
