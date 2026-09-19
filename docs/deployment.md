# Deployment

Target: Cloudflare Workers with static assets, backed by Cloudflare D1.

## 1. D1

Create the database once and record its id:

```bash
wrangler d1 create wealthscope
```

Paste the printed `database_id` into `wrangler.jsonc` under `d1_databases`
(the placeholder id is only there so local development works before the real
database exists). D1 picks its primary location from where you run the command;
run it from the region closest to your users, or pass `--location apac`.

Then build the schema:

```bash
pnpm db:migrate:remote      # wrangler d1 migrations apply wealthscope --remote
```

That applies every `drizzle/*.sql` file wrangler has not yet recorded in the
database's `d1_migrations` table. It is idempotent, so it belongs in the pipeline
before every deploy.

A staging environment is a second database: create it, add a
`[env.staging]` block in `wrangler.jsonc` with its own `d1_databases` entry, and
deploy with `--env staging`.

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
  "d1_databases": [
    { "binding": "DB", "database_name": "wealthscope", "database_id": "…", "migrations_dir": "drizzle" }
  ],
  "vars": { "PUBLIC_APP_NAME": "WealthScope", … },
  "placement": { "mode": "smart" }
}
```

Three settings matter:

- **`d1_databases`** is the database. The application reads it as
  `platform.env.DB`; there is no connection string anywhere. `migrations_dir`
  points wrangler at the folder Drizzle writes to, so one set of SQL serves both
  tools.
- **`nodejs_compat`** is required by pdf-lib (`node:buffer`) during report
  generation, and by the demo seed's `node:crypto` (development only).
- **`placement: smart`** lets the runtime move the Worker next to the database.
  Every protected page makes several D1 round trips, so proximity to the
  database dominates the response time.

After changing bindings, regenerate the runtime types the type-checker uses:
`pnpm cf:types` (also run by `pnpm install` through `prepare`).

## 3. Secrets

Never in `wrangler.jsonc`. Set once per environment:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

| Secret               | Value                                             |
| -------------------- | ------------------------------------------------- |
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
runtime-compatibility problems surface. It uses the same local D1 database as
`pnpm dev` (under `.wrangler/state`), so the demo household is already there.
Note that it listens on port 8787 while `.env` names port 5555 in
`BETTER_AUTH_URL`; sign-in through the preview needs that variable pointed at
the preview origin, or a `.dev.vars` file that overrides it.

## 5. Suggested pipeline

```yaml
- pnpm install --frozen-lockfile
- pnpm check # svelte-check, strict TypeScript
- pnpm lint # prettier --check + eslint
- pnpm test # unit + integration (the latter on a throwaway in-memory D1)
- pnpm build
- pnpm exec playwright install --with-deps chromium
- pnpm db:migrate && pnpm test:e2e # e2e runs against the local D1
- pnpm db:migrate:remote # against production, before the deploy
- pnpm deploy
```

Run `db:migrate:remote` **before** `deploy`. The new Worker expects the new
schema; the old one tolerates additive changes. The pipeline needs
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the remote steps and
nothing for the local ones.

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
- **Cloudflare D1** is the primary database. SQLite has no arbitrary-precision
  numeric, so every financial value is stored as an exact decimal `text` and the
  engine does the arithmetic in `Decimal`; D1 has no interactive transactions,
  so multi-statement writes go through atomic `batch()` calls. Both decisions
  and their limits are in [`database.md`](database.md).
- **Backups.** D1 keeps 30 days of point-in-time history on paid plans
  (`wrangler d1 time-travel`); `wrangler d1 export wealthscope --remote
--output backup.sql` takes a portable dump.

## 9. Rollback

Workers keeps previous versions:

```bash
wrangler deployments list
wrangler rollback [deployment-id]
```

Migrations do not roll back automatically. Keep them additive where possible —
add a column, backfill, then drop in a later release — so a Worker rollback stays
safe. For a data rollback, `wrangler d1 time-travel restore wealthscope
--timestamp <ISO>` rewinds the database itself.

## 10. Post-deploy checks

1. `GET /` returns the prerendered landing page
2. `GET /dashboard` while signed out redirects to `/login?redirectTo=%2Fdashboard`
3. Registration creates a user and lands on `/welcome`
4. `curl -I https://…/` shows the CSP and `X-Frame-Options` headers
5. An authenticated page response carries `cache-control: private, no-store`
6. `/api/exports/csv?kind=assets` downloads, and contains only your own rows
