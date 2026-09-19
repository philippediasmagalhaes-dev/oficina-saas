# Natinho Scooters MVP Readiness Design

## Intent and success criteria

Revisit the existing workshop-management MVP and make the browser experience credible for a pilot customer without requiring external credentials. The release succeeds when the current flows preserve data across reloads, use real current dates, expose working exports, pass automated domain tests, build on Next.js 16, and clearly document what still requires production infrastructure.

## Audit findings

- The production build passes and `npm audit --omit=dev` reports zero vulnerabilities.
- Orders, clients, and appointments are held only in React memory and disappear on reload.
- Business rules, identifiers, status transitions, persistence parsing, and CSV formatting have no tests.
- Dates and dashboard totals are hard-coded, so the interface becomes visibly stale.
- “Exportar CSV” and several utility controls look actionable but do nothing.
- The interface has missing accessible names on icon-only controls and no Escape-key modal dismissal.
- The codebase has no README, environment template, test command, or production-readiness checklist.
- Authentication, multi-tenant storage, billing, messaging, and file uploads require external providers and cannot be completed truthfully without credentials and product decisions.

## Selected approach

Keep the MVP as a client-rendered Next.js app, but extract deterministic domain operations into a tested TypeScript module. Add versioned local persistence for a single-device pilot, resilient fallback for malformed saved data, dynamic date labels, CSV export, JSON backup, and accessible modal/control behavior. This is lower risk than introducing an unauthenticated database and gives the next backend phase a clean domain boundary.

## Architecture

- `lib/workshop.ts` owns types, seed data, state transitions, validation, versioned serialization, and CSV generation. It has no browser or React dependency.
- `hooks/useWorkshop.ts` hydrates from `localStorage`, persists state after hydration, and exposes typed mutation methods.
- `app/page.tsx` remains the presentation shell but consumes the hook instead of owning duplicated business rules.
- Vitest exercises the domain module with literal expectations and malformed-input cases.
- `README.md` and `.env.example` document local use, Vercel deployment, delivered MVP scope, and external production prerequisites.

## Behavior

- Existing seed data appears on first visit.
- Orders, clients, and appointments created in the UI survive reloads on the same browser.
- Corrupt or incompatible saved data never crashes the app; seed data is restored.
- Work-order status follows `Agendada → Em execução → Concluída`; completed orders remain completed.
- CSV exports quote commas, quotes, and line breaks and include all visible order fields.
- JSON backup downloads the versioned persisted state.
- Header and agenda dates use `pt-BR` and the current local date.
- Modals close with Escape, icon-only buttons receive accessible labels, and export actions provide visible confirmation.

## Error handling and limits

Local persistence errors are caught; the in-memory session continues and seed data remains available. Downloads use object URLs and always revoke them. The MVP explicitly labels storage as local-only in documentation. Authentication, authorization, shared data, payments, messaging, uploads, backups, and audit logs remain production prerequisites.

## Verification

- `npm test` runs all Vitest domain tests.
- `npm run build` validates TypeScript and Next.js production output.
- `npm audit --omit=dev` must report zero vulnerabilities.
- A requirements checklist maps each finding to implementation or an explicit external prerequisite.
