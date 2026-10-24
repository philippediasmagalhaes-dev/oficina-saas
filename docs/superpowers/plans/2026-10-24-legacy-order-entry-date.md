# Legacy Order Entry Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar a data real de entrada das OS importadas e `Data não informada` quando o backup não possui essa informação.

**Architecture:** Separar a data de entrada de `created_at` com um novo campo anulável `intake_at`. Reconciliar os registros já importados pelo mapeamento legado e usar uma função única de apresentação nas telas.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, Neon PostgreSQL, Vitest, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-10-24-legacy-order-entry-date-design.md`

## Global Constraints

- Não inventar datas ausentes.
- Não alterar conclusão, entrega, valores ou status das OS.
- Usar somente o backup com hash previamente aprovado.
- Manter a reparação idempotente.

## Review Focus

- OS legada sem `ENTRADA` deve produzir `intakeAt: null`.
- OS legada com `ENTRADA` deve preservar a data original.
- OS nova deve receber `intakeAt` no momento da abertura.
- Telas devem renderizar `Data não informada` sem erro para valor nulo.
- Reexecução da reparação deve manter o mesmo resultado.

---

### Task 1: Modelo e reconciliação das datas

**Files:**
- Modify: `db/schema.ts`
- Create: `db/migrations/0009_legacy_order_intake_date.sql`
- Modify: `scripts/import-shoficina.ts`
- Create: `scripts/repair-shoficina-order-dates.ts`
- Modify: `server/legacy-shoficina-import.ts`
- Test: `server/legacy-shoficina-import.test.ts`

**Interfaces:**
- Produces: `resolveLegacyOrderDates(row, fallback)` e `serviceRecords.intakeAt`.

- [ ] Escrever testes que falhem para data conhecida e data ausente.
- [ ] Implementar o resolvedor de datas e usar `intakeAt` na importação.
- [ ] Adicionar a migração e o reparador idempotente do backup aprovado.
- [ ] Garantir `intakeAt` para novas OS.
- [ ] Rodar os testes focados e confirmar aprovação.

### Task 2: Apresentação da data de entrada

**Files:**
- Create: `domain/dates.ts`
- Create: `domain/dates.test.ts`
- Modify: `server/work-orders.ts`
- Modify: `server/vehicles.ts`
- Modify: `app/ordens/page.tsx`
- Modify: `app/ordens/[id]/page.tsx`
- Modify: `app/ordens/[id]/imprimir/page.tsx`
- Modify: `app/veiculos/[id]/page.tsx`

**Interfaces:**
- Consumes: `serviceRecords.intakeAt`.
- Produces: `formatOptionalDate(date)`.

- [ ] Escrever teste que falhe para o texto de data ausente.
- [ ] Implementar o formatador e propagar `intakeAt` nas consultas.
- [ ] Trocar as telas para exibir a data de entrada correta.
- [ ] Rodar os testes focados e confirmar aprovação.

### Task 3: Verificação e produção

**Files:**
- Modify: `package.json`
- Modify: `db/migrations/meta/_journal.json`
- Create: `db/migrations/meta/0009_snapshot.json`

**Interfaces:**
- Consumes: migração, reparador e telas das tarefas anteriores.

- [ ] Rodar todos os testes, typecheck e build Cloudflare.
- [ ] Aplicar a migração e executar a reparação em produção.
- [ ] Auditar contagens: 1.252 OS reconciliadas, 51 sem data de entrada e 58 entradas em outubro/2026.
- [ ] Publicar no Cloudflare e executar o smoke test.

