# Deployment

Target: Cloudflare Workers with static assets, backed by Neon PostgreSQL.

## 1. Neon

1. Create a project in **`ap-southeast-1` (Singapore)** — closest to Thailand,
   which is where the default locale points.
2. Copy the **pooled** connection string. The host contains `-pooler`; the direct
   string will exhaust connections under Worker concurrency.
3. Apply the migrations:

```bash
DATABASE_URL="postgresql://…-pooler.ap-southeast-1.aws.neon.tech/wealthscope?sslmode=require" \
  pnpm db:migrate
```

Neon branches are useful here: branch `main` for a staging database and point
`TEST_DATABASE_URL` at it in CI.

## 2. Cloudflare

`wrangler.jsonc` is committed and complete:

```jsonc
{
  "name": "wealthscope",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2025-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "observability": { "enabled": true },
  "vars": { "PUBLIC_APP_NAME": "WealthScope", … },
  "placement": { "mode": "smart" }
}
```

Two settings matter:

- **`nodejs_compat`** is required. `@neondatabase/serverless` needs `node:events`
  and `node:buffer`; pdf-lib needs `node:buffer` during report generation.
- **`placement: smart`** runs the Worker near Neon rather than near the visitor.
  Every protected page makes several database round trips, so proximity to the
  database dominates the response time.

## 3. Secrets

Never in `wrangler.jsonc`. Set once per environment:

```bash
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

| Secret               | Value                                             |
| -------------------- | ------------------------------------------------- |
| `DATABASE_URL`       | Neon pooled connection string                     |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`                         |
| `BETTER_AUTH_URL`    | The public origin, e.g. `https://wealthscope.app` |

`BETTER_AUTH_URL` must match the browser origin exactly, including scheme and any
subdomain. A mismatch makes sign-in fail with no useful error, because the cookie
is written for a different origin.

Public variables (`PUBLIC_APP_NAME`, `PUBLIC_DEFAULT_LOCALE`,
`PUBLIC_DEFAULT_CURRENCY`) stay in `vars` — they are not secrets and are visible
to the browser by design.

## 4. Deploy

```bash
pnpm build
pnpm deploy
```

Preview the built Worker locally first:

```bash
pnpm preview     # wrangler dev
```

This runs the real Worker runtime, not Vite's dev server, which is where
runtime-compatibility problems surface.

## 5. Suggested pipeline

```yaml
- pnpm install --frozen-lockfile
- pnpm check # svelte-check, strict TypeScript
- pnpm lint # prettier --check + eslint
- pnpm test # unit; integration if TEST_DATABASE_URL is set
- pnpm build
- pnpm exec playwright install --with-deps chromium
- pnpm test:e2e # needs a scratch database
- pnpm db:migrate # against production, before the deploy
- pnpm deploy
```

Run `db:migrate` **before** `deploy`. The new Worker expects the new schema; the
old one tolerates additive changes.

## 6. Custom domain

1. Add the domain to Cloudflare.
2. Route it to the Worker (Workers → Triggers → Custom Domains).
3. Update `BETTER_AUTH_SECRET`'s companion `BETTER_AUTH_URL` to the new origin.
4. Redeploy.

## 7. Observability

`observability.enabled` turns on Workers Logs. Application logs are structured
JSON with a `level`, an `event`, a correlation `code` and a non-reversible user
reference — see [`security.md`](security.md) for what is deliberately absent.

Useful queries:

- `event = "unhandled"` — unexpected server errors, with the code the user saw
- `event = "auth.login_failed"` — credential-stuffing shape
- `event = "import.failed"` — rolled-back imports
- `event = "session.resolve_failed"` — session-layer problems

## 8. Storage decisions

- **Cloudflare R2** is not used. Uploaded CSV files are parsed in memory and
  discarded; there is nothing to retain. Add R2 only if retaining source files
  becomes a requirement, and never for relational financial data.
- **Cloudflare D1** is not used as the primary database. The financial schema
  needs `numeric` with 24–30 digits of precision and real transactions; SQLite's
  numeric affinity would silently convert those to floats.

## 9. Rollback

Workers keeps previous versions:

```bash
wrangler deployments list
wrangler rollback [deployment-id]
```

Migrations do not roll back automatically. Keep them additive where possible —
add a column, backfill, then drop in a later release — so a Worker rollback stays
safe.

## 10. Post-deploy checks

1. `GET /` returns the prerendered landing page
2. `GET /dashboard` while signed out redirects to `/login?redirectTo=%2Fdashboard`
3. Registration creates a user and lands on `/welcome`
4. `curl -I https://…/` shows the CSP and `X-Frame-Options` headers
5. An authenticated page response carries `cache-control: private, no-store`
6. `/api/exports/csv?kind=assets` downloads, and contains only your own rows
