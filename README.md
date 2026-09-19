# WealthScope

Personal wealth analysis. Record assets, investments, liabilities, income and expenses; get net worth, allocation, liquidity, debt metrics, portfolio returns, risk measures and projections computed exactly.

One SvelteKit repository — frontend, server-side rendering, form actions, API endpoints, business logic, financial engine and database schema. There is no separate backend.

---

## Table of contents

- [Overview](#overview)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment setup](#environment-setup)
- [D1 setup](#d1-setup)
- [Migrations](#migrations)
- [Seed data](#seed-data)
- [Local development](#local-development)
- [Tests](#tests)
- [Production build](#production-build)
- [Cloudflare deployment](#cloudflare-deployment)
- [Authentication](#authentication)
- [Design system](#design-system)
- [Financial precision rules](#financial-precision-rules)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Overview

WealthScope answers one question — _what is my financial position, exactly?_ — across these screens:

| Screen            | Route                 | What it owns                                                     |
| ----------------- | --------------------- | ---------------------------------------------------------------- |
| Dashboard         | `/dashboard`          | Net worth, allocation, liquidity, health, recent activity        |
| Accounts          | `/accounts`           | Banks, brokers and wrappers; drives liquidity                    |
| Assets            | `/assets`             | Property, cash, deposits, retirement savings, holdings           |
| Investments       | `/investments`        | Cost basis, returns, sleeve weights, transactions, prices        |
| Liabilities       | `/liabilities`        | Balances, rates, debt service, amortisation, payoff order        |
| Income & expenses | `/cashflow`           | Recurring and one-off flows, savings rate, categories            |
| Analyze           | `/analyze/overview`   | Health score by dimension, findings, snapshot capture            |
| Risk              | `/analyze/risk`       | Volatility, drawdown, concentration, correlation, stress         |
| Projection        | `/analyze/projection` | Deterministic compounding under stated assumptions               |
| Reports           | `/reports`            | CSV export, PDF statement, print layout                          |
| Import            | `/import`             | CSV upload, column mapping, row validation, transactional commit |
| Settings          | `/settings`           | Base currency, assumptions, exchange rates, profile              |

Two principles run through all of it:

1. **Exactness.** Every monetary value is an exact decimal from the database to the screen. Binary floating point never touches a persisted or reported figure.
2. **Honesty about missing data.** Where the records do not support a metric — too little price history, no exchange rate, no cost basis — the application says so instead of estimating. No metric on any screen was manufactured to fill a gap.

---

## Technology stack

| Layer      | Choice                                                      | Why                                                      |
| ---------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Framework  | SvelteKit 2 + Svelte 5 (runes)                              | SSR and client navigation from one codebase              |
| Language   | TypeScript, strict                                          | `any` is banned by lint                                  |
| Build      | Vite 7, pnpm                                                | Route-level code splitting out of the box                |
| Runtime    | Cloudflare Workers, `@sveltejs/adapter-cloudflare`          | Edge SSR near the database                               |
| Database   | Cloudflare D1 (SQLite)                                      | A Worker binding: no connection string, no cold connect  |
| ORM        | Drizzle ORM + Drizzle Kit                                   | Typed schema, SQL migrations committed to the repo       |
| Auth       | Better Auth + Drizzle adapter                               | Database-backed sessions, HTTP-only cookies              |
| Validation | Zod 4                                                       | One schema shared by forms, actions and the CSV importer |
| Money      | Decimal.js                                                  | Exact arithmetic                                         |
| Charts     | Inline SVG; Apache ECharts for the correlation heatmap only | ECharts is lazy-loaded, four modules, one route          |
| CSV        | Papa Parse, in a Web Worker for large files                 | The main thread stays responsive                         |
| PDF        | pdf-lib, dynamically imported                               | Never in the initial bundle                              |
| Tests      | Vitest, Playwright                                          | Unit, integration and end-to-end                         |

No Tailwind and no component library. Styling is the design system's own CSS tokens and classes.

---

## Architecture

```
Route load / form action     parse the request, resolve the session, shape the response
        ↓
Service                      authorization, business rules, transaction boundaries
        ↓
Repository                   user-scoped queries, persistence mapping
        ↓
Drizzle → Cloudflare D1

Financial engine             pure calculation: no database, Svelte or Cloudflare imports
```

- **`src/lib/engine/`** is pure TypeScript. It imports nothing but `decimal.js` and the domain vocabulary. Every function is deterministic and unit-tested, which is what makes the server the single source of truth for anything persisted.
- **`src/lib/server/`** is server-only by SvelteKit's convention; importing it from browser code is a build error.
- **Rendering** is hybrid: the landing page, privacy and terms are prerendered; auth and app routes are server-rendered, then navigate on the client. SSR is never disabled — browser-only code (ECharts) initialises after mount.

More in [`docs/architecture.md`](docs/architecture.md).

---

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- A Cloudflare account — **only to deploy**. Local development runs on a local
  D1 database under `.wrangler/state` and needs no service and no network.

---

## Installation

```bash
pnpm install
```

---

## Environment setup

```bash
cp .env.example .env
```

| Variable                  | Required | Notes                                                |
| ------------------------- | -------- | ---------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | yes      | Session signing key — `openssl rand -base64 32`      |
| `BETTER_AUTH_URL`         | yes      | Public origin; must match the browser origin exactly |
| `PUBLIC_APP_NAME`         | no       | Defaults to `WealthScope`                            |
| `PUBLIC_DEFAULT_LOCALE`   | no       | Defaults to `th-TH`                                  |
| `PUBLIC_DEFAULT_CURRENCY` | no       | Defaults to `THB`                                    |
| `SKIP_INTEGRATION`        | no       | Set to `1` to leave the integration suite out        |

There is no database variable. The database is the `DB` binding in
`wrangler.jsonc`, and which database that is depends on how the app runs — see
the next section.

`.env` is gitignored. Never commit real credentials.

---

## Which database

The application only ever sees `platform.env.DB`. What stands behind it:

| Command        | Runtime        | Database                                        |
| -------------- | -------------- | ----------------------------------------------- |
| `pnpm dev`     | Vite + Node    | Local SQLite under `.wrangler/state`, persisted |
| `pnpm preview` | `wrangler dev` | The same local database, on workerd             |
| `pnpm test`    | Vitest         | A throwaway in-memory D1 per suite              |
| `pnpm deploy`  | Cloudflare     | The real D1 database named in `wrangler.jsonc`  |

In `vite dev`, `@sveltejs/adapter-cloudflare` emulates `platform.env` from
`wrangler.jsonc` through wrangler's platform proxy, so the local database is the
same SQLite engine and the same workerd D1 implementation that production runs,
built from the same `drizzle/*.sql`. Nothing is "close enough for development".

Two things to know:

- The schema is wrangler's job, not the app's. Run `pnpm db:migrate` once after
  cloning (and after every new migration); the first request then seeds the demo
  household into the empty database automatically.
- `pnpm db:reset` deletes `.wrangler/state`. Migrate again and the next
  `pnpm dev` rebuilds the demo data from scratch.

---

## D1 setup

Only needed to deploy. Local development works without it.

1. `wrangler d1 create wealthscope` and paste the printed id into
   `wrangler.jsonc` → `d1_databases[0].database_id`.
2. `pnpm db:migrate:remote` to build the schema.
3. Set the secrets (below) and `pnpm deploy`.

Two D1 limits shape the code, both handled in `src/lib/server/db/batch.ts`:
at most 100 bound parameters per statement, and no interactive transactions.
Multi-row writes are chunked to fit and sent as one atomic `batch()`, so the
CSV import still either lands completely or not at all.

---

## Migrations

```bash
pnpm db:generate         # regenerate SQL after a schema change (no database needed)
pnpm db:migrate          # apply pending migrations to the local database
pnpm db:migrate:remote   # apply pending migrations to the deployed database
```

Drizzle writes the SQL; wrangler applies it. Both point at `drizzle/`, and
wrangler records what it has applied in the database's `d1_migrations` table, so
each command is safe to repeat. `drizzle/0000_init.sql` creates 15 tables with
their indexes, foreign keys and check constraints.

To look inside the local database:

```bash
wrangler d1 execute wealthscope --local --command "select count(*) from assets"
```

---

## Seed data

```bash
pnpm db:seed             # create the demo account if it does not exist
pnpm db:seed -- --reset  # wipe the demo account's records and rebuild them
```

Creates one clearly fictional household: five accounts, nine assets across two currencies, 27 months of price history, six transactions, three liabilities, eleven cash-flow entries, three goals and 24 net-worth snapshots — enough for every screen and every chart to have something real to show.

```
email:    demo@wealthscope.example
password: demo-password-1234
```

It seeds the local database only; there is deliberately no remote mode. The script also refuses to run when `NODE_ENV=production`.

---

## Local development

```bash
pnpm dev             # http://localhost:5555
pnpm check           # svelte-check, strict TypeScript
pnpm lint            # prettier --check + eslint
pnpm format          # prettier --write
pnpm db:reset        # delete the local database; `pnpm db:migrate` rebuilds it
```

After `pnpm db:migrate`, the first request seeds the demo account into the empty
database, which takes a moment. Every request after that is served from the
local SQLite file — no network round trip to a database at all.

---

## Tests

```bash
pnpm test            # Vitest: unit + integration
pnpm test:watch
pnpm test:e2e        # Playwright (builds and previews first)
```

**Unit tests** (237, no infrastructure needed) cover the money helpers, currency conversion, net worth, allocation, cash flow, debt, returns, risk, projection, the health score, the findings rules, every Zod schema, CSV mapping, duplicate detection and CSV export safety — including zero, negative, very large and many-decimal values, missing exchange rates, mixed currencies, empty portfolios, division by zero and partial history.

**Integration tests** run against a real D1 database: a throwaway in-memory
one per suite, started through wrangler's platform proxy and migrated from
`drizzle/*.sql`. No infrastructure, no network, under ten seconds for the whole
suite. They cover repository queries, exact decimal round-tripping, snapshot
upserts and — the central claim — that no repository method reaches another
user's row, whatever id it is handed. `SKIP_INTEGRATION=1 pnpm test` leaves
them out.

**End-to-end tests** need a running app and a migrated local database
(`pnpm db:migrate`), then:

```bash
pnpm test:e2e
```

They cover registration, sign-in, sign-out, protected-route redirect, asset create/edit/delete, liability creation, cash-flow entry, dashboard updates, CSV import validation and commit, CSV export, PDF generation, analysis runs, mobile navigation, horizontal-overflow checks at 360px, heading structure, focus management and keyboard-only form submission.

---

## Production build

```bash
pnpm build
```

Measured gzip sizes of the current build:

| Route                 | JS    | CSS  |
| --------------------- | ----- | ---- |
| Landing (prerendered) | 53 KB | 4 KB |
| Sign-in               | 57 KB | 4 KB |
| Dashboard             | 69 KB | 7 KB |
| Risk                  | 67 KB | 6 KB |

ECharts (~86 KB gzip) loads only when the Correlation tab is opened. pdf-lib loads only when a report is requested. Neither appears in any other route's graph.

---

## Cloudflare deployment

```bash
pnpm build
pnpm preview                       # wrangler dev, against the built Worker
pnpm deploy                        # wrangler deploy
```

Set the secrets once per environment:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

Public variables live in `wrangler.jsonc` under `vars`, and the database is its `d1_databases` entry. `nodejs_compat` is required — pdf-lib needs `node:buffer`. Placement is `smart` so the runtime can move the Worker next to the database, because every protected page makes several D1 round trips.

Full checklist in [`docs/deployment.md`](docs/deployment.md).

---

## Authentication

Better Auth with the Drizzle adapter, email and password.

- Sessions are database-backed, in an HTTP-only, `SameSite=Lax` cookie that is `Secure` in production.
- `hooks.server.ts` resolves the session into `event.locals.user`. That is the **only** place a user identity enters the application; a `userId` in a request body is never read.
- Every protected route is enforced on the server before any load function runs. Client-side guards are convenience, never the control.
- Passwords need 12 characters minimum, with no composition rules — length beats character classes, and rules that fight a password manager make things worse.
- Sign-in and registration return one generic message for every failure, so neither form can be used to discover which addresses hold accounts.
- Password reset is **scaffolded, not wired**: no mail transport is configured, so the UI says so rather than pretending to send an email. See [`docs/security.md`](docs/security.md) for the wiring checklist.

---

## Design system

The visual layer implements the **Modernist** design system from the attached Claude Design export, verbatim where it defines tokens:

- Archivo throughout, headings at weight 800
- Zero corner radius everywhere (`--radius-*: 0`) — deliberate, not an oversight
- Strong 2px rules between sections; alignment and dividers do the organising
- A single accent (`#ec3013`), used sparingly for the primary action and small emphasis
- 100–900 tonal ramps generated on one shared perceptual lightness scale
- Flush-left labels, including inside wide buttons

`src/app.css` carries the tokens, the component classes (`.btn`, `.input`, `.table`, `.dialog`, `.tag`, `.seg`) and a WealthScope layer of layout primitives. Components use scoped CSS for anything local.

Two implementation notes:

- **Rule grids.** The design draws a 2px rule between every cell. Rendering it as the grid's own background with a 2px gap keeps it exact through every wrap and breakpoint, which per-cell borders cannot do once columns reflow.
- **Responsive.** The prototype computed density in JavaScript from `window.innerWidth`; the same 0.75/0.68 factors are expressed as CSS custom properties under the same two breakpoints (1180px and 900px), so there is no layout shift and nothing to hydrate.

The prototype also offered a dark appearance. It is implemented as token overrides only, so every component follows automatically.

---

## Financial precision rules

**Never** use binary floating point for a canonical figure:

```ts
const total = 0.1 + 0.2; // 0.30000000000000004 — never
const total = new Decimal('0.1').plus('0.2'); // 0.3 — always
```

Column storage:

| Kind                           | Storage               | Scale |
| ------------------------------ | --------------------- | ----- |
| Money and balances             | `text` decimal string | 8 dp  |
| Asset quantities               | `text` decimal string | 12 dp |
| Asset prices                   | `text` decimal string | 8 dp  |
| Exchange rates                 | `text` decimal string | 12 dp |
| Interest rates and percentages | `text` decimal string | 8 dp  |

SQLite has no arbitrary-precision numeric — a `REAL` column would round past 16 significant digits — so every financial value is stored as the exact decimal string the engine produced. Drizzle returns it unchanged and the engine parses it straight into `Decimal`; a value never passes through a JavaScript `number` on the way in or out of the database. The only place `number` appears is where a value is on its way to a CSS width or an SVG coordinate.

Rounding:

- Intermediate arithmetic keeps 40 significant digits and is never rounded.
- Persistence rounds to the column scale with **half-even**, which does not drift upward across many operations.
- Display rounds with **half-up** at the moment of formatting, and nowhere else.

Currency:

- Every monetary record carries an ISO 4217 currency.
- Values in different currencies are never added. Conversion goes through `convert()`, which either returns an exact result together with the rate it used, or reports the missing pair so the screen can show an incomplete state.
- New accounts default to THB / th-TH / Asia/Bangkok.
- Snapshots record the rates they applied, so history stays reproducible after rates move.

More in [`docs/financial-calculations.md`](docs/financial-calculations.md).

---

## Project structure

```
src/
├── lib/
│   ├── components/         base/ charts/ forms/ tables/ feedback/ layout/
│   ├── server/             auth/ db/ repositories/ services/ authorization/ security/
│   ├── engine/             money net-worth allocation returns cashflow debt
│   │                       risk projection currency health-score findings analysis
│   ├── schemas/            common financial settings auth
│   ├── types/              domain session
│   ├── stores/             formatting toast
│   ├── workers/            csv-parser.worker.ts
│   ├── importers/          csv definitions
│   ├── exporters/          csv pdf
│   └── utils/
├── routes/
│   ├── +page.svelte                    landing (prerendered)
│   ├── privacy/ terms/                 (prerendered)
│   ├── (auth)/login/ register/
│   ├── (app)/                          protected; the layout enforces the session
│   │   ├── dashboard/ accounts/ assets/ investments/ liabilities/ cashflow/
│   │   ├── analyze/overview/ risk/ projection/
│   │   └── reports/ import/ settings/ welcome/
│   └── api/auth/ assets/ prices/ exports/
├── hooks.server.ts         session, route protection, security headers
├── hooks.ts                Decimal transport across the load boundary
├── app.css                 design tokens + component classes
└── app.d.ts

drizzle/                    generated SQL migrations
scripts/seed.ts             development seed
tests/unit/ integration/ e2e/
docs/
```

---

## Known limitations

1. **PDF reports are Latin-1.** pdf-lib's standard fonts cannot encode Thai. Report text is transliterated, and characters outside Latin-1 render as `?`. Embedding a Unicode font (Sarabun or Noto Sans Thai) is the fix; it adds roughly 300 KB to the report endpoint's bundle, so it was left out until the need is real.
2. **Rate limiting is per-isolate.** The default limiter is in-memory. In Workers each isolate has its own memory, so it raises the cost of a naive attack but is not a cluster-wide guarantee. `setRateLimiter()` is the documented swap-in point for Cloudflare's Rate Limiting binding or a Durable Object.
3. **Password reset is scaffolded, not delivered.** No mail transport is configured. The UI states this plainly rather than pretending.
4. **No market-data provider.** Prices are entered by hand or imported. Nothing is fetched from an external service, which also means no licensing constraints on redistributed data.
5. **No Monte Carlo projection.** The deterministic projection is complete and tested. A stochastic variant belongs in the existing Web Worker; it is deliberately not implemented, because a simulation built on the same single return assumption would look more informative than it is.
6. **Annualised return is not published.** Doing it correctly needs a full dated cash-flow history per holding (a money-weighted return). The engine has `annualisedReturn()` with strict validity guards, but no screen quotes a portfolio CAGR, because the records do not yet support one.
7. **Correlation and volatility need recorded history.** Twelve overlapping monthly observations minimum for correlation, 24 for volatility. Below that the screens show an insufficient-data state rather than a class-level assumption dressed up as a measurement.
8. **Integration and e2e tests need a database.** Both suites skip or fail without one; only the 237 unit tests are infrastructure-free.
9. **Snapshots are captured on demand.** History accrues when an analysis is run, not on a schedule, so the net-worth trend is only as dense as the runs behind it.

---

## Future improvements

- Embed a Unicode font so PDF reports render Thai
- Cloudflare Rate Limiting binding behind the existing `RateLimiter` interface
- Email transport, unlocking self-service password reset and email verification
- Money-weighted (IRR) returns once transaction coverage justifies them
- Monte Carlo projection in the existing Web Worker, with confidence bands
- A `PriceProvider` adapter for optional market data, behind an interface so the engine stays unaffected by any provider's terms
- Table virtualisation, once record counts justify it — pagination handles current volumes
- Scheduled snapshot capture via Cloudflare Cron Triggers, so history accrues without a manual run

---

## Licence

Not yet chosen. All runtime dependencies are MIT, Apache-2.0 or PostgreSQL-licensed; no GPL, AGPL, SSPL, BSL, Elastic, Commons Clause or source-available packages are used.
