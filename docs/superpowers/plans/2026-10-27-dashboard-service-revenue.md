# Dashboard Service Revenue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no Dashboard quais serviços do mês geraram mais receita de mão de obra.

**Architecture:** Uma consulta mensal carrega em lote itens de mão de obra e OS concluídas. Um agregador puro combina itens atuais com fallback das OS legadas, e um componente server-rendered apresenta o ranking.

**Tech Stack:** TypeScript, Next.js, React, Drizzle ORM, PostgreSQL/Neon, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-dashboard-service-revenue-design.md`

## Global Constraints

- Respeitar o mês selecionado e o escopo da oficina autenticada.
- Incluir apenas OS concluídas ou entregues.
- Excluir peças do ranking.
- Evitar consulta por OS; no máximo duas consultas em lote para a análise.
- Preservar registros antigos sem itens usando fallback de catálogo/descrição.

## Review Focus

- OS com peças e serviços: apenas a mão de obra deve entrar.
- OS atual com item de serviço: não deve entrar novamente pelo fallback legado.
- Descrições equivalentes com diferenças de acento, caixa e espaços: devem agrupar.
- Serviço com desconto maior que o bruto: receita não pode ficar negativa.
- Mês sem serviços: o Dashboard deve renderizar estado vazio sem erro.

---

### Task 1: Cálculo e consulta mensal

**Files:**
- Create: `domain/dashboard-service-revenue.ts`
- Create: `domain/dashboard-service-revenue.test.ts`
- Create: `server/dashboard-service-revenue.ts`
- Modify: `server/queries.ts`

**Interfaces:**
- Consumes: `workshopId`, `{ from: Date; to: Date }`, tabelas `serviceRecords`, `workOrderItems` e `serviceCatalogItems`.
- Produces: `listDashboardServiceRevenue(workshopId: string, period: { from: Date; to: Date }): Promise<ServiceRevenueSummary[]>` e `data.serviceRevenue`.

- [ ] **Step 1: Write the failing tests**

Testar `summarizeServiceRevenue` com itens atuais, peças, desconto, OS legada, duplicidade e normalização de nomes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run domain/dashboard-service-revenue.test.ts`
Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Implement the pure aggregator and batched database query**

Criar os tipos `ServiceRevenueItem`, `ServiceRevenueOrder`, `ServiceRevenueSummary`, o agregador `summarizeServiceRevenue`, e a consulta `listDashboardServiceRevenue` com duas consultas em lote.

- [ ] **Step 4: Integrate with dashboard query**

Adicionar a consulta ao `Promise.all` de `getDashboardData` e retornar `serviceRevenue`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx vitest run domain/dashboard-service-revenue.test.ts && npm run typecheck`
Expected: PASS e saída sem erros de tipo.

- [ ] **Step 6: Commit**

Commit: `feat: add monthly service revenue analytics`

### Task 2: Quadro de receita por serviço

**Files:**
- Create: `components/dashboard-service-revenue.tsx`
- Create: `components/dashboard-service-revenue.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ServiceRevenueSummary[]` produzido pela Task 1 e `period.label`.
- Produces: `DashboardServiceRevenue` exibido no Dashboard com ranking e estado vazio.

- [ ] **Step 1: Write the failing render tests**

Testar título, valores, quantidade, participação, ordem recebida e estado vazio.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/dashboard-service-revenue.test.tsx`
Expected: FAIL porque o componente ainda não existe.

- [ ] **Step 3: Implement the component**

Criar `DashboardServiceRevenue({ items, periodLabel })`, limitar a oito linhas e dimensionar barras pela maior receita.

- [ ] **Step 4: Integrate and style**

Renderizar o quadro após os indicadores/fluxo e adicionar estilos desktop/mobile em `app/globals.css`.

- [ ] **Step 5: Verify the complete change**

Run: `npm test && npm run typecheck && npm run build && npm run build:cloudflare && npm audit --omit=dev`
Expected: todos os testes passam, ambos os builds terminam com código 0 e auditoria de produção não aponta vulnerabilidades.

- [ ] **Step 6: Commit**

Commit: `feat: show service revenue ranking on dashboard`

