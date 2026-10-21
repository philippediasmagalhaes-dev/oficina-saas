# Cloudflare Pilot Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Paulinho Car pilot to Cloudflare Workers and private R2 storage without losing data, while keeping Neon as the database, preserving the existing Vercel deployment as a tested rollback, and making the application installable as a safe online-first PWA.

**Architecture:** Keep the current owner-only Next.js monolith and Neon/Better Auth data model. Add a second vinext build target for Cloudflare Workers, isolate photo binaries behind a portable S3-compatible `PhotoStorage` interface, retain legacy Base64 photo reads during migration, and expose only authenticated photo responses. Keep all business pages network-only; cache only versioned public PWA assets.

**Tech Stack:** Next.js 16.4, React 19, TypeScript 5, Vitest 5, vinext, Vite, Cloudflare Workers, Cloudflare R2, `aws4fetch`, Neon Postgres, Drizzle ORM/Kit, Better Auth, Vercel rollback.

**Spec:** `docs/superpowers/specs/2026-10-21-cloudflare-pilot-deployment-design.md`

## Global Constraints

- Work in a new isolated Git worktree created from commit `5458bef`; do not modify the unrelated dirty files in the main checkout.
- Do not remove or replace `npm run dev`, `npm run build`, `npm run vercel-build`, `next.config.ts`, or `vercel.json`; Cloudflare scripts are additive.
- Keep Neon as the single source of truth and do not change customer, vehicle, order, inventory, quote, or authentication identifiers.
- Keep the R2 bucket private. Never expose R2 credentials or add them under a `NEXT_PUBLIC_` name.
- Preserve the current 2 MB upload limit and the JPEG, PNG, and WebP allow-list.
- Generate storage keys exclusively on the server and include both `workshopId` and `serviceRecordId` in the prefix.
- A photo metadata row may be created only after a successful object upload. If the insert fails, attempt object cleanup before returning the original error.
- Keep `data_base64` readable and populated during the first migration. Clearing it is a separate, explicitly deferred operation.
- Authenticated HTML, API routes, Server Actions, customer data, financial data, work orders, and photos must not be stored in the service-worker cache.
- Do not change the canonical production URL until the temporary Workers deployment passes the complete smoke checklist.
- Do not delete the Vercel project, Vercel variables, Neon data, legacy photo content, or R2 objects during this plan.
- Do not commit `.env.local`, `.dev.vars`, account IDs, API tokens, access keys, passwords, or generated deployment state.

## Review Focus

- **Dual runtime:** Task 1 must leave both `npm run build` and `npm run build:cloudflare` green from the same commit.
- **Tenant isolation:** Tasks 2 and 4 must prove that object keys contain the authenticated workshop/order scope and that `/api/photos/<id>` still looks up the photo through the authenticated workshop.
- **Failure consistency:** Task 4 must test upload failure, metadata failure with best-effort delete, missing R2 objects, and legacy Base64 fallback.
- **Zero-loss migration:** Tasks 3 and 5 must keep `data_base64` nullable-but-readable, migrate only rows without `storage_key`, verify byte counts, and remain safe to rerun.
- **Private storage:** Task 2 must sign server-side S3-compatible requests; no public bucket URL or credential may reach client code.
- **PWA privacy:** Task 6 must prove that only an explicit immutable asset allow-list is cached and every other request uses the network.
- **Real rollback:** Task 7 must configure R2 credentials on Vercel and document the authentication URL switch required before calling Vercel production-ready.
- **Cost guardrails:** Task 7 records Workers CPU errors and quota signals; any valid workshop flow hitting a free-tier CPU limit blocks cutover and triggers the documented paid-plan or Vercel decision.

---

### Task 0: Create the isolated worktree and establish the baseline

**Files:**
- Read only: repository at commit `5458bef`
- Do not modify: the main checkout's `.gitignore`, `.agency-build/`, `.codex-presentation/`, `.studio-v2-work/`, `.studio-vercel/`, `feijoada-dali*`, `logo.jpg`, `output/`, or `tmp/`

**Interfaces:**
- Produces: one attached worktree dedicated to this plan, based on `5458bef`.
- Consumes: the approved spec and plan only.

- [ ] **Step 1: Create and attach an isolated worktree**

Use the Codex worktree tool with name `cloudflare-pilot` and ref `5458bef`. Use the returned workspace directory for every later command.

Expected: an attached worktree on a `codex/` branch with a clean `git status --short`.

- [ ] **Step 2: Verify the exact starting point**

Run: `git rev-parse HEAD`

Expected: `5458bef...`.

Run: `git status --short`

Expected: no output.

- [ ] **Step 3: Install and run the existing baseline**

Run: `npm ci`

Expected: dependencies install without modifying `package-lock.json`.

Run: `npm test`

Expected: all existing unit tests pass; the database integration suite may report an explicit skip when `TEST_DATABASE_URL` is absent.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: the current Next.js production build succeeds.

Run: `npx vinext@latest check`

Expected: compatibility scan exits 0 with no partial or unsupported findings. If this result differs from the approved 100% baseline, stop before changing code and diagnose the version difference.

### Task 1: Add a second Cloudflare build target without weakening Vercel

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `vite.config.ts`
- Create: `cloudflare.config.ts`
- Create or modify if generated by vinext: `wrangler.jsonc`
- Create if generated by vinext: `.assetsignore`
- Create: `app/cloudflare-config.test.ts`

**Interfaces:**
- Preserves: `dev`, `build`, `vercel-build`, and `start` as the Next.js/Vercel path.
- Produces: `dev:cloudflare`, `build:cloudflare`, `preview:cloudflare`, and `deploy:cloudflare` scripts.
- Produces: a Worker named `oficina-saas` with a compatibility date of at least `2026-10-21`, `nodejs_compat`, source maps, preview URLs, and observability enabled.

- [ ] **Step 1: Write a failing dual-build configuration test**

Create a test that reads `package.json` and the committed Cloudflare configuration and asserts:

```ts
expect(pkg.scripts.dev).toBe("next dev");
expect(pkg.scripts.build).toBe("next build");
expect(pkg.scripts["build:cloudflare"]).toBeDefined();
expect(pkg.scripts["deploy:cloudflare"]).toBeDefined();
expect(cloudflareConfigText).toContain("oficina-saas");
expect(cloudflareConfigText).toContain("2026-10-21");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- app/cloudflare-config.test.ts`

Expected: FAIL because the Cloudflare scripts/configuration do not exist.

- [ ] **Step 3: Initialize vinext for Cloudflare and review every generated change**

Run: `npx vinext@latest init --platform=cloudflare --name oficina-saas`

Expected: vinext adds its Vite/Cloudflare dependencies and configuration. Before continuing, restore the original meanings of `dev`, `build`, `vercel-build`, and `start` if the initializer changed them.

Set additive scripts to the project-local tools selected by the initializer. The intended behavior is:

```json
{
  "dev": "next dev",
  "build": "next build",
  "vercel-build": "npm run db:migrate && next build",
  "start": "next start",
  "dev:cloudflare": "vinext dev",
  "build:cloudflare": "vinext build",
  "preview:cloudflare": "npm run build:cloudflare && vinext start",
  "deploy:cloudflare": "vinext-cloudflare deploy"
}
```

Use the exact deploy command emitted by the installed vinext version if its local binary name differs. Do not rely on an unpinned `@latest` command in a committed script.

- [ ] **Step 4: Protect generated local state**

Add `.wrangler/`, `.dev.vars*`, `dist/`, and any vinext local state directory to `.gitignore`, retaining `!.dev.vars.example` if a safe example file is introduced. Ensure `_worker.js` and `_routes.json` are excluded from static asset upload if the generated adapter requires `.assetsignore`.

- [ ] **Step 5: Run the dual-runtime verification**

Run: `npm test -- app/cloudflare-config.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: Next.js/Vercel build succeeds.

Run: `npm run build:cloudflare`

Expected: vinext produces a Cloudflare production bundle and the generated Worker configuration without a compatibility error.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore vite.config.ts cloudflare.config.ts wrangler.jsonc .assetsignore app/cloudflare-config.test.ts
git commit -m "build: add Cloudflare Workers target"
```

Add only files that exist; do not create placeholder adapter files.

### Task 2: Add the private portable R2 storage adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `server/photo-storage.ts`
- Create: `server/photo-storage.test.ts`

**Interfaces:**
- Produces: `PhotoStorage` with `put(key, body, contentType)`, `get(key)`, and `delete(key)`.
- Produces: `readPhotoStorageConfig(env)` returning either all four R2 values or a typed missing-variable result.
- Produces: `buildPhotoStorageKey({ workshopId, serviceRecordId, photoId, mimeType })`.
- Consumes: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` only on the server.

- [ ] **Step 1: Write failing configuration and key-isolation tests**

Cover all required behaviors:

```ts
expect(readPhotoStorageConfig({}).missing).toEqual([
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
]);

expect(buildPhotoStorageKey({
  workshopId: "workshop-a",
  serviceRecordId: "order-b",
  photoId: "photo-c",
  mimeType: "image/jpeg",
})).toBe("workshops/workshop-a/orders/order-b/photo-c.jpg");
```

Also test `.png` and `.webp`, rejection of unsupported MIME types, encoding of path components, and that no key accepts a caller-provided prefix.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- server/photo-storage.test.ts`

Expected: FAIL because `server/photo-storage.ts` does not exist.

- [ ] **Step 3: Install and implement the R2 adapter**

Run: `npm install aws4fetch`

Implement the S3 endpoint as `https://<account-id>.r2.cloudflarestorage.com/<bucket>/<encoded-key>`. Sign `PUT`, `GET`, and `DELETE` requests with `AwsClient`, `service: "s3"`, and `region: "auto"`. Treat non-2xx responses as controlled storage errors that include the operation and status but never credential values or response bodies containing provider diagnostics.

`get` returns `{ body: Uint8Array; contentType: string | null } | null`; map HTTP 404 to `null`. `put` must send the recorded allow-listed content type. `delete` is idempotent: HTTP 404 is success.

- [ ] **Step 4: Add safe environment documentation**

Add only empty/example values to `.env.example`:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=oficina-saas-photos
AUTH_TRUSTED_ORIGINS=http://localhost:3000
```

- [ ] **Step 5: Verify the adapter**

Run: `npm test -- server/photo-storage.test.ts`

Expected: PASS, using a mocked `fetch`; no real bucket request occurs.

Run: `npm run typecheck`

Expected: PASS in both DOM/Node and Worker-compatible types.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example server/photo-storage.ts server/photo-storage.test.ts
git commit -m "feat: add private R2 photo storage"
```

### Task 3: Make the photo table migration-safe

**Files:**
- Modify: `db/schema.ts`
- Create: `db/photo-schema.test.ts`
- Create: `db/migrations/0003_photo_object_storage.sql`
- Modify: `db/migrations/meta/_journal.json`
- Create if generated: `db/migrations/meta/0003_snapshot.json`

**Interfaces:**
- Adds: `servicePhotos.storageKey: string | null` mapped to `storage_key`.
- Adds: `servicePhotos.sizeBytes: number | null` mapped to `size_bytes`.
- Changes: `servicePhotos.dataBase64` from required to nullable without dropping existing content.
- Adds: nonnegative check for `size_bytes` when present and a partial unique index for non-null storage keys.

- [ ] **Step 1: Write a failing schema contract test**

Use Drizzle's table metadata to assert the new column names and nullability. Read the generated SQL in the test and assert it contains:

```sql
ALTER TABLE "service_photos" ALTER COLUMN "data_base64" DROP NOT NULL;
ALTER TABLE "service_photos" ADD COLUMN "storage_key" text;
ALTER TABLE "service_photos" ADD COLUMN "size_bytes" integer;
```

Also assert the migration does not contain `DROP COLUMN "data_base64"`, `DELETE FROM "service_photos"`, or an update that clears legacy content.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- db/photo-schema.test.ts`

Expected: FAIL because the storage columns and migration are absent.

- [ ] **Step 3: Update the schema and generate the migration**

Change `dataBase64` to nullable, add `storageKey` and `sizeBytes`, and add the nonnegative check/index.

Run: `npm run db:generate -- --name photo_object_storage`

Expected: one new migration. Inspect and edit only if necessary to guarantee a non-destructive `DROP NOT NULL` plus additive columns/check/index. Do not hand-create a second migration for the same schema change.

- [ ] **Step 4: Verify locally and against an opt-in test database**

Run: `npm test -- db/photo-schema.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

If `TEST_DATABASE_URL` is present, run the existing database integration suite after applying the migration to that disposable database. Never use the production `DATABASE_URL` for this test.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts db/photo-schema.test.ts db/migrations
git commit -m "feat: prepare photo metadata for object storage"
```

### Task 4: Route new uploads and reads through R2 with legacy fallback

**Files:**
- Create: `server/photo-service.ts`
- Create: `server/photo-service.test.ts`
- Modify: `server/work-orders.ts`
- Modify: `app/actions.ts`
- Modify: `app/api/photos/[id]/route.ts`
- Modify: `db/config.ts`
- Modify: `db/config.test.ts`
- Modify: `lib/auth/server.ts`

**Interfaces:**
- Produces: `createPhotoService({ storage, repository })` with `upload(input)` and `read(workshopId, photoId)`.
- Changes: new uploads accept `Uint8Array`, not Base64, and persist `{ storageKey, sizeBytes, dataBase64: null }`.
- Preserves: the public application path `/api/photos/<id>` and authenticated workshop lookup.
- Adds: optional comma-separated `AUTH_TRUSTED_ORIGINS`, normalized to URL origins and passed to Better Auth as `trustedOrigins`.

- [ ] **Step 1: Define fake ports and write failing photo lifecycle tests**

Test these cases without Neon or R2:

1. successful object upload occurs before metadata insert;
2. storage upload failure creates no metadata row;
3. metadata insert failure calls `delete(storageKey)` and rethrows the insert error;
4. cleanup failure does not hide the original insert error;
5. a row with `storageKey` reads R2 bytes;
6. a row without `storageKey` reads decoded legacy `dataBase64`;
7. a missing object returns a controlled unavailable result rather than corrupted bytes;
8. a photo belonging to another workshop is indistinguishable from a missing photo.

The core orchestration contract should be dependency-injected:

```ts
type PhotoRepository = {
  findOrder(workshopId: string, serviceRecordId: string): Promise<{ id: string } | null>;
  insertPhoto(input: NewPhotoMetadata): Promise<void>;
  findPhoto(workshopId: string, photoId: string): Promise<PhotoMetadata | null>;
};
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- server/photo-service.test.ts db/config.test.ts`

Expected: FAIL because the photo service and trusted-origin parser are not implemented.

- [ ] **Step 3: Implement the orchestration and Drizzle adapter calls**

Generate a fresh `photoId` on the server, build the scoped object key, upload bytes, then insert the row using that same ID. Keep the order existence check scoped by `workshopId`. Replace the old `addServicePhoto` and `getServicePhoto` implementations with adapters used by `createPhotoService`; do not expose the storage client to React components.

Parse `AUTH_TRUSTED_ORIGINS` as an optional comma-separated server setting. Reject invalid URL entries in the pure parser, deduplicate origins, always include `BETTER_AUTH_URL`, and pass the result to Better Auth.

- [ ] **Step 4: Update the upload action**

Keep the existing `File` presence, 2 MB size, and MIME checks. Convert `file.arrayBuffer()` to `new Uint8Array(...)` and send binary data to the photo service. Do not create a Base64 string for new uploads.

- [ ] **Step 5: Update the authenticated photo route**

Keep `getOwnerContext()` before lookup. Return the bytes from the photo service with the database MIME type and:

```http
Cache-Control: private, max-age=3600
X-Content-Type-Options: nosniff
Content-Disposition: inline
```

Return 404 for an unknown/foreign-workshop photo and 503 for a known row whose R2 object is temporarily unavailable. Do not redirect to an R2 URL.

- [ ] **Step 6: Verify all upload and read paths**

Run: `npm test -- server/photo-service.test.ts server/photo-storage.test.ts db/config.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all existing tests remain green.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/photo-service.ts server/photo-service.test.ts server/work-orders.ts app/actions.ts app/api/photos/[id]/route.ts db/config.ts db/config.test.ts lib/auth/server.ts
git commit -m "feat: store work order photos in R2"
```

### Task 5: Add an idempotent legacy-photo migration command

**Files:**
- Create: `server/photo-migration.ts`
- Create: `server/photo-migration.test.ts`
- Create: `scripts/migrate-service-photos-to-r2.ts`
- Modify: `package.json`
- Modify: `package-lock.json` only if dependency metadata changes
- Modify: `README.md`

**Interfaces:**
- Produces: `migrateLegacyPhotos({ repository, storage, batchSize, dryRun, log })`.
- Produces: `npm run db:migrate-photos:r2 -- --dry-run` and `npm run db:migrate-photos:r2`.
- Selects only rows where `storage_key IS NULL AND data_base64 IS NOT NULL`.
- Records `storage_key` and `size_bytes` only after the uploaded byte count matches the decoded source length.

- [ ] **Step 1: Write failing migration behavior tests**

Cover:

- already migrated rows are skipped;
- dry-run reports candidates without calling storage or updating the database;
- successful rows upload, verify byte length, and update metadata;
- a rerun finds no candidates and produces no duplicate objects;
- upload or length mismatch leaves `storage_key` null and keeps `data_base64` intact;
- one failed row is reported and does not prevent remaining rows in the batch from being attempted;
- logs contain photo IDs and outcomes but never Base64 data or credentials.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- server/photo-migration.test.ts`

Expected: FAIL because the migration module does not exist.

- [ ] **Step 3: Implement the pure migration loop and CLI adapter**

Default to batches of 25 to limit memory. The CLI must require complete database and R2 configuration, print counts for `candidate`, `migrated`, `skipped`, and `failed`, and set a nonzero exit code when any row fails. It must never clear `data_base64`.

- [ ] **Step 4: Document safe execution and rollback**

In `README.md`, document this exact order:

1. apply schema migration;
2. run dry-run;
3. run the migration command;
4. rerun dry-run and expect zero candidates;
5. verify sample legacy photos on Workers and Vercel;
6. retain Base64 until a later explicit cleanup release.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- server/photo-migration.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```bash
git add server/photo-migration.ts server/photo-migration.test.ts scripts/migrate-service-photos-to-r2.ts package.json package-lock.json README.md
git commit -m "feat: migrate legacy photos to R2 safely"
```

### Task 6: Make the pilot installable without caching workshop data

**Files:**
- Create: `app/manifest.ts`
- Create: `app/pwa.test.ts`
- Create: `components/service-worker-registration.tsx`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: manifest with name `Oficina CRM`, short name `Oficina`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, and the black/red/white Paulinho Car identity.
- Produces: a service worker whose cache contains only `/logo.jpg` and the committed PWA icons.
- Preserves: network-only behavior for navigation, `/api/*`, authentication, photos, Server Actions, and all data requests.

- [ ] **Step 1: Write failing manifest and privacy tests**

Test the manifest fields and icon sizes. Read `public/sw.js` as text and assert that its immutable allow-list contains only public image paths. Assert the file does not cache `/`, `request.mode === "navigate"`, `/api`, HTML, or generic GET requests.

Also parse each PNG header and verify the declared 192x192 and 512x512 dimensions.

- [ ] **Step 2: Run the PWA tests and verify RED**

Run: `npm test -- app/pwa.test.ts`

Expected: FAIL because the manifest, worker, and icons do not exist.

- [ ] **Step 3: Create branded icons from `public/logo.jpg`**

Create square 192 and 512 pixel icons with enough solid background padding that the Paulinho Car mark remains readable. Create the maskable icon with the important mark inside the central safe zone. Inspect all three rendered files before committing.

- [ ] **Step 4: Implement safe registration and caching**

Register `/sw.js` from a tiny client component after page load and include it once in the root layout. The service worker may precache only the exact immutable image allow-list. For every fetch not in that list, return `fetch(request)` without writing the response to Cache Storage. Delete obsolete named caches during activation.

Add `manifest: "/manifest.webmanifest"` to metadata and keep the existing theme color and icons as fallbacks.

- [ ] **Step 5: Verify PWA behavior**

Run: `npm test -- app/pwa.test.ts app/theme-import.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: Next.js build includes the manifest route.

Run: `npm run build:cloudflare`

Expected: Cloudflare build includes the manifest, service worker, logo, and icons as static assets.

- [ ] **Step 6: Commit**

```bash
git add app/manifest.ts app/pwa.test.ts app/layout.tsx components/service-worker-registration.tsx public/sw.js public/icons
git commit -m "feat: add privacy-safe installable PWA"
```

### Task 7: Add the deployment runbook and complete local release verification

**Files:**
- Modify: `README.md`
- Create: `docs/deployment/cloudflare-pilot.md`
- Create: `scripts/smoke-deployment.mjs`
- Create: `scripts/smoke-deployment.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json` only if dependency metadata changes

**Interfaces:**
- Produces: `npm run smoke:deployment -- <base-url>` for public, non-mutating checks.
- Produces: a manual authenticated checklist for owner-only and state-changing flows.
- Documents: Cloudflare, R2, Neon, Better Auth, Vercel rollback, quota monitoring, and exact cutover order.

- [ ] **Step 1: Write a failing smoke-runner test**

Mock `fetch` and assert the runner checks:

- `/login` returns 200 and contains the owner login shell;
- `/manifest.webmanifest` returns installable JSON;
- `/sw.js`, `/logo.jpg`, and all declared icons return 200 with appropriate content types;
- `/api/photos/<random-uuid>` without a session does not expose a photo;
- redirect responses stay on the supplied deployment origin.

The script must accept only `http:` or `https:` base URLs, apply a timeout to every request, and print no cookies or response bodies.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- scripts/smoke-deployment.test.ts`

Expected: FAIL because the smoke runner does not exist.

- [ ] **Step 3: Implement the public smoke runner and runbook**

Add `smoke:deployment` to `package.json`. The runbook must contain:

- required Cloudflare account/R2 steps;
- all secret variable names without values;
- Neon migration and legacy-photo migration order;
- temporary Workers URL smoke test;
- authenticated manual checklist from the spec;
- Vercel R2 configuration before cutover;
- canonical URL change order;
- rollback procedure, including swapping `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` back to Vercel and redeploying;
- Workers Free CPU/request monitoring and paid-plan trigger conditions;
- explicit instruction never to clear legacy Base64 in this release.

- [ ] **Step 4: Verify the smoke runner**

Run: `npm test -- scripts/smoke-deployment.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the complete release matrix with fresh output**

Run: `npm test`

Expected: all unit tests pass; database integration is either PASS with `TEST_DATABASE_URL` or explicitly skipped.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: Next.js/Vercel production build succeeds.

Run: `npx vinext check`

Expected: exits 0 with no partial or unsupported findings.

Run: `npm run build:cloudflare`

Expected: Workers production build succeeds.

Run: `npm audit --omit=dev`

Expected: no known high or critical production vulnerabilities. Investigate rather than suppress any finding.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/deployment/cloudflare-pilot.md scripts/smoke-deployment.mjs scripts/smoke-deployment.test.ts package.json package-lock.json
git commit -m "docs: add Cloudflare pilot release runbook"
```

### Task 8: Provision, deploy, migrate, verify, and cut over

**Files:**
- No credential files are committed.
- Update only if the deployed URL must be recorded: `docs/deployment/cloudflare-pilot.md`

**Interfaces:**
- Produces: private R2 bucket `oficina-saas-photos`.
- Produces: temporary and then canonical `workers.dev` deployment.
- Preserves: Vercel as a functioning rollback against the same Neon database and R2 bucket.

- [ ] **Step 1: Verify Cloudflare authentication without exposing tokens**

Run: `npx wrangler whoami`

Expected: the intended Cloudflare account is shown. If authentication is absent, complete the provider's browser/device login flow; do not paste tokens into chat, commands, or committed files.

- [ ] **Step 2: Create the private bucket and scoped S3 credentials**

Run: `npx wrangler r2 bucket create oficina-saas-photos`

Expected: the bucket exists and public access/custom domains are disabled.

In Cloudflare, create an R2 API token restricted to object read/write for this bucket. Record the Account ID, Access Key ID, and Secret Access Key in the user's password manager, not the repository.

- [ ] **Step 3: Configure Worker secrets**

Add these through Wrangler's secret mechanism or the Cloudflare dashboard:

```text
DATABASE_URL
BETTER_AUTH_SECRET
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Set non-secret production variables only after the first deploy reveals the assigned URL:

```text
BETTER_AUTH_URL=https://<worker>.workers.dev
NEXT_PUBLIC_APP_URL=https://<worker>.workers.dev
AUTH_TRUSTED_ORIGINS=https://<worker>.workers.dev,https://oficina-saas-green.vercel.app
```

- [ ] **Step 4: Apply the additive database migration**

Using the production `DATABASE_URL` only for this controlled migration:

Run: `npm run db:migrate`

Expected: migration `0003_photo_object_storage` succeeds and existing photo row counts are unchanged.

- [ ] **Step 5: Deploy to the temporary Workers URL**

Run: `npm run deploy:cloudflare`

Expected: deployment succeeds and prints the assigned `https://<worker>.workers.dev` URL. Record the deployed Git commit.

Run: `npm run smoke:deployment -- https://<worker>.workers.dev`

Expected: all public, non-mutating checks pass.

- [ ] **Step 6: Complete authenticated smoke tests before migrating photos**

Manually verify on the Workers URL:

1. owner login/logout and session persistence;
2. dashboard workshop isolation;
3. create/edit customer and create vehicle;
4. create an order, diagnosis, quote, approval, work status, ready notice, finalization, and stock consumption;
5. upload and view one new JPG/PNG/WebP test photo;
6. public quote link and WhatsApp URL use the Workers origin;
7. A4 print preview is complete;
8. manifest is installable on desktop or phone;
9. Cloudflare logs show no CPU-limit or unhandled runtime error.

Expected: every item passes. Any authentication/runtime/CPU failure blocks cutover.

- [ ] **Step 7: Migrate legacy photos without deleting Base64**

Run: `npm run db:migrate-photos:r2 -- --dry-run`

Expected: reports the exact count of legacy candidates with no writes.

Run: `npm run db:migrate-photos:r2`

Expected: all candidates migrate, byte counts verify, and failure count is zero.

Run: `npm run db:migrate-photos:r2 -- --dry-run`

Expected: zero candidates.

Open a representative legacy photo through the authenticated Workers route and confirm it renders.

- [ ] **Step 8: Configure and test Vercel rollback against R2**

Add the same four R2 variables plus `AUTH_TRUSTED_ORIGINS` to the Vercel Production environment without printing their values. Deploy the same verified commit to Vercel. Authenticate on Vercel and open both a migrated legacy photo and the new Workers-uploaded photo.

Expected: both render through `/api/photos/<id>` on Vercel. If login requires the rollback URL to be canonical, perform the documented temporary `BETTER_AUTH_URL` switch, verify, then return it to Workers and redeploy both targets.

- [ ] **Step 9: Finalize canonical Workers URLs**

Confirm `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` equal the Workers URL in Cloudflare, and that `AUTH_TRUSTED_ORIGINS` includes both Workers and Vercel. Redeploy once after the final values are set.

Run: `npm run smoke:deployment -- https://<worker>.workers.dev`

Expected: PASS.

Repeat owner login, one existing photo view, quote-link generation, and PWA launch. Expected: PASS with no CPU-limit entries in Cloudflare logs.

- [ ] **Step 10: Record the release and preserve rollback**

Record the Worker URL, deployed commit, deployment time, migration counts, and smoke-test result in the runbook without secrets or customer data. Do not delete the Vercel project or clear `data_base64`.

If the runbook changed, commit only that file:

```bash
git add docs/deployment/cloudflare-pilot.md
git commit -m "docs: record Cloudflare pilot release"
```

### Task 9: Independent review and delivery

**Files:**
- Review: every file changed since `5458bef`
- No planned implementation files beyond review fixes

**Interfaces:**
- Produces: one requirement-compliance review and one code-quality review, or the Native execution method's single fresh final reviewer.

- [ ] **Step 1: Review against the approved specification**

Check every success criterion and global constraint. Pay special attention to private storage, cross-tenant photo access, cleanup after database failure, idempotent migration, PWA cache privacy, dual builds, and the real Vercel rollback sequence.

- [ ] **Step 2: Fix findings with RED/GREEN evidence**

For each valid finding, first add or expose a failing test/reproduction, then implement the smallest fix, rerun the focused test, and commit the fix separately.

- [ ] **Step 3: Re-run final verification after all review fixes**

Run:

```bash
npm test
npm run typecheck
npm run build
npx vinext check
npm run build:cloudflare
npm audit --omit=dev
git diff --check
git status --short
```

Expected: all checks pass, no high/critical production advisory remains, and the worktree contains no uncommitted implementation change.

- [ ] **Step 4: Present delivery evidence**

Report the Workers production URL, deployed commit, test/build results, migration counts, Vercel rollback result, PWA install result, and any provider configuration still owned by the user. Never report a deployment as complete based only on a local build.
