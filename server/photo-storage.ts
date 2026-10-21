import { AwsClient } from "aws4fetch";

export const photoStorageConfigKeys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

export type PhotoStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export type PhotoStorageConfigResult =
  | { configured: true; values: PhotoStorageConfig }
  | { configured: false; missing: (typeof photoStorageConfigKeys)[number][] };

export interface PhotoStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string | null } | null>;
  delete(key: string): Promise<void>;
}

export function readPhotoStorageConfig(
  env: Record<string, string | undefined>,
): PhotoStorageConfigResult {
  const missing = photoStorageConfigKeys.filter((key) => !env[key]?.trim());
  if (missing.length) return { configured: false, missing };

  return {
    configured: true,
    values: {
      accountId: env.R2_ACCOUNT_ID!.trim(),
      accessKeyId: env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
      bucketName: env.R2_BUCKET_NAME!.trim(),
    },
  };
}

const extensionsByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function buildPhotoStorageKey(input: {
  workshopId: string;
  serviceRecordId: string;
  photoId: string;
  mimeType: string;
}) {
  const extension = extensionsByMimeType[input.mimeType as keyof typeof extensionsByMimeType];
  if (!extension) throw new Error("Tipo de imagem não permitido.");

  return [
    "workshops",
    encodeURIComponent(input.workshopId),
    "orders",
    encodeURIComponent(input.serviceRecordId),
    `${encodeURIComponent(input.photoId)}.${extension}`,
  ].join("/");
}

function storageError(operation: string, response: Response) {
  return new Error(`Falha ao ${operation} foto no armazenamento (${response.status}).`);
}

export function createR2PhotoStorage(
  config: PhotoStorageConfig,
  fetcher: typeof fetch = fetch,
): PhotoStorage {
  const client = new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  const baseUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucketName)}`;

  async function request(key: string, init: RequestInit) {
    const unsigned = new Request(`${baseUrl}/${key}`, init);
    const signed = await client.sign(unsigned);
    return fetcher(signed);
  }

  return {
    async put(key, body, contentType) {
      const bytes = body.slice().buffer as ArrayBuffer;
      const response = await request(key, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: bytes,
      });
      if (!response.ok) throw storageError("salvar", response);
    },

    async get(key) {
      const response = await request(key, { method: "GET" });
      if (response.status === 404) return null;
      if (!response.ok) throw storageError("ler", response);
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get("content-type"),
      };
    },

    async delete(key) {
      const response = await request(key, { method: "DELETE" });
      if (response.status === 404) return;
      if (!response.ok) throw storageError("excluir", response);
    },
  };
}
