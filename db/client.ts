import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import {
  drizzle as drizzleHttp,
  type NeonHttpDatabase,
} from "drizzle-orm/neon-http";
import {
  drizzle as drizzleWebSocket,
  type NeonDatabase,
} from "drizzle-orm/neon-serverless";
import ws from "ws";
import { readServerConfig } from "./config";
import * as schema from "./schema";
import { selectWebSocketConstructor } from "./websocket-constructor";

neonConfig.webSocketConstructor = selectWebSocketConstructor(
  globalThis.WebSocket,
  ws,
) as typeof ws;

export type Database = NeonHttpDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<
  Parameters<NeonDatabase<typeof schema>["transaction"]>[0]
>[0];

export function createDatabase(databaseUrl: string): Database {
  return drizzleHttp({ client: neon(databaseUrl), schema });
}

export function getDatabase(): Database {
  const config = readServerConfig(process.env);
  if (!config.configured) throw new Error(`Configuração pendente: ${config.missing.join(", ")}`);
  return createDatabase(config.values.databaseUrl);
}

export async function runDatabaseTransactionForUrl<T>(
  databaseUrl: string,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzleWebSocket({ client: pool, schema });
  try {
    return await database.transaction(operation);
  } finally {
    await pool.end();
  }
}

export async function runDatabaseTransaction<T>(
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  const config = readServerConfig(process.env);
  if (!config.configured) throw new Error(`Configuração pendente: ${config.missing.join(", ")}`);
  return runDatabaseTransactionForUrl(config.values.databaseUrl, operation);
}

export async function closeDatabase(): Promise<void> {
  // HTTP requests do not keep a connection pool open.
}
