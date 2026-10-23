# Complete Paulinho Autocar Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every internally implementable item in the approved Paulinho Autocar workshop specification and leave external providers behind explicit, safe configuration states.

**Architecture:** Extend the existing tenant-scoped Next.js monolith with additive Drizzle tables and focused domain modules for inspections, collaborators, finance, exports, plate lookup, and messaging. Work-order closing is the transactional boundary: it snapshots commissions, taxes, fees, inventory and ledger entries. External providers use small adapters with manual fallbacks so missing credentials never block workshop operation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Neon Postgres, Better Auth, Cloudflare Workers/R2, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-10-20-real-workshop-operations-design.md`

## Global Constraints

- The owner is the only authenticated operator; collaborators never receive login identities.
- Every business read and mutation is tenant-scoped by the authenticated workshop.
- Money is integer cents and percentages are basis points.
- Closed work orders preserve immutable financial snapshots.
- Commissions apply only to discounted labor and total participation cannot exceed 100%.
- External integrations fail gracefully and retain manual fallbacks.
- The current WhatsApp Business number must not be migrated, disconnected, or replaced.
- Direct Business Fin API integration remains deferred; the pilot ships one-way CSV.
- The deployed runtime remains Cloudflare Workers with Neon and R2.

## Review Focus

- Concurrent work-order creation must produce unique sequential numbers within each workshop; Task 2 adds a database transaction test.
- Collaborator participation above 100% must be rejected before money is persisted; Task 4 adds a domain and validator test.
- Split payments, card fees, tax reserve, and commissions must still reconcile exactly to the closed order total; Task 6 adds reconciliation tests with rounding boundaries.
- Retrying finalization or exports must not duplicate inventory movements, ledger entries, commissions, or CSV rows; Tasks 5 and 7 add idempotency tests.
- Missing or failing plate/WhatsApp provider credentials must preserve manual operation without leaking secrets; Tasks 8 and 9 add adapter failure tests.

---

### Task 1: Additive production schema

**Files:**
- Modify: `db/schema.ts`
- Create: `db/operations-schema.test.ts`
- Create: `db/migrations/0004_real_workshop_operations.sql`
- Modify: `db/migrations/meta/_journal.json`

**Interfaces:**
- Produces tenant-scoped tables for workshop settings/sequences, inspections, status events, approvals, collaborators, assignments, payments, financial entries, fee rules, message outbox/deliveries, and export history.
- Extends customers, vehicles, service records, work-order items, workshops, and inventory without renaming existing tables.

- [x] Write schema contract tests for all required columns, indexes, constraints, and enum values.
- [x] Run `npm test -- db/operations-schema.test.ts` and verify it fails because the new schema is absent.
- [x] Add the minimal Drizzle schema and SQL migration; all changes must be additive and keep existing records readable.
- [x] Run the schema test and `npm run typecheck`; expect both to pass.
- [x] Commit with `feat: add real workshop operations schema`.

### Task 2: Workshop identity, customer/vehicle details, and sequential OS numbers

**Files:**
- Create: `domain/workshop-settings.ts`
- Create: `domain/workshop-settings.test.ts`
- Modify: `server/validators.ts`
- Modify: `server/drizzle-repository.ts`
- Modify: `server/vehicles.ts`
- Modify: `server/work-orders.ts`
- Modify: `app/actions.ts`
- Modify: `components/forms.tsx`
- Modify: `components/work-order-form.tsx`
- Modify: `app/configuracoes/page.tsx`
- Modify: `app/clientes/page.tsx`
- Modify: `app/clientes/[id]/editar/page.tsx`
- Modify: `app/veiculos/page.tsx`
- Modify: `app/veiculos/[id]/page.tsx`

**Interfaces:**
- Produces `nextWorkOrderNumber(tx, workshopId): Promise<number>` and complete settings/customer/vehicle input contracts.
- Work orders expose a stable `orderNumber` used by later print, finance, and export tasks.

- [x] Write failing validator/domain/repository tests for complete workshop, customer, and vehicle data and atomic order numbering.
- [x] Run the focused tests and confirm failures identify missing fields and sequence logic.
- [x] Implement forms, actions, repository persistence, normalized plates/phones, and transactional numbering.
- [x] Run focused tests, typecheck, and existing CRM/work-order tests; expect green.
- [x] Commit with `feat: complete workshop customer and vehicle records`.

### Task 3: Intake inspection, damage map, status history, and quote versions

**Files:**
- Create: `domain/inspection.ts`
- Create: `domain/inspection.test.ts`
- Create: `components/intake-inspection-form.tsx`
- Create: `components/damage-map.tsx`
- Create: `server/inspections.ts`
- Create: `server/inspections.test.ts`
- Modify: `server/work-orders.ts`
- Modify: `app/actions.ts`
- Modify: `app/ordens/[id]/page.tsx`
- Modify: `app/orcamento/[token]/page.tsx`

**Interfaces:**
- Produces `saveInspection`, normalized damage marks, append-only `recordStatusEvent`, and quote approval/version records.
- Later A4 printing consumes inspection, status, and approval summaries from `getWorkOrder`.

- [x] Write failing tests for checklist normalization, damage coordinate bounds, append-only events, and reapproval after a material quote change.
- [x] Run focused tests and verify expected failures.
- [x] Implement the inspection UI and persistence, damage-map controls, status history, and quote-version approval records.
- [x] Run focused tests, public quote tests, and typecheck; expect green.
- [x] Commit with `feat: add vehicle intake and auditable work order history`.

### Task 4: Collaborators and labor-only compensation

**Files:**
- Create: `domain/commissions.ts`
- Create: `domain/commissions.test.ts`
- Create: `server/collaborators.ts`
- Create: `server/collaborators.test.ts`
- Create: `components/collaborator-form.tsx`
- Create: `components/assignment-form.tsx`
- Create: `app/colaboradores/page.tsx`
- Modify: `server/validators.ts`
- Modify: `server/queries.ts`
- Modify: `app/actions.ts`
- Modify: `app/ordens/[id]/page.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Produces `calculateAssignmentCompensation(input): CompensationSnapshot` and CRUD/assignment operations.
- Task 6 consumes assignment snapshots when closing an order.

- [x] Write failing tests for monthly fixed, fixed-per-service, percentage, hybrid, labor-only commission, rounding, and participation limits.
- [x] Run focused tests and confirm the commission API is absent.
- [x] Implement collaborator records, service overrides, multi-collaborator assignments, and owner-only UI.
- [x] Run focused tests and typecheck; expect green.
- [x] Commit with `feat: add collaborators and labor compensation`.

### Task 5: Inventory reservation and idempotent consumption

**Files:**
- Modify: `domain/inventory.ts`
- Modify: `domain/inventory.test.ts`
- Create: `server/inventory.ts`
- Create: `server/inventory.test.ts`
- Modify: `server/work-orders.ts`
- Modify: `app/estoque/page.tsx`
- Modify: `app/actions.ts`

**Interfaces:**
- Produces `reserveApprovedOrderStock`, `consumeReservedOrderStock`, and `releaseCancelledOrderStock` with audited movement keys.
- Task 6 invokes consumption inside the finalization transaction.

- [x] Write failing tests for reserve, insufficient availability, release, consume, negative-stock protection, and retry idempotency.
- [x] Run focused tests and verify failures.
- [x] Implement reservation quantity, authoritative movement ledger, lifecycle hooks, and movement history UI.
- [x] Run focused and existing inventory/work-order tests; expect green.
- [x] Commit with `feat: reserve and audit work order stock`.

### Task 6: Payments, card fees, tax reserve, commissions, and financial closing

**Files:**
- Create: `domain/financial-closing.ts`
- Create: `domain/financial-closing.test.ts`
- Create: `server/finance.ts`
- Create: `server/finance.test.ts`
- Create: `components/payment-form.tsx`
- Create: `components/financial-settings-form.tsx`
- Modify: `components/finalization-form.tsx`
- Modify: `server/work-orders.ts`
- Modify: `server/queries.ts`
- Modify: `server/validators.ts`
- Modify: `app/actions.ts`
- Modify: `app/financeiro/page.tsx`
- Modify: `app/configuracoes/page.tsx`

**Interfaces:**
- Produces `calculateFinancialClosing(input): FinancialClosing`, split-payment persistence, fee-rule lookup, tax snapshots, immutable ledger creation, and cash/accrual reporting.
- Business Fin export consumes `FinancialEntrySummary` from this task.

- [x] Write failing tests for split payments, installments, percentage/fixed card fees, manual overrides, tax reserve, commissions, rounding, cash/accrual recognition, and idempotent close.
- [x] Run focused tests and verify failures.
- [x] Implement settings, payment editor, transactional close, receivables/payables, recurring fixed collaborator payables, attachments metadata, and filterable reports.
- [x] Run finance/work-order tests and typecheck; expect green.
- [x] Commit with `feat: add complete financial closing and reporting`.

### Task 7: Business Fin CSV export

**Files:**
- Create: `domain/business-fin.ts`
- Create: `domain/business-fin.test.ts`
- Create: `app/api/financeiro/business-fin/route.ts`
- Modify: `app/financeiro/page.tsx`

**Interfaces:**
- Produces `toBusinessFinCsv(entries): string` with stable external IDs and an export-history write after a successful response.

- [x] Write failing tests for UTF-8 BOM, Brazilian decimal/date formatting, stable IDs, CSV escaping, and duplicate-resistant selection.
- [x] Run focused tests and confirm failures.
- [x] Implement the pure mapper, authenticated CSV route, period selection, and export-history persistence.
- [x] Run focused tests, route tests, and typecheck; expect green.
- [x] Commit with `feat: export financial entries to Business Fin`.

### Task 8: Assisted plate lookup with manual fallback

**Files:**
- Create: `server/plate-lookup.ts`
- Create: `server/plate-lookup.test.ts`
- Create: `app/api/veiculos/consultar-placa/route.ts`
- Create: `components/plate-lookup-form.tsx`
- Modify: `components/forms.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces `lookupPlate(plate, provider): Promise<PlateLookupResult>` and a server-only provider adapter.
- Vehicle forms remain fully editable and manual when the provider is disabled or unavailable.

- [x] Write failing tests for plate normalization, disabled configuration, provider mapping, timeout/error fallback, and secret redaction.
- [x] Run focused tests and verify failures.
- [x] Implement the adapter, protected route, confirmation UI, cache metadata, and manual fallback.
- [x] Run focused tests and typecheck; expect green.
- [x] Commit with `feat: add assisted vehicle plate lookup`.

### Task 9: WhatsApp outbox, reminders, opt-out, and manual fallback

**Files:**
- Create: `domain/reminders.ts`
- Create: `domain/reminders.test.ts`
- Create: `server/whatsapp.ts`
- Create: `server/whatsapp.test.ts`
- Create: `app/api/cron/whatsapp-reminders/route.ts`
- Create: `app/api/webhooks/whatsapp/route.ts`
- Modify: `domain/outreach.ts`
- Modify: `server/queries.ts`
- Modify: `app/retencao/page.tsx`
- Modify: `app/configuracoes/page.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces deterministic reminder candidates, idempotent outbox keys, Cloud API delivery adapter, webhook status updates, opt-out tracking, and unchanged `wa.me` fallback.

- [ ] Write failing tests for consent, quiet hours, due/overdue schedule, cooldown, opt-out, idempotency, disabled credentials, and webhook verification.
- [ ] Run focused tests and verify failures.
- [ ] Implement outbox scheduling, secured cron, provider adapter, webhook, delivery history, settings status, and manual fallback.
- [ ] Run focused tests and typecheck; expect green.
- [ ] Commit with `feat: automate consented WhatsApp reminders`.

### Task 10: Printable A4 work order and final interface integration

**Files:**
- Create: `app/ordens/[id]/imprimir/page.tsx`
- Create: `app/ordens/[id]/imprimir/print.css`
- Create: `app/ordens/[id]/imprimir/page.test.tsx`
- Modify: `app/ordens/[id]/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/brand.css`
- Modify: `components/app-shell.tsx`
- Modify: `app/page.tsx`
- Modify: `app/financeiro/page.tsx`

**Interfaces:**
- Produces the authenticated A4 route using the complete work-order read model and browser print action.

- [ ] Write failing render tests for workshop/customer/vehicle identity, checklist, damage marks, labor/parts/totals, payments, warranty/terms, signatures, and the absence of Wi-Fi credentials.
- [ ] Run focused tests and verify failures.
- [ ] Implement economical one-page-first print layout, continuation behavior, print button, compact dashboard/actions, and complete navigation.
- [ ] Run UI tests, accessibility-oriented render checks, and typecheck; expect green.
- [ ] Commit with `feat: add printable A4 order and finish pilot interface`.

### Task 11: Migration, full verification, production deploy, and smoke test

**Files:**
- Modify: `scripts/smoke-deployment.mjs`
- Modify: `scripts/smoke-deployment.test.ts`
- Modify: `docs/deployment/cloudflare-pilot.md`
- Modify: `README.md`

**Interfaces:**
- Consumes every previous task and produces a migrated, deployed, recoverable pilot plus an explicit external-configuration checklist.

- [ ] Extend smoke tests for login, current-month dashboard, customer/vehicle edit, OS creation, inspection, public quote, A4 print, collaborator assignment, financial filters, CSV export, and integration fallback states.
- [ ] Run the smoke test test-suite and confirm the new assertions fail before script changes.
- [ ] Implement the extended smoke checks and deployment documentation.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build:cloudflare`, migration against the configured Neon database, and the production smoke test; all must exit zero.
- [ ] Review the requirements line by line against the approved spec and record only external account dependencies as pending.
- [ ] Commit with `chore: validate complete Paulinho Autocar pilot`.
- [ ] Deploy to Cloudflare, verify the production version, and preserve the feature branch for review.
