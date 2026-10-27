# Dashboard Month Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir consulta mensal do faturamento e serviços concluídos no dashboard.

**Architecture:** O parâmetro `mes` é validado por `parseMonthPeriod`, convertido em limites UTC e enviado a uma consulta de repositório limitada ao período. A operação corrente permanece independente do mês histórico selecionado.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Vitest, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-10-27-dashboard-month-filter-design.md`

## Global Constraints

- Não adicionar dependências.
- Aplicar o intervalo no banco para proteger os limites do Worker.
- Preservar o mês atual como padrão e a operação corrente nos demais cards.

## Review Focus

- Valor `mes` inválido deve cair no mês atual.
- O limite final do mês deve ser exclusivo.
- Meses sem serviços devem mostrar zero sem erro.
- A consulta não pode trazer serviços fora do período.
- O seletor deve continuar utilizável em telas pequenas.

---

### Task 1: Consulta mensal e interface

**Files:**
- Modify: `server/ports.ts`
- Modify: `server/drizzle-repository.ts`
- Modify: `server/queries.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `domain/dates.test.ts`
- Test: `app/dashboard-month-filter.test.tsx`

**Interfaces:**
- Consumes: `parseMonthPeriod(value?: string, now?: Date)`.
- Produces: `listServicesByPeriod(workshopId: string, from: Date, to: Date): Promise<ServiceSummary[]>` e dashboard com `?mes=AAAA-MM`.

- [ ] Escrever testes falhando para o seletor, fallback e intervalo exclusivo.
- [ ] Implementar a consulta restrita por `completed_at >= from` e `< to`.
- [ ] Passar o mês validado por `getDashboardData` e renderizar o filtro no cabeçalho.
- [ ] Ajustar responsividade e executar testes direcionados.
- [ ] Executar suíte, tipos, builds e commit.

### Task 2: Revisão e publicação

**Files:**
- Review: diff completo contra `origin/main`.

**Interfaces:**
- Consumes: entrega testada da Task 1.
- Produces: PR integrado e versão Cloudflare validada.

- [ ] Solicitar revisão independente do branch.
- [ ] Corrigir achados críticos/importantes com RED→GREEN.
- [ ] Integrar no `main`, publicar Cloudflare e executar smoke test.
