# Cloudflare Pilot Deployment Design

## Objective

Move the Paulinho Car production pilot from Vercel to Cloudflare without interrupting the existing Vercel deployment or migrating the Neon database. The first production target uses the Cloudflare free tiers while they remain reliable for the workshop workload. The application must remain installable as a PWA and must preserve a tested rollback path to Vercel.

This specification supplements the approved real-workshop product design and supersedes only its Vercel hosting and Vercel Blob decisions. The product scope, tenant model, workshop workflow, and deferred features remain unchanged.

The deployment is successful when the owner can sign in, manage customers and vehicles, complete the full work-order flow, upload and view photos, print the A4 work order, and reopen the application from an installed icon on a computer or phone using the Cloudflare URL.

## Constraints and success criteria

- The first customer pays R$ 99 per month, so the pilot should not require a US$ 20 Vercel Pro subscription.
- Vercel remains available for development and rollback, but its Hobby deployment is not the commercial production endpoint.
- Neon, Drizzle, Better Auth, and the existing database stay in place.
- No existing customer, vehicle, service, inventory, authentication, or photo data may be lost.
- The R2 bucket is private. Photo access continues through the authenticated application route.
- The Cloudflare deployment must pass the existing test suite, type checking, the original Next.js build, a Cloudflare build, and production smoke tests before cutover.
- A Cloudflare limitation or incompatibility must trigger rollback rather than an untested production workaround.

## Considered approaches

### Selected approach

Use vinext to deploy the existing Next.js 16 application to Cloudflare Workers, Neon for Postgres, and Cloudflare R2 for photos. Keep the standard Next.js scripts and Vercel configuration working. Access R2 through its S3-compatible API so the same photo implementation works on both Cloudflare and Vercel.

This approach follows Cloudflare's current recommendation for existing Next.js 16 applications. The vinext compatibility check on 21 October 2026 reported 100 percent compatibility for the current project: five Next.js import families, the Server Actions body-size configuration, Better Auth, Zod, App Router, seventeen pages, two route handlers, and the Next.js 16 proxy were supported with no partial or unsupported findings.

### Alternative rejected for the pilot

Deploy with the OpenNext adapter and use a native R2 binding. This preserves more direct Next.js build behavior, but Cloudflare now recommends vinext for new migrations. A native R2-only implementation would also weaken the Vercel rollback because new photos would not be readable there without a second storage implementation.

### Alternative retained only as contingency

Keep the application on Vercel Hobby until a second customer is signed. This requires no migration but conflicts with Vercel's non-commercial Hobby restriction. The existing deployment stays available as a technical fallback, not as the chosen commercial production environment.

## Runtime architecture

The application remains one multi-tenant monolith. Cloudflare Workers runs the server-rendered application and Server Actions. Neon remains the authoritative database and Better Auth continues to store users and sessions in Neon. R2 stores binary photo content. Postgres stores only photo metadata and a private object key for new uploads.

```text
Installed PWA or browser
          |
Cloudflare Workers with vinext
          |
   +------+------+
   |             |
Neon Postgres   Private R2 bucket
business data   work-order photos
```

The same Git commit must remain buildable for Vercel. Cloudflare-specific scripts are additive:

- `npm run dev` and `npm run build` keep their existing Next.js behavior;
- `npm run dev:cloudflare` runs the vinext development server;
- `npm run build:cloudflare` creates the Workers production build;
- `npm run deploy:cloudflare` deploys the verified build with Wrangler.

The Worker uses a compatibility date on or after 21 October 2026 so `Buffer`, `process.env`, crypto, and the supported Node.js compatibility layer are available. Cloudflare secrets provide the same server-only variable names used locally and on Vercel.

## Photo storage

### Storage interface

A small server-only `PhotoStorage` interface isolates object storage from work-order logic. It supports putting, getting, and deleting a private object. The R2 implementation signs S3-compatible requests with `aws4fetch`, which is small and runs in both Workers and Node.js.

Required server-only variables:

- `R2_ACCOUNT_ID`;
- `R2_ACCESS_KEY_ID`;
- `R2_SECRET_ACCESS_KEY`;
- `R2_BUCKET_NAME`.

None of these names may use the `NEXT_PUBLIC_` prefix. The bucket is not publicly exposed.

### Database compatibility

`service_photos` gains nullable `storage_key` and `size_bytes` columns. The existing `data_base64` column becomes nullable instead of being removed. This permits zero-loss migration and preserves existing photos during rollback.

New object keys use the workshop and order identifiers plus an independent random identifier:

`workshops/<workshop-id>/orders/<order-id>/<photo-id>.<extension>`

The owner-facing photo route remains `/api/photos/<id>`. It verifies the authenticated workshop before looking up metadata. When `storage_key` exists, the route streams the private R2 object. Otherwise, it serves the legacy Base64 content. The response keeps a private cache policy and the recorded allow-listed content type.

### Upload consistency

The upload action keeps the current 2 MB limit and JPEG, PNG, or WebP allow-list. It uploads binary data directly rather than converting it to Base64. After a successful R2 upload, it inserts the metadata row in Neon. If the database insert fails, the application attempts to delete the new object before returning an error.

An idempotent migration command uploads legacy Base64 photos that do not yet have a storage key. It verifies the uploaded byte count before recording the key. The initial migration retains Base64. A separate explicit cleanup command can clear legacy content only after the Cloudflare and Vercel paths have both displayed the migrated files successfully.

## PWA behavior

The application gains a web app manifest, Paulinho Car icons in 192 and 512 pixel sizes, theme colors, and a minimal service worker registration. The installed application uses standalone display mode and the existing black, red, and white identity.

The PWA does not promise offline business operations. Authenticated pages, Server Actions, customer data, financial data, and photos use network-only behavior. The service worker may cache only immutable public assets such as icons and the logo. This prevents stale work orders and sensitive workshop data from being stored as an offline application cache.

## Authentication and URLs

The Cloudflare production URL becomes the canonical value for:

- `BETTER_AUTH_URL`;
- `NEXT_PUBLIC_APP_URL`;
- quote and WhatsApp links generated by the application.

The Vercel URL remains a trusted rollback origin only if Better Auth requires it. Public quote tokens remain valid because the Neon database is unchanged. Cookies must be tested on the `workers.dev` hostname before cutover.

No domain purchase is required for the pilot. A custom SaaS domain can be added later without changing the application architecture.

## Cloudflare deployment configuration

Wrangler configuration defines the Worker name, build output, compatibility date, and non-secret variables. Database, authentication, and R2 credentials are stored with Wrangler secrets and never committed.

The first deployment uses the assigned `workers.dev` hostname. Git-based Cloudflare builds may be connected after the manual deployment is proven, but automated production deployment is not required for the first cutover.

The Vercel project and its current environment variables are not deleted. R2 credentials are also added to Vercel before cutover so it can read new photos if rollback is required.

## Free-tier operating policy

Cloudflare Workers Free is acceptable for the first pilot only while normal requests complete reliably. Its 100,000-request daily allowance is ample for one workshop, but its 10 ms CPU limit is the primary risk because authentication and server rendering can exceed that value.

Upgrade Workers to the US$ 5 paid plan when any of these occurs:

- a valid workshop flow produces a CPU-limit error;
- production reaches the daily request ceiling;
- a second paying workshop is activated;
- the pilot requires support or reliability beyond the free-tier behavior.

R2 remains on its free allowance while stored data is below 8 GB, leaving headroom below the 10 GB limit. Neon stays on its free plan while database storage and compute remain within the provider limits and restore capability is adequate. Photos moving to R2 should keep Neon growth modest.

## Error handling and rollback

- A failed R2 upload does not create a photo row.
- A failed metadata insert triggers best-effort R2 cleanup and returns a visible error.
- A failed R2 read returns a controlled unavailable response rather than an invalid image.
- Legacy Base64 photos remain readable throughout migration.
- A Cloudflare authentication, runtime, or CPU failure blocks cutover.
- Rollback changes the owner-facing URL back to the already deployed Vercel project. The shared Neon database and portable R2 client prevent data divergence.

The cutover never deletes the Vercel project, Neon tables, legacy photo content, or R2 objects.

## Verification strategy

Automated verification includes:

- unit tests for object-key isolation, MIME validation, R2 signing failures, successful upload, cleanup after metadata failure, legacy Base64 reads, and R2 reads;
- tests that the manifest contains installable metadata and that the service worker does not cache authenticated routes or API responses;
- the existing unit and integration tests;
- TypeScript checking;
- the existing Next.js production build;
- the vinext compatibility check;
- the Cloudflare production build.

Production smoke testing on the temporary Workers URL covers:

1. owner login and logout;
2. dashboard and current workshop isolation;
3. customer and vehicle creation;
4. work-order creation and status transitions;
5. photo upload and authenticated display;
6. quote link generation and response;
7. A4 print preview;
8. PWA installation metadata;
9. WhatsApp link generation with the Cloudflare URL;
10. successful access through Vercel to the same migrated photo.

## Delivery sequence

1. Create an isolated worktree from the approved specification commit.
2. Establish a clean test and build baseline.
3. Add Cloudflare and vinext configuration without changing the Vercel build.
4. Introduce the tested photo-storage interface and database migration.
5. Add the idempotent legacy-photo migration command.
6. Add PWA metadata, icons, and safe caching behavior.
7. Run the complete local verification matrix.
8. Authenticate the Cloudflare CLI, create the private R2 bucket, and add secrets.
9. Deploy to a temporary `workers.dev` address and run production smoke tests.
10. Configure Vercel with the same R2 credentials for rollback.
11. Change canonical production URLs only after smoke tests pass.
12. Preserve the Vercel deployment until the Paulinho Car pilot has operated successfully on Cloudflare.

## Explicitly deferred

- Offline editing or synchronization of business data.
- App Store or Play Store distribution.
- A purchased custom domain.
- Automatic WhatsApp sending.
- Moving Postgres from Neon to D1 or another provider.
- Removing Vercel before the Cloudflare pilot is proven.
- Clearing legacy Base64 photo data before dual-environment verification.
