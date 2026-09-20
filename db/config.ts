export const serverConfigKeys = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
] as const;

export type ServerConfig = {
  databaseUrl: string;
  betterAuthUrl: string;
  betterAuthSecret: string;
};

export type ServerConfigResult =
  | { configured: true; values: ServerConfig }
  | { configured: false; missing: (typeof serverConfigKeys)[number][] };

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
    },
  };
}

export function getServerConfig(): ServerConfigResult {
  return readServerConfig(process.env);
}
