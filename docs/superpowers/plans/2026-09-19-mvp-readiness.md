# Natinho Scooters MVP Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current visual prototype into a testable, reload-safe single-device MVP and document the remaining production integrations.

**Architecture:** Extract pure workshop operations into `lib/workshop.ts`, persist them through `hooks/useWorkshop.ts`, and keep `app/page.tsx` focused on rendering and browser interactions. Vitest protects domain behavior while the Next build validates integration.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript 5, Vitest, browser `localStorage`, Blob downloads.

**Spec:** `docs/superpowers/specs/2026-09-19-mvp-readiness-design.md`

## Global Constraints

- Do not introduce external services, credentials, or unauthenticated cloud persistence.
- Preserve the Natinho Scooters black, yellow, and white identity.
- Saved state schema version is exactly `1` and storage key is exactly `natinho-scooters:workshop:v1`.
- All business rules added in this plan are implemented test-first.
- `npm test`, `npm run build`, and `npm audit --omit=dev` must pass before completion.

## Review Focus

- Malformed or older local data must fall back to seed data without throwing.
- Status advancement must not move a completed order backward.
- IDs must remain unique after reloading saved data.
- CSV values containing commas, quotes, or new lines must remain valid.
- Server rendering must not access `window` or `localStorage`.

---

### Task 1: Tested workshop domain

**Files:**
- Create: `lib/workshop.ts`
- Create: `lib/workshop.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `WorkshopState`, `WorkOrder`, `Client`, `Appointment`, `initialWorkshopState`, `addOrder`, `addClient`, `addAppointment`, `advanceOrderStatus`, `serializeWorkshop`, `parseWorkshop`, `ordersToCsv`.
- Consumes: no application interfaces.

- [ ] **Step 1: Install Vitest and add `npm test`**

Run: `npm install --save-dev vitest`

Add scripts: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 2: Write failing tests**

Create tests covering malformed persistence fallback, monotonic status advancement, unique generated IDs, chronological appointments, and RFC-4180-style CSV quoting with literal expected rows.

Run: `npm test -- lib/workshop.test.ts`

Expected: FAIL because `lib/workshop.ts` does not exist.

- [ ] **Step 3: Implement the pure domain module**

Define the exact types and functions in the Interfaces block. `parseWorkshop` returns a fresh seed clone for invalid data or schema versions other than `1`. Generated numeric suffixes use the highest existing ID plus one. `advanceOrderStatus` leaves `Concluída` unchanged.

- [ ] **Step 4: Verify green**

Run: `npm test -- lib/workshop.test.ts`

Expected: all domain tests pass with zero warnings.

- [ ] **Step 5: Commit**

Commit message: `feat: add tested workshop domain`

### Task 2: Reload-safe application state

**Files:**
- Create: `hooks/useWorkshop.ts`
- Modify: `app/page.tsx`
- Modify: `lib/workshop.test.ts`

**Interfaces:**
- Consumes: every exported domain interface from Task 1.
- Produces: `useWorkshop()` returning state, hydration status, and typed mutations.

- [ ] **Step 1: Add a failing persistence round-trip test**

Assert that a state with newly added records survives `serializeWorkshop` then `parseWorkshop` with exact IDs and values.

Run: `npm test -- lib/workshop.test.ts`

Expected: FAIL until the round-trip contract is complete.

- [ ] **Step 2: Implement the hook and integrate the page**

The hook initializes with seed data during SSR, reads storage only in `useEffect`, sets `hydrated`, then writes only after hydration. Replace page-owned create/advance logic with hook methods and render a polite loading state only while browser hydration runs.

- [ ] **Step 3: Verify green and build**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: production build exits 0 and prerenders `/`.

- [ ] **Step 4: Commit**

Commit message: `feat: persist workshop data locally`

### Task 3: Honest working actions and accessibility

**Files:**
- Create: `lib/download.ts`
- Modify: `app/page.tsx`
- Modify: `app/brand.css`
- Modify: `lib/workshop.test.ts`

**Interfaces:**
- Consumes: `ordersToCsv`, `serializeWorkshop`, and `WorkshopState` from Task 1.
- Produces: browser download helper plus working CSV/JSON actions and current-date labels.

- [ ] **Step 1: Add failing date and CSV edge tests**

Add literal expectations for quoted CSV content and a pure `formatLongDate(new Date(2026, 8, 19))` result of `SÁBADO, 19 DE SETEMBRO`.

Run: `npm test -- lib/workshop.test.ts`

Expected: FAIL because the date formatter is not exported.

- [ ] **Step 2: Implement current dates, downloads, and accessible controls**

Add `formatLongDate` and `formatAgendaDate` to the domain module. Add a browser-only `downloadTextFile` helper that revokes object URLs. Wire CSV export and JSON backup buttons, add Escape dismissal to the modal, add `aria-label` to icon-only buttons, and remove the non-functional light/dark toggle because the selected brand is dark-only.

- [ ] **Step 3: Verify behavior**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: production build exits 0.

- [ ] **Step 4: Commit**

Commit message: `feat: complete MVP actions and accessibility`

### Task 4: Production-readiness documentation and release gate

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: the finished behavior from Tasks 1-3.
- Produces: setup, deployment, scope, and prerequisite documentation.

- [ ] **Step 1: Document delivered scope and external prerequisites**

Document local commands, Vercel deployment, local-only persistence limitations, and required future configuration for database, authentication, file storage, messaging, billing, monitoring, backups, domain, and LGPD policies. `.env.example` lists named placeholders without secrets.

- [ ] **Step 2: Complete metadata**

Add favicon metadata using `/logo.jpg`, Open Graph title/description, theme color `#050505`, and viewport configuration.

- [ ] **Step 3: Run the complete release gate**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: production build exits 0.

Run: `npm audit --omit=dev`

Expected: `found 0 vulnerabilities`.

- [ ] **Step 4: Commit**

Commit message: `docs: add MVP production readiness guide`
