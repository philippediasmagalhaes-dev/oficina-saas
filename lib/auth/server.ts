import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase } from "../../db/client";
import { account, session, user, verification } from "../../db/schema";
import { readServerConfig, type ServerConfig } from "../../db/config";

function createAuthInstance(config: ServerConfig) {
  return betterAuth({
    appName: "Oficina CRM",
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    database: drizzleAdapter(getDatabase(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  });
}

type AuthInstance = ReturnType<typeof createAuthInstance>;
let authInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (authInstance) return authInstance;
  const config = readServerConfig(process.env);
  if (!config.configured) throw new Error(`Configuração pendente: ${config.missing.join(", ")}`);

  authInstance = createAuthInstance(config.values);
  return authInstance;
}
