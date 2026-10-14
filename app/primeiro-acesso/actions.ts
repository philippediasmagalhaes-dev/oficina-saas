"use server";

import { redirect } from "next/navigation";
import { registerFirstOwner } from "../../server/owner-bootstrap";

export type FirstAccessState = { error: string };

export async function createFirstOwnerAction(
  _previousState: FirstAccessState,
  formData: FormData,
): Promise<FirstAccessState> {
  let created = false;
  try {
    const result = await registerFirstOwner({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      passwordConfirmation: String(formData.get("passwordConfirmation") ?? ""),
    });
    created = result.created;
  } catch {
    return {
      error:
        "Revise os dados. Use um e-mail válido e uma senha com pelo menos 10 caracteres.",
    };
  }

  if (!created)
    return {
      error: "O primeiro acesso já foi criado. Entre com a conta existente.",
    };
  redirect("/login?conta=criada");
}
