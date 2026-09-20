# Owner CRM and Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-only workshop dashboard with an owner-only, Neon-backed CRM that records customers, vehicles, completed services, return opportunities, assisted WhatsApp contacts, and simple inventory.

**Architecture:** Keep a modular Next.js monolith on Vercel. Neon Auth identifies the owner, a server-only context resolves one workshop, and Drizzle modules apply that workshop ID to every query. Server Actions mutate data; pure domain functions own forecasting, campaign copy, money, and stock rules.

**Tech Stack:** Next.js 16.3+, React 19, TypeScript 5, Neon Postgres, Neon Auth, `@neondatabase/serverless`, Drizzle ORM/Kit, Vitest 5, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-20-owner-crm-inventory-design.md`

## Global Constraints

- Preserve the existing black, yellow, and white identity and `public/logo.jpg`.
- Keep the application exclusive to vehicle workshops.
- Owner-only, invitation-based access; do not add employees, schedules, billing, public sign-up, or automatic messaging.
- Use integer cents for money and server timestamps for dates.
- Derive `workshop_id` on the server; never accept it from browser input.
- Build must succeed without live credentials; configured production requests must fail closed when credentials are absent.
- Keep production and preview configuration separable through environment variables.

## Review Focus

- A forged customer, vehicle, inventory, or service ID from another workshop must be rejected without leaking whether it exists; Task 3 tests tenant-scoped lookups.
- Service consumption that would make any inventory item negative must reject the entire service operation; Task 3 tests rollback behavior through the service interface and Task 6 covers the database transaction.
- Customers without valid phone consent must never receive an actionable WhatsApp URL; Task 2 tests both missing phone and missing consent.
- Forecasting must behave deterministically for empty histories, explicit next dates, overdue dates, and inactivity thresholds; Task 2 pins all four cases.
- Missing Neon/Auth configuration must preserve `npm run build` while runtime routes show a safe configuration state; Tasks 1 and 4 test configuration parsing and the production build.

---

### Task 1: Neon and Drizzle foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `drizzle.config.ts`
- Create: `db/schema.ts`
- Create: `db/client.ts`
- Create: `db/config.ts`
- Create: `db/config.test.ts`
- Create: `db/migrations/0000_owner_crm.sql`

**Interfaces:**
- Produces: `getDatabase(): NeonDatabase<typeof schema>`; `readServerConfig(env): ServerConfigResult`; Drizzle tables `workshops`, `customers`, `vehicles`, `serviceRecords`, `inventoryItems`, `inventoryMovements`, and `contactEvents`.

- [ ] **Step 1: Write the failing configuration tests**

```ts
import { describe, expect, it } from "vitest";
import { readServerConfig } from "./config";

describe("server configuration", () => {
  it("reports every missing production dependency", () => {
    expect(readServerConfig({})).toEqual({
      configured: false,
      missing: ["DATABASE_URL", "NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"],
    });
  });

  it("accepts a complete configuration", () => {
    expect(readServerConfig({
      DATABASE_URL: "postgresql://example",
      NEON_AUTH_BASE_URL: "https://auth.example",
      NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
    })).toMatchObject({ configured: true });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- db/config.test.ts`
Expected: FAIL because `db/config.ts` does not exist.

- [ ] **Step 3: Install and configure the data layer**

Run: `npm install drizzle-orm @neondatabase/serverless ws bufferutil @neondatabase/auth zod`

Run: `npm install -D drizzle-kit @types/ws`

Implement a pure config parser that does not throw during build:

```ts
export function readServerConfig(env: Record<string, string | undefined>) {
  const required = ["DATABASE_URL", "NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"] as const;
  const missing = required.filter((key) => !env[key] || (key === "NEON_AUTH_COOKIE_SECRET" && env[key]!.length < 32));
  return missing.length
    ? { configured: false as const, missing }
    : { configured: true as const, values: Object.fromEntries(required.map((key) => [key, env[key]!])) };
}
```

Define UUID primary keys, tenant indexes, timestamps, integer cents, nonnegative stock checks, and same-workshop composite indexes in `db/schema.ts`. `getDatabase()` must read config only when invoked and use `drizzle-orm/neon-serverless` with a reusable Neon Pool.

- [ ] **Step 4: Generate and inspect the first migration**

Run: `npx drizzle-kit generate --name owner_crm`
Expected: one SQL migration containing the seven business tables, foreign keys, indexes, and stock checks. Preserve the generated filename instead of a hand-written duplicate.

- [ ] **Step 5: Run tests and type checking**

Run: `npm test -- db/config.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example drizzle.config.ts db
git commit -m "feat: add Neon data foundation"
```

### Task 2: Forecasting, retention, money, and stock rules

**Files:**
- Create: `domain/forecast.ts`
- Create: `domain/forecast.test.ts`
- Create: `domain/outreach.ts`
- Create: `domain/outreach.test.ts`
- Create: `domain/inventory.ts`
- Create: `domain/inventory.test.ts`
- Create: `domain/money.ts`
- Create: `domain/money.test.ts`

**Interfaces:**
- Produces: `classifyCustomer(input, now): "upcoming" | "overdue" | "inactive" | "current"`; `buildWhatsAppDraft(input): { message: string; url: string } | null`; `applyStockDelta(current, delta): number`; `parseCurrencyToCents(value): number`.

- [ ] **Step 1: Write forecasting tests**

```ts
it.each([
  [{ nextDueAt: "2026-10-10", lastServiceAt: "2026-09-01" }, "upcoming"],
  [{ nextDueAt: "2026-09-01", lastServiceAt: "2026-08-01" }, "overdue"],
  [{ nextDueAt: null, lastServiceAt: "2025-01-01" }, "inactive"],
  [{ nextDueAt: null, lastServiceAt: null }, "current"],
])("classifies %o as %s", (history, expected) => {
  expect(classifyCustomer({ ...history, inactivityDays: 180 }, new Date("2026-09-20T12:00:00Z"))).toBe(expected);
});
```

- [ ] **Step 2: Write outreach, stock, and money tests**

```ts
expect(buildWhatsAppDraft({ phone: "11999999999", consent: false, customer: "Ana", workshop: "Oficina" })).toBeNull();
expect(() => applyStockDelta(2, -3)).toThrow("Estoque insuficiente");
expect(parseCurrencyToCents("1.234,56")).toBe(123456);
```

- [ ] **Step 3: Run the domain tests and verify RED**

Run: `npm test -- domain`
Expected: FAIL because the domain modules are absent.

- [ ] **Step 4: Implement minimal pure functions**

Normalize Brazilian phones to digits and generate `https://wa.me/55...` only when consent is true and the number has 10 or 11 local digits. Forecast with calendar-day comparisons in UTC. Reject NaN, negative currency, and negative stock.

- [ ] **Step 5: Run domain tests and commit**

Run: `npm test -- domain`
Expected: PASS.

```bash
git add domain
git commit -m "feat: add owner CRM domain rules"
```

### Task 3: Tenant-scoped application services

**Files:**
- Create: `server/ports.ts`
- Create: `server/owner-context.ts`
- Create: `server/crm-service.ts`
- Create: `server/crm-service.test.ts`
- Create: `server/queries.ts`
- Create: `server/validators.ts`
- Create: `app/actions.ts`

**Interfaces:**
- Consumes: schema types and Task 2 domain functions.
- Produces: `CrmRepository` interface; `createCrmService(repository)`; queries `getDashboardData`, `getCustomers`, `getServiceRecords`, `getRetentionOpportunities`, and `getInventory`; server actions `createWorkshop`, `createCustomer`, `createVehicle`, `recordService`, `createInventoryItem`, `adjustInventory`, and `recordContact`.

- [ ] **Step 1: Define a repository port and write tenant-isolation tests**

```ts
export interface CrmRepository {
  findCustomer(workshopId: string, customerId: string): Promise<Customer | null>;
  listCustomers(workshopId: string): Promise<CustomerSummary[]>;
  listServices(workshopId: string): Promise<ServiceSummary[]>;
  listInventory(workshopId: string): Promise<InventorySummary[]>;
  listContactEvents(workshopId: string): Promise<ContactEvent[]>;
  recordService(input: PersistedServiceInput): Promise<ServiceRecord>;
  consumeInventoryAtomically(input: ServiceWithInventoryInput): Promise<ServiceRecord>;
}

it("rejects a customer outside the authenticated workshop", async () => {
  const repository = fakeRepository({ findCustomer: async () => null });
  await expect(createCrmService(repository).recordService({
    workshopId: "workshop-a",
    customerId: "customer-from-b",
    description: "Revisão",
    amountCents: 30000,
    completedAt: "2026-09-20",
    inventory: [],
  })).rejects.toThrow("Registro não encontrado");
});
```

- [ ] **Step 2: Add atomic inventory rejection test**

```ts
it("does not persist a service when stock consumption fails", async () => {
  const repository = fakeRepository({ consumeInventoryAtomically: async () => { throw new Error("Estoque insuficiente"); } });
  await expect(service.recordService(validInputWithInventory)).rejects.toThrow("Estoque insuficiente");
  expect(repository.recordService).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- server/crm-service.test.ts`
Expected: FAIL because the service does not exist.

- [ ] **Step 4: Implement the service, validators, and Server Action boundary**

Use Zod schemas for forms. `owner-context.ts` returns `{ userId, workshopId }` from the authenticated session and database; actions and queries call it before reading browser-supplied identifiers. `queries.ts` maps repository rows to serializable view models and calls Task 2 to classify retention opportunities. Return `{ ok: false, fieldErrors, message }` for expected validation failures and revalidate the affected routes after success.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- server/crm-service.test.ts`
Expected: PASS.

```bash
git add server app/actions.ts
git commit -m "feat: add tenant-scoped CRM services"
```

### Task 4: Neon Auth and safe configuration routing

**Files:**
- Create: `lib/auth/server.ts`
- Create: `app/api/auth/[...path]/route.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/login-form.tsx`
- Create: `app/configurar/page.tsx`
- Create: `proxy.ts`
- Modify: `app/layout.tsx`
- Create: `app/auth-shell.test.tsx`

**Interfaces:**
- Consumes: `readServerConfig`, Neon Auth `createNeonAuth`, and `createWorkshop`.
- Produces: `auth`; protected application routes; owner sign-in; first-login workshop setup.

- [ ] **Step 1: Write shell tests**

```tsx
it("renders an owner-only login without public registration", () => {
  const html = renderToStaticMarkup(<LoginForm />);
  expect(html).toContain("Acesso do proprietário");
  expect(html).not.toContain("Criar conta");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- app/auth-shell.test.tsx`
Expected: FAIL because the login shell is absent.

- [ ] **Step 3: Implement Neon Auth from the official Next.js integration**

Create `auth = createNeonAuth({ baseUrl, cookies: { secret, sessionDataTtl: 300 } })`, expose `auth.handler()`, and protect all application routes through `proxy.ts` while allowing `/login`, `/api/auth`, static assets, and metadata. The login form calls a Server Action wrapping `auth.signIn.email` and redirects to `/`. Do not render or link a sign-up flow.

When config is missing, `/` must render a safe "Configuração pendente" page listing variable names only; never render secret values or throw during build.

- [ ] **Step 4: Run auth shell, type, and build checks**

Run: `npm test -- app/auth-shell.test.tsx db/config.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS without `.env.local`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth app/api app/login app/configurar app/layout.tsx app/auth-shell.test.tsx proxy.ts
git commit -m "feat: add owner authentication"
```

### Task 5: Owner CRM interface and reduced navigation

**Files:**
- Replace: `app/page.tsx`
- Create: `components/app-shell.tsx`
- Create: `components/empty-state.tsx`
- Create: `components/forms.tsx`
- Create: `app/clientes/page.tsx`
- Create: `app/servicos/page.tsx`
- Create: `app/retencao/page.tsx`
- Create: `app/estoque/page.tsx`
- Create: `app/configuracoes/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/brand.css`
- Modify: `app/page.test.tsx`

**Interfaces:**
- Consumes: Task 3 actions, Task 2 formatting/forecasting, authenticated workshop queries.
- Produces: six-module owner UI with responsive navigation and empty states.

- [ ] **Step 1: Rewrite the navigation contract test**

```tsx
const html = renderToStaticMarkup(<AppShell workshopName="Natinho Scooters">conteúdo</AppShell>);
for (const label of ["Visão geral", "Clientes", "Serviços", "Retenção", "Estoque", "Configurações"]) {
  expect(html).toContain(label);
}
expect(html).not.toContain("Agenda");
expect(html).not.toContain("Equipe");
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL because the old dashboard still exposes agenda and operational modules.

- [ ] **Step 3: Implement the application shell and dashboard**

Split the old monolithic page. The dashboard shows persisted revenue, services recorded, active customers, upcoming returns, inactive opportunities, and low-stock count. If no database is configured, render the configuration state. If configured but the owner has no workshop, redirect to `/configurar`.

- [ ] **Step 4: Implement customer, service, retention, stock, and settings pages**

Use semantic forms and tables/cards that collapse cleanly on mobile. Every empty state includes one primary action. Retention rows show classification reason and an assisted WhatsApp action only when consent and phone requirements pass. Inventory rows highlight low stock and expose entry/adjustment forms.

- [ ] **Step 5: Run UI tests and accessibility checks**

Run: `npm test -- app/page.test.tsx app/auth-shell.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app components
git commit -m "feat: build owner CRM interface"
```

### Task 6: Drizzle repository, migration validation, and production setup

**Files:**
- Create: `server/drizzle-repository.ts`
- Create: `server/drizzle-repository.integration.test.ts`
- Modify: `server/owner-context.ts`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Implements: `CrmRepository` from Task 3.
- Produces: transactionally safe production persistence and documented Neon/Vercel setup.

- [ ] **Step 1: Add an opt-in integration test**

```ts
const run = process.env.TEST_DATABASE_URL ? it : it.skip;
run("records a service and inventory movements atomically", async () => {
  const repository = createDrizzleRepository(process.env.TEST_DATABASE_URL!);
  const fixture = await createIsolatedWorkshopFixture(repository);
  await repository.consumeInventoryAtomically(fixture.serviceWithOnePart);
  expect(await repository.getInventoryQuantity(fixture.partId)).toBe(1);
  expect(await repository.countServiceRecords(fixture.workshopId)).toBe(1);
});
```

- [ ] **Step 2: Implement the Drizzle repository**

Use an interactive Neon transaction. Resolve all referenced records with both `id` and `workshop_id`. Lock/update inventory with a nonnegative condition; if any update returns zero rows, throw and roll back the service plus all movements.

- [ ] **Step 3: Apply migration to the configured Neon branch**

Run: `npm run db:migrate`
Expected: migration exits 0 against `DATABASE_URL` and tables appear in Neon.

- [ ] **Step 4: Run integration and full verification**

Run: `npm test`
Expected: all unit tests pass; integration test passes when `TEST_DATABASE_URL` is configured, otherwise reports skipped.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

Run: `npm audit`
Expected: 0 vulnerabilities.

- [ ] **Step 5: Commit**

```bash
git add server README.md .env.example package.json package-lock.json
git commit -m "feat: connect owner CRM to Neon"
```

### Task 7: Vercel configuration and release verification

**Files:**
- Modify only if required by verified build output: `vercel.json`

**Interfaces:**
- Consumes: Neon connection URL, Neon Auth base URL, and a generated 32+ character cookie secret through Vercel environment variables.
- Produces: production deployment for the exact release commit.

- [ ] **Step 1: Connect the existing Neon project to the Vercel project**

In Vercel, add Neon to `oficina-saas`, scope production credentials to Production, and enable separate Preview branches. Add `NEON_AUTH_BASE_URL` and a generated `NEON_AUTH_COOKIE_SECRET` without copying their values into files or chat.

- [ ] **Step 2: Configure Neon Auth**

Enable email/password authentication, disable public sign-up, allow `https://oficina-saas-green.vercel.app`, and create the first invited owner. Apply the Drizzle migration to the production branch.

- [ ] **Step 3: Push and wait for Vercel**

Run: `git push origin main`
Expected: Vercel creates a Production deployment for the pushed commit and reports `Ready`.

- [ ] **Step 4: Perform live smoke tests**

Verify the login screen has no public sign-up, authenticated first access reaches workshop setup, customer/service/inventory forms persist across reloads, an insufficient-stock service is rejected without partial writes, retention produces a safe `wa.me` link only for a consenting customer, and mobile navigation exposes all six modules.

- [ ] **Step 5: Record evidence**

Capture the release commit, Vercel deployment ID, test counts, build result, audit result, and any external production settings still requiring the owner.
