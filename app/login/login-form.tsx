"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth/client";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(data.get("email")),
      password: String(data.get("password")),
      callbackURL: "/",
    });
    if (result.error) {
      setError("E-mail ou senha incorretos.");
      setPending(false);
      return;
    }
    window.location.assign("/");
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <img src="/logo.jpg" alt="Logo da oficina" className="auth-logo" />
      <p className="eyebrow">OFICINA CRM</p>
      <h1>Acesso do proprietário</h1>
      <p className="muted">Entre para acompanhar clientes, serviços, retornos e estoque.</p>
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={10} required /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      <small>Acesso exclusivo por convite.</small>
    </form>
  );
}
