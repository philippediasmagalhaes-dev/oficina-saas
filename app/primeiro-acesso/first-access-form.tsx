"use client";

import { useActionState } from "react";
import { DocumentLink } from "../../components/document-link";
import { createFirstOwnerAction, type FirstAccessState } from "./actions";

const initialState: FirstAccessState = { error: "" };

export function FirstAccessForm() {
  const [state, action, pending] = useActionState(
    createFirstOwnerAction,
    initialState,
  );

  return (
    <form action={action} className="auth-card">
      <img src="/logo.jpg" alt="Logo da oficina" className="auth-logo" />
      <p className="eyebrow">CONFIGURAÇÃO SEGURA</p>
      <h1>Crie o primeiro acesso</h1>
      <p className="muted">
        Esta tela será desativada assim que o proprietário for criado.
      </p>
      <label>
        Nome do proprietário
        <input
          name="name"
          autoComplete="name"
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label>
        E-mail
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Senha
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
        />
      </label>
      <label>
        Confirmar senha
        <input
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
        />
      </label>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar acesso"}
      </button>
      <DocumentLink className="auth-link" href="/login">
        Voltar para o login
      </DocumentLink>
    </form>
  );
}
