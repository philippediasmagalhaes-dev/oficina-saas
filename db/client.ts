import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { readServerConfig } from "./config";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

let database: NeonDatabase<typeof schema> | undefined;
let pool: Pool | undefined;

export function getDatabase(): NeonDatabase<typeof schema> {
  if (database) return database;
  const config = readServerConfig(process.env);
  if (!config.configured) throw new Error(`Configuração pendente: ${config.missing.join(", ")}`);
  pool = new Pool({ connectionString: config.values.databaseUrl });
  database = drizzle({ client: pool, schema });
  return database;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
