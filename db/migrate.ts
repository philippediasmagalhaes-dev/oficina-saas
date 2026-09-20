import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { closeDatabase, getDatabase } from "./client";

async function main() {
  await migrate(getDatabase(), { migrationsFolder: "db/migrations" });
  await closeDatabase();
  console.log("Migrações aplicadas com sucesso.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDatabase();
  process.exitCode = 1;
});
