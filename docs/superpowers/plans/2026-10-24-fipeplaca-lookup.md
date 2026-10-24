# FipePlaca Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consultar dados cadastrais do veículo pela placa via FipePlaca por R$ 0,08, com cache e fallback manual seguros.

**Architecture:** Manter o contrato de provedor existente e adicionar um adaptador FipePlaca que entende autenticação, saldo e códigos de erro. Reusar o snapshot salvo no veículo por 30 dias e impedir consultas repetidas no formulário enquanto a placa não mudar.

**Tech Stack:** Next.js 16, TypeScript, React 19, Vitest, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-10-24-fipeplaca-lookup-design.md`

## Global Constraints

- Uma consulta de cadastro usa somente `GET /placa/{placa}`.
- O token nunca sai do servidor nem entra em logs ou snapshots.
- Não realizar retentativa automática de consulta paga.
- Falhas nunca bloqueiam o cadastro manual.
- Não consultar nem armazenar Renavam ou dados do proprietário.

## Review Focus

- Resposta FipePlaca com `cilindradas` e chassi já mascarado deve mapear corretamente.
- `SEM_SALDO`, `CHAVE_INVALIDA`, `PLACA_NAO_ENCONTRADA` e 503 devem produzir mensagens seguras distintas.
- O endpoint padrão deve ser usado apenas quando o provedor é `fipeplaca`.
- Cache com menos de 30 dias deve evitar chamada paga; cache vencido deve consultar.
- Alterar a placa depois de um resultado deve reabilitar o botão; repetir a mesma placa não deve cobrar novamente.

---

### Task 1: Adaptador FipePlaca e erros seguros

**Files:**
- Modify: `server/plate-lookup.ts`
- Modify: `server/plate-lookup.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `PlateProviderResponse`, `PlateProviderError`, `configuredPlateProvider(env, fetcher?)` e resultado com `balanceCents`.

- [ ] Escrever testes falhos para endpoint padrão, cabeçalho Bearer, saldo, campos FipePlaca e códigos de erro.
- [ ] Implementar o adaptador sem retentativa automática.
- [ ] Rodar `npm test -- server/plate-lookup.test.ts` e confirmar aprovação.
- [ ] Commitar a tarefa.

### Task 2: Proteções de custo no endpoint e formulário

**Files:**
- Modify: `server/plate-lookup.ts`
- Modify: `server/plate-lookup.test.ts`
- Modify: `app/api/veiculos/consultar-placa/route.ts`
- Modify: `components/plate-lookup-form.tsx`
- Create: `components/plate-lookup-form.test.tsx`

**Interfaces:**
- Consumes: resultado do adaptador com `balanceCents`.
- Produces: resultado com `cached` e interface que bloqueia consulta repetida até a placa mudar.

- [ ] Escrever testes falhos para cache de 30 dias e comportamento do formulário.
- [ ] Implementar cache sinalizado e mensagens de custo/saldo.
- [ ] Rodar os testes focados e confirmar aprovação.
- [ ] Commitar a tarefa.

### Task 3: Verificação e documentação operacional

**Files:**
- Modify: `docs/deployment/cloudflare-pilot.md`

**Interfaces:**
- Consumes: variáveis e comportamento das tarefas anteriores.

- [ ] Documentar criação da conta, recarga mínima, chave única e configuração dos segredos.
- [ ] Rodar suíte completa, typecheck e build Cloudflare.
- [ ] Registrar que a ativação real depende de `PLATE_LOOKUP_API_TOKEN` e saldo no provedor.
