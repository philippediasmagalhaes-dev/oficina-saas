# Professional Workshop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar todo o produto e entregar contas a pagar, receber e caixa com parcelas e baixas parciais.

**Architecture:** Manter Next/React, Drizzle, Neon e Cloudflare. Ampliar o ledger existente com contas, fornecedores, baixas e sessões de caixa; expor o financeiro em rotas dedicadas que compartilham filtros e componentes densos.

**Tech Stack:** Next 16, React 19, TypeScript, Drizzle ORM/PostgreSQL, Vitest, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-10-26-professional-workshop-redesign-design.md`

## Global Constraints

- Preservar dados existentes por migrações aditivas.
- Toda operação deve ser limitada por `workshopId`.
- Sem login de funcionário; página do mecânico continua sem dados financeiros.
- Manter Cloudflare/Neon e não alterar Vercel.
- Não enviar WhatsApp real nem fazer consulta de placa paga nos testes.
- Conciliação automática e fiscal contábil permanecem fora do escopo.

## Review Focus

- Baixa parcial nunca pode ultrapassar o saldo e deve quitar exatamente em zero.
- Estorno deve reabrir o saldo sem apagar o histórico.
- Lançamentos antigos quitados, sem baixas detalhadas, devem continuar aparecendo como quitados.
- Todas as páginas e ações financeiras devem impedir acesso cruzado entre oficinas.
- Parcelas devem somar exatamente o valor original, inclusive quando os centavos não dividem igualmente.

---

### Task 1: Modelo financeiro profissional

**Files:**
- Create: `domain/financial-ledger.ts`
- Create: `domain/financial-ledger.test.ts`
- Create: `db/migrations/0013_professional_finance.sql`
- Modify: `db/schema.ts`
- Modify: `db/migrations/meta/_journal.json`
- Test: `db/operations-schema.test.ts`

**Interfaces:**
- Produces: `calculateEntryBalance`, `deriveEntryStatus`, `splitInstallments`, tabelas `financialAccounts`, `suppliers`, `financialSettlements`, `cashSessions`.

- [ ] Escrever testes falhando para saldo, parcial, quitação, estorno e divisão de parcelas.
- [ ] Executar `npx vitest run domain/financial-ledger.test.ts` e confirmar falha pela ausência das funções.
- [ ] Implementar as funções puras e executar o teste até passar.
- [ ] Escrever teste de esquema/migração para novas tabelas, colunas e índices; confirmar falha.
- [ ] Adicionar a migração aditiva e atualizar o schema Drizzle; executar os testes de banco.
- [ ] Executar `npm test` e `npm run typecheck`.
- [ ] Commit: `feat: add operational finance ledger model`.

### Task 2: Serviços financeiros, filtros e ações

**Files:**
- Modify: `server/finance.ts`
- Modify: `server/finance.test.ts`
- Modify: `server/queries.ts`
- Modify: `app/actions.ts`
- Create: `domain/financial-filters.ts`
- Create: `domain/financial-filters.test.ts`

**Interfaces:**
- Consumes: modelo da Task 1.
- Produces: listagens paginadas por direção/status, criação parcelada, baixa parcial, estorno, contas, fornecedores e sessões de caixa.

- [ ] Escrever testes falhando para filtros de vencimento e paginação.
- [ ] Implementar normalização dos filtros e fazê-los passar.
- [ ] Escrever testes de serviço para baixa parcial, quitação, estorno e isolamento por oficina; confirmar falhas.
- [ ] Implementar serviços transacionais e ações validadas.
- [ ] Escrever teste para divisão parcelada e recorrência sem duplicidade; implementar.
- [ ] Executar `npm test` e `npm run typecheck`.
- [ ] Commit: `feat: add finance operations and partial settlements`.

### Task 3: Shell, navegação e sistema visual

**Files:**
- Modify: `components/app-shell.tsx`
- Create: `components/app-shell.test.tsx`
- Create: `components/mobile-more-menu.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: navegação agrupada no desktop e cinco destinos no mobile.

- [ ] Escrever teste falhando para grupos, destinos e menu móvel compacto.
- [ ] Implementar a nova arquitetura de navegação e fazê-la passar.
- [ ] Aplicar tokens, superfícies, tipografia, botões, tabelas, etiquetas e responsividade.
- [ ] Executar testes de componentes, suíte e typecheck.
- [ ] Commit: `feat: introduce professional workshop shell`.

### Task 4: Dashboard operacional

**Files:**
- Modify: `server/queries.ts`
- Modify: `app/page.tsx`
- Create: `domain/dashboard-priorities.ts`
- Create: `domain/dashboard-priorities.test.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: quatro indicadores, alertas e contagens operacionais por status.

- [ ] Escrever testes falhando para priorização de vencidos, prontos, estoque e retornos.
- [ ] Implementar derivação das prioridades e consulta limitada.
- [ ] Refazer a página inicial com cabeçalho funcional, alertas, fluxo e pendências.
- [ ] Executar testes, suíte e typecheck.
- [ ] Commit: `feat: rebuild operational dashboard`.

### Task 5: Experiência financeira em cinco visões

**Files:**
- Modify: `app/financeiro/page.tsx`
- Create: `app/financeiro/receber/page.tsx`
- Create: `app/financeiro/pagar/page.tsx`
- Create: `app/financeiro/caixa/page.tsx`
- Create: `app/financeiro/relatorios/page.tsx`
- Create: `components/finance-nav.tsx`
- Create: `components/financial-entry-table.tsx`
- Create: `components/financial-entry-form.tsx`
- Create: `components/financial-settlement-form.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: serviços da Task 2 e shell da Task 3.
- Produces: visão geral e rotas dedicadas com tabelas compactas e ações de baixa.

- [ ] Escrever testes de componentes falhando para status, saldo e ações disponíveis.
- [ ] Criar navegação financeira e tabela compartilhada.
- [ ] Criar formulário de título, parcelas e recorrência em painel compacto.
- [ ] Criar baixa parcial/total e estorno.
- [ ] Montar Visão geral, Receber, Pagar, Caixa e Relatórios.
- [ ] Mover categorias e taxas para Configurações.
- [ ] Executar testes, suíte e typecheck.
- [ ] Commit: `feat: separate finance into operational views`.

### Task 6: Fornecedores, NF-e e fechamento de caixa

**Files:**
- Modify: `server/nfe-intake.ts`
- Modify: `server/nfe-intake.test.ts`
- Modify: `components/nfe-import-form.tsx`
- Modify: `app/actions.ts`
- Modify: `app/estoque/page.tsx`
- Modify: `app/financeiro/caixa/page.tsx`

**Interfaces:**
- Consumes: fornecedores, títulos e contas financeiras.
- Produces: opção explícita de gerar conta a pagar pela NF-e e abertura/fechamento de caixa.

- [ ] Escrever teste falhando para fornecedor idempotente e conta da NF-e sem duplicidade.
- [ ] Implementar integração transacional e revisão no formulário.
- [ ] Escrever teste falhando para cálculo/fechamento do caixa.
- [ ] Implementar abertura e fechamento com diferença declarada.
- [ ] Executar testes, suíte e typecheck.
- [ ] Commit: `feat: connect purchases and daily cash control`.

### Task 7: Padronização, migração e entrega

**Files:**
- Modify: páginas restantes em `app/` somente para títulos funcionais e classes compartilhadas.
- Modify: `docs/deployment/2026-10-25-operations-release.md`
- Modify: `scripts/smoke-deployment.mjs`

**Interfaces:**
- Consumes: todas as tarefas anteriores.
- Produces: produto consistente, migração aplicada e deploy validado.

- [ ] Revisar clientes, veículos, OS, estoque, serviços, retenção, colaboradores e configurações com a linguagem visual nova.
- [ ] Executar `npm test`, `npm run typecheck`, `npm run build:cloudflare` e auditoria de produção.
- [ ] Aplicar a migração 0013 no Neon production e confirmar contagens preservadas.
- [ ] Publicar na Cloudflare e executar smoke público e navegação autenticada sem mutações.
- [ ] Registrar evidências de versão, migração e pendências.
- [ ] Commit: `chore: validate professional workshop release`.

