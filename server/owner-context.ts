import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readServerConfig } from "../db/config";
import { getAuth } from "../lib/auth/server";
import { createDrizzleRepository } from "./drizzle-repository";

export async function getOwnerUser() {
  if (!readServerConfig(process.env).configured) redirect("/configurar");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session.user;
}

export async function getOwnerContext() {
  const user = await getOwnerUser();
  const repository = createDrizzleRepository();
  const workshop = await repository.getWorkshopForUser(user.id);
  if (!workshop) redirect("/configurar");
  return { user, workshop, workshopId: workshop.id, repository };
}
