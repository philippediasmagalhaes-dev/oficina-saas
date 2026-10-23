import { randomUUID } from "node:crypto";
import { hashPassword as hashBetterAuthPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, runDatabaseTransaction } from "../db/client";
import { account, user } from "../db/schema";

const firstOwnerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(10).max(128),
    passwordConfirmation: z.string(),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: "As senhas precisam ser iguais.",
    path: ["passwordConfirmation"],
  });

type FirstOwnerInput = z.input<typeof firstOwnerSchema>;
type StoredFirstOwner = {
  name: string;
  email: string;
  passwordHash: string;
};

type OwnerBootstrapDependencies = {
  hashPassword(password: string): Promise<string>;
  createIfEmpty(input: StoredFirstOwner): Promise<boolean>;
};

export function createOwnerBootstrapService(
  dependencies: OwnerBootstrapDependencies,
) {
  return {
    async register(input: FirstOwnerInput) {
      const parsed = firstOwnerSchema.safeParse(input);
      if (!parsed.success)
        throw new Error("Revise os dados do primeiro acesso.");

      const passwordHash = await dependencies.hashPassword(
        parsed.data.password,
      );
      const created = await dependencies.createIfEmpty({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      });
      return { created };
    },
  };
}

export async function isFirstOwnerAvailable(): Promise<boolean> {
  const [existing] = await getDatabase()
    .select({ id: user.id })
    .from(user)
    .limit(1);
  return !existing;
}

async function createFirstOwnerIfEmpty(
  input: StoredFirstOwner,
): Promise<boolean> {
  return runDatabaseTransaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(73194621)`);
    const [existing] = await transaction
      .select({ id: user.id })
      .from(user)
      .limit(1);
    if (existing) return false;

    const userId = randomUUID();
    await transaction.insert(user).values({
      id: userId,
      name: input.name,
      email: input.email,
      emailVerified: true,
    });
    await transaction.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: input.passwordHash,
    });
    return true;
  });
}

const ownerBootstrapService = createOwnerBootstrapService({
  hashPassword: hashBetterAuthPassword,
  createIfEmpty: createFirstOwnerIfEmpty,
});

export async function registerFirstOwner(input: FirstOwnerInput) {
  return ownerBootstrapService.register(input);
}
