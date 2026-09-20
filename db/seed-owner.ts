import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { closeDatabase, getDatabase } from "./client";
import { account, user } from "./schema";

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || "Proprietário";
  if (!email || !password || password.length < 10) throw new Error("Defina OWNER_EMAIL e OWNER_PASSWORD com no mínimo 10 caracteres.");

  const db = getDatabase();
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing) {
    console.log("O proprietário já existe; nenhuma alteração foi feita.");
    return;
  }

  const userId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id: userId, email, name, emailVerified: true });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(password),
    });
  });
  console.log(`Proprietário convidado criado para ${email}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(closeDatabase);
