import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { closeDatabase, getDatabase } from "./client";
import { account, user } from "./schema";

const recoverySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(10).max(128),
});

async function main() {
  if (process.env.OWNER_RESET_EXISTING !== "true") {
    console.log("Recuperação do proprietário não solicitada.");
    return;
  }

  const parsed = recoverySchema.safeParse({
    email: process.env.OWNER_EMAIL,
    name: process.env.OWNER_NAME,
    password: process.env.OWNER_PASSWORD,
  });
  if (!parsed.success)
    throw new Error("Dados de recuperação do proprietário inválidos.");

  const passwordHash = await hashPassword(parsed.data.password);
  const db = getDatabase();
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(73194622)`);
    const existingUsers = await transaction
      .select({ id: user.id })
      .from(user)
      .limit(2);
    if (existingUsers.length !== 1)
      throw new Error(
        "A recuperação exige exatamente um proprietário existente.",
      );

    const userId = existingUsers[0].id;
    await transaction
      .update(user)
      .set({
        name: parsed.data.name,
        email: parsed.data.email,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    const [credential] = await transaction
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      )
      .limit(1);

    if (credential) {
      await transaction
        .update(account)
        .set({
          password: passwordHash,
          accountId: userId,
          updatedAt: new Date(),
        })
        .where(eq(account.id, credential.id));
    } else {
      await transaction.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      });
    }
  });
  console.log("Acesso do proprietário recuperado com sucesso.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
