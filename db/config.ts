export const serverConfigKeys = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
] as const;

export type ServerConfig = {
  databaseUrl: string;
  betterAuthUrl: string;
  betterAuthSecret: string;
  trustedOrigins: string[];
};

export type ServerConfigResult =
  | { configured: true; values: ServerConfig }
  | { configured: false; missing: (typeof serverConfigKeys)[number][] };

function normalizeHttpOrigin(value: string) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("A origem deve usar HTTP ou HTTPS.");
  }
  return url.origin;
}

export function parseTrustedOrigins(value: string | undefined, baseUrl: string) {
  try {
    const origins = [
      normalizeHttpOrigin(baseUrl),
      ...(value ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map(normalizeHttpOrigin),
    ];
    return [...new Set(origins)];
  } catch {
    throw new Error("AUTH_TRUSTED_ORIGINS contém uma origem inválida.");
  }
}

export function readServerConfig(
  env: Record<string, string | undefined>,
): ServerConfigResult {
  const missing = serverConfigKeys.filter((key) => {
    const value = env[key];
    return !value || (key === "BETTER_AUTH_SECRET" && value.length < 32);
  });

  if (missing.length) return { configured: false, missing };

  return {
    configured: true,
    values: {
      databaseUrl: env.DATABASE_URL!,
      betterAuthUrl: env.BETTER_AUTH_URL!,
      betterAuthSecret: env.BETTER_AUTH_SECRET!,
      trustedOrigins: parseTrustedOrigins(
        env.AUTH_TRUSTED_ORIGINS,
        env.BETTER_AUTH_URL!,
      ),
    },
  };
}

export function getServerConfig(): ServerConfigResult {
  return readServerConfig(process.env);
}
