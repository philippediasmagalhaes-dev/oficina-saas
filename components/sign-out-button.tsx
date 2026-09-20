"use client";

import { authClient } from "../lib/auth/client";

export function SignOutButton() {
  return <button className="quiet-button" type="button" onClick={async () => { await authClient.signOut(); window.location.assign("/login"); }}>Sair</button>;
}
