import { migrate } from "drizzle-orm/neon-http/migrator";
import { closeDatabase, getDatabase } from "./client";

async function main() {
  await migrate(getDatabase(), { migrationsFolder: "db/migrations" });
  await closeDatabase();
  console.log("Migrações aplicadas com sucesso.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: { message?: string; code?: string } }).cause;
    if (cause) console.error([cause.code, cause.message].filter(Boolean).join(": "));
  }
  await closeDatabase();
  process.exitCode = 1;
});
