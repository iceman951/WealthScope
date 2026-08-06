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
- [Neon setup](#neon-setup)
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
| Database   | Neon Serverless PostgreSQL                                  | HTTP driver for reads, WebSocket sessions for writes     |
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
Drizzle → PostgreSQL

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
- A Neon PostgreSQL project (the free tier is enough)
- A Cloudflare account, to deploy

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

| Variable                  | Required | Notes                                                  |
| ------------------------- | -------- | ------------------------------------------------------ |
| `DATABASE_URL`            | yes      | Neon **pooled** connection string (the `-pooler` host) |
| `BETTER_AUTH_SECRET`      | yes      | Session signing key — `openssl rand -base64 32`        |
| `BETTER_AUTH_URL`         | yes      | Public origin; must match the browser origin exactly   |
| `PUBLIC_APP_NAME`         | no       | Defaults to `WealthScope`                              |
| `PUBLIC_DEFAULT_LOCALE`   | no       | Defaults to `th-TH`                                    |
| `PUBLIC_DEFAULT_CURRENCY` | no       | Defaults to `THB`                                      |
| `TEST_DATABASE_URL`       | no       | Integration tests skip themselves without it           |

`.env` is gitignored. Never commit real credentials.

---

## Neon setup

1. Create a Neon project in **`ap-southeast-1` (Singapore)** — the region closest to Thailand, which is where the default locale points.
2. Copy the **pooled** connection string (the host contains `-pooler`) into `DATABASE_URL`.
3. Run the migrations below.

Both drivers are used deliberately:

- `drizzle-orm/neon-http` for reads and single-statement writes — no connection to hold open, which is what a Worker wants.
- `drizzle-orm/neon-serverless` inside `withTransaction()` for multi-statement financial writes, which need a real session.

---

## Migrations

```bash
pnpm db:generate     # regenerate SQL after a schema change
pnpm db:migrate      # apply pending migrations
pnpm db:studio       # browse the database
```

`drizzle/0000_init.sql` creates 15 tables with their indexes, foreign keys and check constraints.

**Do not use `pnpm db:push` as the production migration process.** It diffs and applies without producing a migration file, so there is no reviewable record of what changed. It exists for throwaway local iteration.

Production:

```bash
DATABASE_URL="<production pooled url>" pnpm db:migrate
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

The script refuses to run when `NODE_ENV=production` or when `DATABASE_URL` contains `prod`.

---

## Local development

```bash
pnpm dev             # http://localhost:5173
pnpm check           # svelte-check, strict TypeScript
pnpm lint            # prettier --check + eslint
pnpm format          # prettier --write
```

---

## Tests

```bash
pnpm test            # Vitest: unit + integration
pnpm test:watch
pnpm test:e2e        # Playwright (builds and previews first)
```

**Unit tests** (237, no infrastructure needed) cover the money helpers, currency conversion, net worth, allocation, cash flow, debt, returns, risk, projection, the health score, the findings rules, every Zod schema, CSV mapping, duplicate detection and CSV export safety — including zero, negative, very large and many-decimal values, missing exchange rates, mixed currencies, empty portfolios, division by zero and partial history.

**Integration tests** run against a real PostgreSQL database and are **skipped unless `TEST_DATABASE_URL` is set**. They cover repository queries, exact numeric round-tripping, snapshot upserts and — the central claim — that no repository method reaches another user's row, whatever id it is handed.

```bash
TEST_DATABASE_URL="postgresql://..." pnpm test
```

**End-to-end tests** need a running app and a database. Point `.env` at a scratch database, then:

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
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

Public variables live in `wrangler.jsonc` under `vars`. `nodejs_compat` is required — `@neondatabase/serverless` and pdf-lib both need it. Placement is `smart` so the Worker runs near Neon rather than near the visitor, because every protected page makes several database round trips.

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

PostgreSQL column types:

| Kind                           | Type              |
| ------------------------------ | ----------------- |
| Money and balances             | `numeric(24, 8)`  |
| Asset quantities               | `numeric(30, 12)` |
| Asset prices                   | `numeric(24, 8)`  |
| Exchange rates                 | `numeric(24, 12)` |
| Interest rates and percentages | `numeric(14, 8)`  |

Drizzle returns `numeric` as a string. Those strings are parsed straight into `Decimal` by the engine; a value never passes through a JavaScript `number` on the way in or out of the database. The only place `number` appears is where a value is on its way to a CSS width or an SVG coordinate.

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
