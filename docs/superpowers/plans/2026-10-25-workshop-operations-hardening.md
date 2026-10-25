# Workshop Operations Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Cloudflare CPU-limit failures and deliver the requested operational improvements for the Paulinho Autocar pilot.

**Architecture:** Keep Next/Vinext server rendering, but move filtering, counts, and pagination into PostgreSQL and keep Worker responses bounded. Add focused domain/services for configurable finance, remuneration, retention, notifications, NF-e intake, and the mechanic workflow while reusing the current workshop-scoped authorization model.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Neon PostgreSQL, Cloudflare Workers/Vinext, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-workshop-operations-hardening-design.md`

## Global Constraints

- Default list page size is 24 and all list queries are workshop-scoped.
- No employee login is introduced.
- WhatsApp requires stored consent; automatic sending additionally requires the configured official provider and template.
- No invoice import mutates inventory until the owner confirms the parsed review.
- Existing imported data and financial snapshots must remain intact.

## Review Focus

- A search containing `%`, `_`, accents, or an invalid page value returns a bounded safe result.
- A workshop cannot read or mutate another workshop's customers, rules, categories, invoices, or OS data.
- A customer without valid WhatsApp consent never enters the automatic outbox.
- Repeated approval/ready/invoice actions are idempotent and do not duplicate alerts, messages, or stock.
- Learned oil-change cadence handles missing or decreasing odometers by falling back to six months.

---

### Task 1: Bounded list queries and compact navigation

**Files:**
- Create: `domain/pagination.ts`
- Test: `domain/pagination.test.ts`
- Modify: `server/drizzle-repository.ts`, `server/vehicles.ts`, `server/work-orders.ts`, `server/queries.ts`
- Modify: `app/clientes/page.tsx`, `app/veiculos/page.tsx`, `app/ordens/page.tsx`, `app/globals.css`

**Interfaces:**
- Produces: `normalizePageRequest`, `buildPageWindow`, paged customer/vehicle/order query results with `items`, `total`, `page`, `pageSize`, `pageCount`.
- Consumes: existing workshop context and Drizzle schema.

- [ ] Write failing tests for invalid pages, clamping, and first/last navigation.
- [ ] Run `npm test -- domain/pagination.test.ts` and observe failure.
- [ ] Implement pagination helpers and database-bounded customer, vehicle, and order searches.
- [ ] Render search forms, 24-row compact lists, and pagination links; keep new-OS form data out of the default list response.
- [ ] Run focused tests, typecheck, and commit `fix: bound workshop list rendering`.

### Task 2: Small OS and communication usability fixes

**Files:**
- Modify: `components/plate-lookup-form.tsx`, `components/plate-lookup-form.test.tsx`
- Create: `components/whatsapp-link.tsx`, `components/whatsapp-link.test.tsx`
- Modify: `app/ordens/[id]/page.tsx`, `app/ordens/[id]/imprimir/print.css`, `app/actions.ts`, `server/whatsapp.ts`

**Interfaces:**
- Produces: one clear ready-message action, OS share draft, new-tab manual WhatsApp links, bounded print typography.
- Consumes: existing quote/ready draft builders and outbox idempotency keys.

- [ ] Add failing UI/domain tests for price-free lookup label, new-tab links, and a single ready action.
- [ ] Run focused tests and observe failure.
- [ ] Implement the copy/typography changes, OS WhatsApp share, and deduplicated ready workflow.
- [ ] Run focused tests, typecheck, and commit `feat: streamline work order communication`.

### Task 3: Remuneration management and commission report

**Files:**
- Modify: `server/collaborators.ts`, `server/collaborators.test.ts`, `server/validators.ts`, `app/actions.ts`
- Modify: `components/collaborator-form.tsx`, `app/colaboradores/page.tsx`, `app/globals.css`

**Interfaces:**
- Produces: update/deactivate collaborator, update/delete service rate, payable commission report by period.
- Consumes: existing compensation snapshots and labor-only assignment rule.

- [ ] Add failing tests for workshop ownership, rule deletion, historical snapshot preservation, and period totals.
- [ ] Run focused tests and observe failure.
- [ ] Implement mutations, explanatory cards, edit/delete controls, and the payment report.
- [ ] Run focused tests, typecheck, and commit `feat: manage remuneration rules and payables`.

### Task 4: Financial categories, installment fees, and numeric inputs

**Files:**
- Modify: `db/schema.ts`, create generated migration
- Create: `server/financial-categories.ts`, `server/financial-categories.test.ts`
- Create: `components/money-input.tsx`, `components/money-input.test.tsx`
- Modify: `server/finance.ts`, `server/finance.test.ts`, `server/queries.ts`, `server/validators.ts`, `app/actions.ts`
- Modify: `app/financeiro/page.tsx`, `app/configuracoes/page.tsx`, `components/financial-settings-form.tsx`, `components/payment-form.tsx`

**Interfaces:**
- Produces: workshop categories seeded for automotive use, category CRUD, installment fee edit/deactivate, select-all Brazilian numeric input behavior.
- Consumes: automatic financial entry category keys and existing cash/accrual ledger.

- [ ] Add failing tests for default categories, protected system categories, installment lookup, and decimal input normalization.
- [ ] Run focused tests and observe failure.
- [ ] Implement schema, services, forms, and clearer “Pagamento recebido” help text.
- [ ] Generate migration, run focused tests/typecheck, and commit `feat: expand workshop financial controls`.

### Task 5: Retention intelligence, service catalog, and safe consent

**Files:**
- Modify: `domain/forecast.ts`, `domain/forecast.test.ts`, `domain/outreach.ts`, `domain/outreach.test.ts`
- Create: `server/retention.ts`, `server/retention.test.ts`
- Modify: `server/queries.ts`, `server/whatsapp.ts`, `app/retencao/page.tsx`, `app/actions.ts`
- Modify: `db/seed-owner.ts` or create an idempotent catalog seed service and tests

**Interfaces:**
- Produces: service-aware message drafts, learned oil-change km cadence with six-month fallback, idempotent automotive catalog defaults, confirmed-consent bulk action with audit source.
- Consumes: completed OS items, odometer history, service return intervals, contact events.

- [ ] Add failing tests for cadence learning, invalid odometers, six-month fallback, service-specific copy, idempotent seed, and consent audit.
- [ ] Run focused tests and observe failure.
- [ ] Implement the retention query/cards, defaults, messages, and explicit consent-confirmation workflow.
- [ ] Run focused tests/typecheck and commit `feat: add intelligent automotive retention`.

### Task 6: Approval alerts, NF-e stock intake, damage map, and mechanic mode

**Files:**
- Create: `server/notifications.ts`, `server/notifications.test.ts`, `app/notificacoes/page.tsx`
- Create: `domain/nfe.ts`, `domain/nfe.test.ts`, `components/nfe-import-form.tsx`
- Modify: `server/inventory.ts`, `server/inventory.test.ts`, `app/estoque/page.tsx`, `app/actions.ts`
- Modify: `components/damage-map.tsx`, `components/intake-inspection-form.tsx`
- Create: `app/mecanico/[token]/page.tsx`, `server/mechanic-access.ts`, `server/mechanic-access.test.ts`

**Interfaces:**
- Produces: idempotent in-app approval alerts, reviewed NF-e XML stock entry, accessible damage points, short-lived workshop-device mechanic execution link.
- Consumes: quote approval/status events, inventory operation keys, existing inspection and photo services.

- [ ] Add failing tests for idempotent alerts/imports, malformed NF-e, cross-workshop access, token expiry, and damage coordinates.
- [ ] Run focused tests and observe failure.
- [ ] Implement notifications, XML review/confirmation, damage-map polish, and restricted mechanic page.
- [ ] Run migrations, full tests, typecheck, Cloudflare build/smoke; commit `feat: complete workshop intake workflows`.

### Task 7: Production verification

**Files:**
- Modify: `docs/deployment/paulinho-pilot-acceptance-2026-10-23.md`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: deployment and acceptance evidence.

- [ ] Run the full Vitest suite, TypeScript check, and Cloudflare production build.
- [ ] Deploy the committed branch and run authenticated checks for `/clientes`, `/veiculos`, and `/ordens` plus the public smoke suite.
- [ ] Confirm Cloudflare logs show successful bounded requests without `exceededCpu` and record remaining external configuration.
- [ ] Commit `docs: record workshop hardening acceptance`.

